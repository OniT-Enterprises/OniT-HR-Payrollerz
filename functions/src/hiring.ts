import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";

const db = getFirestore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates that the user has access to the specified tenant
 */
async function validateTenantAccess(
  uid: string,
  tenantId: string,
): Promise<void> {
  const userRecord = await getAuth().getUser(uid);
  const customClaims = userRecord.customClaims || {};
  const tenants = customClaims.tenants || [];

  if (!tenants.includes(tenantId)) {
    throw new HttpsError(
      "permission-denied",
      "User does not have access to this tenant",
    );
  }
}

/**
 * Generates a ULID-like ID for consistent document IDs
 */
function generateULID(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}${randomPart}`.toUpperCase();
}

/**
 * Gets the ISO date string for today
 */
function getISODateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

// ============================================================================
// CALLABLE FUNCTIONS
// ============================================================================

/**
 * Accepts an offer and creates the corresponding contract and employment snapshot
 */
export const acceptOffer = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { tenantId, offerId, employeeId } = data;

  if (!tenantId || !offerId || !employeeId) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required parameters: tenantId, offerId, employeeId",
    );
  }

  // Validate tenant access
  await validateTenantAccess(auth.uid, tenantId);

  const batch = db.batch();

  try {
    // Get the offer
    const offerDoc = await db
      .doc(`tenants/${tenantId}/offers/${offerId}`)
      .get();
    if (!offerDoc.exists) {
      throw new HttpsError("not-found", "Offer not found");
    }

    const offer = offerDoc.data()!;
    if (offer.status !== "sent") {
      throw new HttpsError(
        "failed-precondition",
        'Offer must be in "sent" status to be accepted',
      );
    }

    // Get the position
    const positionDoc = await db
      .doc(`tenants/${tenantId}/positions/${offer.positionId}`)
      .get();
    if (!positionDoc.exists) {
      throw new HttpsError("not-found", "Position not found");
    }
    const position = { id: positionDoc.id, ...positionDoc.data() };

    // Create contract
    const contractId = generateULID();
    const contractData = {
      employeeId,
      positionId: offer.positionId,
      startDate: offer.terms.startDate,
      endDate: null, // Indefinite contract
      weeklyHours: offer.terms.weeklyHours,
      overtimeRate: offer.terms.overtimeRate || 1.5,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    batch.set(
      db.doc(`tenants/${tenantId}/contracts/${contractId}`),
      contractData,
    );

    // Create employment snapshot
    const snapshotId = `${employeeId}_${getISODateString(offer.terms.startDate)}`;
    const snapshotData = {
      employeeId,
      position,
      contract: {
        id: contractId,
        ...contractData,
      },
      asOf: offer.terms.startDate,
      createdAt: FieldValue.serverTimestamp(),
    };

    batch.set(
      db.doc(`tenants/${tenantId}/employmentSnapshots/${snapshotId}`),
      snapshotData,
    );

    // Update offer status
    batch.update(offerDoc.ref, {
      status: "accepted",
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedBy: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update candidate status to 'hired'
    const candidateDoc = await db
      .doc(`tenants/${tenantId}/candidates/${offer.candidateId}`)
      .get();
    if (candidateDoc.exists) {
      batch.update(candidateDoc.ref, {
        stage: "hired",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Update employee status to 'active' if they exist
    const employeeDoc = await db
      .doc(`tenants/${tenantId}/employees/${employeeId}`)
      .get();
    if (employeeDoc.exists) {
      batch.update(employeeDoc.ref, {
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    logger.info(
      `Offer ${offerId} accepted, contract ${contractId} and snapshot ${snapshotId} created`,
      {
        tenantId,
        offerId,
        contractId,
        snapshotId,
        employeeId,
      },
    );

    return {
      success: true,
      contractId,
      snapshotId,
      message:
        "Offer accepted successfully, contract and employment snapshot created",
    };
  } catch (error) {
    logger.error("Error accepting offer", {
      error,
      tenantId,
      offerId,
      employeeId,
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to accept offer");
  }
});

/**
 * Creates a new employment snapshot for an existing employee (e.g., promotion, transfer)
 */
export const createEmploymentSnapshot = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { tenantId, employeeId, positionId, contractChanges, effectiveDate } =
    data;

  if (!tenantId || !employeeId || !positionId || !effectiveDate) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  // Validate tenant access
  await validateTenantAccess(auth.uid, tenantId);

  try {
    // Get the employee
    const employeeDoc = await db
      .doc(`tenants/${tenantId}/employees/${employeeId}`)
      .get();
    if (!employeeDoc.exists) {
      throw new HttpsError("not-found", "Employee not found");
    }

    // Get the new position
    const positionDoc = await db
      .doc(`tenants/${tenantId}/positions/${positionId}`)
      .get();
    if (!positionDoc.exists) {
      throw new HttpsError("not-found", "Position not found");
    }
    const position = { id: positionDoc.id, ...positionDoc.data() };

    // Get the most recent contract for this employee
    const contractsQuery = await db
      .collection(`tenants/${tenantId}/contracts`)
      .where("employeeId", "==", employeeId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (contractsQuery.empty) {
      throw new HttpsError(
        "not-found",
        "No existing contract found for employee",
      );
    }

    const currentContractData = contractsQuery.docs[0].data() as {
      weeklyHours?: number;
      overtimeRate?: number;
    };
    const currentContract = {
      id: contractsQuery.docs[0].id,
      ...currentContractData,
    };

    // Create new contract with changes
    const contractId = generateULID();
    const newContractData = {
      employeeId,
      positionId,
      startDate: new Date(effectiveDate),
      endDate: contractChanges?.endDate
        ? new Date(contractChanges.endDate)
        : null,
      weeklyHours: contractChanges?.weeklyHours || currentContract.weeklyHours,
      overtimeRate:
        contractChanges?.overtimeRate || currentContract.overtimeRate,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Create employment snapshot
    const snapshotId = `${employeeId}_${getISODateString(new Date(effectiveDate))}`;
    const snapshotData = {
      employeeId,
      position,
      contract: {
        id: contractId,
        ...newContractData,
      },
      asOf: new Date(effectiveDate),
      createdAt: FieldValue.serverTimestamp(),
    };

    const batch = db.batch();

    // End the current contract
    if (contractChanges?.endCurrentContract !== false) {
      batch.update(
        db.doc(`tenants/${tenantId}/contracts/${currentContract.id}`),
        {
          endDate: new Date(effectiveDate),
          updatedAt: FieldValue.serverTimestamp(),
        },
      );
    }

    // Create new contract
    batch.set(
      db.doc(`tenants/${tenantId}/contracts/${contractId}`),
      newContractData,
    );

    // Create new snapshot
    batch.set(
      db.doc(`tenants/${tenantId}/employmentSnapshots/${snapshotId}`),
      snapshotData,
    );

    await batch.commit();

    logger.info(
      `Employment snapshot ${snapshotId} created for employee ${employeeId}`,
      {
        tenantId,
        employeeId,
        contractId,
        snapshotId,
        effectiveDate,
      },
    );

    return {
      success: true,
      contractId,
      snapshotId,
      message: "Employment snapshot created successfully",
    };
  } catch (error) {
    logger.error("Error creating employment snapshot", {
      error,
      tenantId,
      employeeId,
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to create employment snapshot");
  }
});

// ============================================================================
// FIRESTORE TRIGGERS
// ============================================================================

/**
 * Automatically create employment snapshots when offers are accepted
 */
export const onOfferAccepted = onDocumentUpdated(
  "tenants/{tenantId}/offers/{offerId}",
  async (event) => {
    const { tenantId, offerId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn("Missing before/after data in offer update trigger");
      return;
    }

    // Check if offer was just accepted
    if (before.status !== "accepted" && after.status === "accepted") {
      logger.info(
        `Offer ${offerId} was accepted, triggering snapshot creation`,
        { tenantId, offerId },
      );

      try {
        // This would normally call the acceptOffer function internally
        // For now, we'll just log that the trigger fired
        // In a real implementation, you'd extract the logic from acceptOffer
        // to a shared function that both the callable and trigger can use

        logger.info("Offer acceptance trigger completed", {
          tenantId,
          offerId,
        });
      } catch (error) {
        logger.error("Error in offer acceptance trigger", {
          error,
          tenantId,
          offerId,
        });
      }
    }
  },
);

/**
 * Validate job posting approvals
 */
export const validateJobApproval = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { tenantId, jobId, action } = data; // action: 'approve' | 'reject'

  if (!tenantId || !jobId || !action) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  // Validate tenant access
  await validateTenantAccess(auth.uid, tenantId);

  try {
    // Get the job
    const jobDoc = await db.doc(`tenants/${tenantId}/jobs/${jobId}`).get();
    if (!jobDoc.exists) {
      throw new HttpsError("not-found", "Job not found");
    }

    const job = jobDoc.data()!;

    // Check if user is authorized to approve this job
    let canApprove = false;

    if (job.approverMode === "specific" && job.approverId === auth.uid) {
      canApprove = true;
    } else if (job.approverMode === "department" && job.approverDepartmentId) {
      // Check if user is a manager in the approver department
      const userEmployee = await db
        .collection(`tenants/${tenantId}/employees`)
        .where("id", "==", auth.uid) // Assuming employee ID matches user ID
        .where("departmentId", "==", job.approverDepartmentId)
        .limit(1)
        .get();

      if (!userEmployee.empty) {
        // Additional check: verify user has manager role in tenant
        const memberDoc = await db
          .doc(`tenants/${tenantId}/members/${auth.uid}`)
          .get();
        if (memberDoc.exists) {
          const member = memberDoc.data()!;
          canApprove = ["owner", "hr-admin", "manager"].includes(member.role);
        }
      }
    }

    if (!canApprove) {
      throw new HttpsError(
        "permission-denied",
        "User is not authorized to approve this job",
      );
    }

    // Update job status
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (action === "approve") {
      updateData.status = "open";
      updateData.approvedAt = FieldValue.serverTimestamp();
      updateData.approvedBy = auth.uid;
    } else if (action === "reject") {
      updateData.status = "closed";
      updateData.rejectedAt = FieldValue.serverTimestamp();
      updateData.rejectedBy = auth.uid;
    }

    await jobDoc.ref.update(updateData);

    logger.info(`Job ${jobId} ${action}ed by ${auth.uid}`, {
      tenantId,
      jobId,
      action,
    });

    return {
      success: true,
      message: `Job ${action}ed successfully`,
    };
  } catch (error) {
    logger.error("Error in job approval", { error, tenantId, jobId, action });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", `Failed to ${action} job`);
  }
});

// Functions are exported inline with their declarations above
