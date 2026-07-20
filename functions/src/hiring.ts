import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  requireAuth,
  requireTenantMember,
  requireTenantRoles,
} from "./authz";

const db = getFirestore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
  const auth = requireAuth(request);
  const { data } = request;

  const { tenantId, offerId, employeeId } = data;

  if (!tenantId || !offerId || !employeeId) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required parameters: tenantId, offerId, employeeId",
    );
  }

  await requireTenantRoles(
    tenantId,
    auth.uid,
    ["owner", "hr-admin"],
    "Only tenant owners or HR admins can accept offers",
  );

  // Contract id is DETERMINISTIC per offer, and the whole accept runs in a
  // transaction that re-reads the offer and only proceeds while it is still
  // 'sent'. Together these make accept idempotent: a double-click / retry either
  // hits the same contract doc or sees 'accepted' and stops — never two
  // contracts (the old code generated a fresh ULID inside a non-atomic batch).
  const contractId = `offer_${offerId}`;
  const snapshotIdRef = { value: "" };

  try {
    await db.runTransaction(async (tx) => {
      const offerRef = db.doc(`tenants/${tenantId}/offers/${offerId}`);
      const offerDoc = await tx.get(offerRef);
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

      // ── all reads first (Firestore transaction requirement) ──
      const positionDoc = await tx.get(
        db.doc(`tenants/${tenantId}/positions/${offer.positionId}`),
      );
      if (!positionDoc.exists) {
        throw new HttpsError("not-found", "Position not found");
      }
      const position = { id: positionDoc.id, ...positionDoc.data() };

      const candidateRef = db.doc(
        `tenants/${tenantId}/candidates/${offer.candidateId}`,
      );
      const candidateDoc = await tx.get(candidateRef);
      const employeeRef = db.doc(`tenants/${tenantId}/employees/${employeeId}`);
      const employeeDoc = await tx.get(employeeRef);

      // ── writes ──
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
      tx.set(db.doc(`tenants/${tenantId}/contracts/${contractId}`), contractData);

      const snapshotId = `${employeeId}_${getISODateString(offer.terms.startDate)}`;
      snapshotIdRef.value = snapshotId;
      tx.set(db.doc(`tenants/${tenantId}/employmentSnapshots/${snapshotId}`), {
        employeeId,
        position,
        contract: { id: contractId, ...contractData },
        asOf: offer.terms.startDate,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(offerRef, {
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedBy: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (candidateDoc.exists) {
        tx.update(candidateRef, {
          stage: "hired",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (employeeDoc.exists) {
        tx.update(employeeRef, {
          status: "active",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    const snapshotId = snapshotIdRef.value;

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
  const auth = requireAuth(request);
  const { data } = request;

  const { tenantId, employeeId, positionId, contractChanges, effectiveDate } =
    data;

  if (!tenantId || !employeeId || !positionId || !effectiveDate) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  await requireTenantRoles(
    tenantId,
    auth.uid,
    ["owner", "hr-admin"],
    "Only tenant owners or HR admins can create employment snapshots",
  );

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
  const auth = requireAuth(request);
  const { data } = request;

  const { tenantId, jobId, action } = data; // action: 'approve' | 'reject'

  if (!tenantId || !jobId || !action) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  await requireTenantMember(tenantId, auth.uid);

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

/**
 * Confirmation email when a public job application lands. Runs server-side
 * because public applicants are unauthenticated and cannot write to the
 * mail queue themselves. Sends only to the applicant's own address.
 */
export const sendApplicationReceivedEmail = onDocumentCreated(
  "jobApplications/{applicationId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const email = (data.email as string | undefined)?.trim();
    if (!email) return;

    const tenantId = (data.tenantId as string | undefined) ?? undefined;
    const name = (data.name as string) || "there";
    const jobTitle = (data.jobTitle as string) || "the position";

    let company = "the company";
    if (tenantId) {
      try {
        const tenantSnap = await getFirestore().doc(`tenants/${tenantId}`).get();
        company = (tenantSnap.data()?.name as string) || company;
      } catch (error) {
        logger.warn("Could not resolve tenant name for application email", { tenantId, error });
      }
    }

    try {
      await getFirestore().collection("mail").add({
        tenantId: tenantId ?? "platform",
        to: [email],
        subject: `We received your application — ${jobTitle} at ${company}`,
        text: [
          `Dear ${name},`,
          "",
          `Thank you for applying for ${jobTitle} at ${company}. Your application has been received and will be reviewed by the hiring team. We will contact you about the outcome.`,
          "",
          `Obrigadu ba ita-nia aplikasaun ba ${jobTitle} iha ${company}. Ami simu ona no sei revee. Ami sei kontaktu ita kona-ba rezultadu.`,
          "",
          `— ${company} (sent via Xefe)`,
        ].join("\n"),
        status: "pending",
        purpose: "application-received",
        relatedId: event.params.applicationId,
        createdAt: FieldValue.serverTimestamp(),
      });
      logger.info("Application-received email queued", {
        applicationId: event.params.applicationId,
        tenantId,
      });
    } catch (error) {
      logger.error("Failed to queue application-received email", {
        applicationId: event.params.applicationId,
        error,
      });
    }
  },
);

// Functions are exported inline with their declarations above
