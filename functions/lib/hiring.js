"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateJobApproval = exports.onOfferAccepted = exports.createEmploymentSnapshot = exports.acceptOffer = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const authz_1 = require("./authz");
const db = (0, firestore_2.getFirestore)();
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Generates a ULID-like ID for consistent document IDs
 */
function generateULID() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}${randomPart}`.toUpperCase();
}
/**
 * Gets the ISO date string for today
 */
function getISODateString(date = new Date()) {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
}
// ============================================================================
// CALLABLE FUNCTIONS
// ============================================================================
/**
 * Accepts an offer and creates the corresponding contract and employment snapshot
 */
exports.acceptOffer = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId, offerId, employeeId } = data;
    if (!tenantId || !offerId || !employeeId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters: tenantId, offerId, employeeId");
    }
    await (0, authz_1.requireTenantRoles)(tenantId, auth.uid, ["owner", "hr-admin"], "Only tenant owners or HR admins can accept offers");
    const batch = db.batch();
    try {
        // Get the offer
        const offerDoc = await db
            .doc(`tenants/${tenantId}/offers/${offerId}`)
            .get();
        if (!offerDoc.exists) {
            throw new https_1.HttpsError("not-found", "Offer not found");
        }
        const offer = offerDoc.data();
        if (offer.status !== "sent") {
            throw new https_1.HttpsError("failed-precondition", 'Offer must be in "sent" status to be accepted');
        }
        // Get the position
        const positionDoc = await db
            .doc(`tenants/${tenantId}/positions/${offer.positionId}`)
            .get();
        if (!positionDoc.exists) {
            throw new https_1.HttpsError("not-found", "Position not found");
        }
        const position = Object.assign({ id: positionDoc.id }, positionDoc.data());
        // Create contract
        const contractId = generateULID();
        const contractData = {
            employeeId,
            positionId: offer.positionId,
            startDate: offer.terms.startDate,
            endDate: null, // Indefinite contract
            weeklyHours: offer.terms.weeklyHours,
            overtimeRate: offer.terms.overtimeRate || 1.5,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        batch.set(db.doc(`tenants/${tenantId}/contracts/${contractId}`), contractData);
        // Create employment snapshot
        const snapshotId = `${employeeId}_${getISODateString(offer.terms.startDate)}`;
        const snapshotData = {
            employeeId,
            position,
            contract: Object.assign({ id: contractId }, contractData),
            asOf: offer.terms.startDate,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        };
        batch.set(db.doc(`tenants/${tenantId}/employmentSnapshots/${snapshotId}`), snapshotData);
        // Update offer status
        batch.update(offerDoc.ref, {
            status: "accepted",
            acceptedAt: firestore_2.FieldValue.serverTimestamp(),
            acceptedBy: auth.uid,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Update candidate status to 'hired'
        const candidateDoc = await db
            .doc(`tenants/${tenantId}/candidates/${offer.candidateId}`)
            .get();
        if (candidateDoc.exists) {
            batch.update(candidateDoc.ref, {
                stage: "hired",
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        // Update employee status to 'active' if they exist
        const employeeDoc = await db
            .doc(`tenants/${tenantId}/employees/${employeeId}`)
            .get();
        if (employeeDoc.exists) {
            batch.update(employeeDoc.ref, {
                status: "active",
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
        v2_1.logger.info(`Offer ${offerId} accepted, contract ${contractId} and snapshot ${snapshotId} created`, {
            tenantId,
            offerId,
            contractId,
            snapshotId,
            employeeId,
        });
        return {
            success: true,
            contractId,
            snapshotId,
            message: "Offer accepted successfully, contract and employment snapshot created",
        };
    }
    catch (error) {
        v2_1.logger.error("Error accepting offer", {
            error,
            tenantId,
            offerId,
            employeeId,
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to accept offer");
    }
});
/**
 * Creates a new employment snapshot for an existing employee (e.g., promotion, transfer)
 */
exports.createEmploymentSnapshot = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId, employeeId, positionId, contractChanges, effectiveDate } = data;
    if (!tenantId || !employeeId || !positionId || !effectiveDate) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    await (0, authz_1.requireTenantRoles)(tenantId, auth.uid, ["owner", "hr-admin"], "Only tenant owners or HR admins can create employment snapshots");
    try {
        // Get the employee
        const employeeDoc = await db
            .doc(`tenants/${tenantId}/employees/${employeeId}`)
            .get();
        if (!employeeDoc.exists) {
            throw new https_1.HttpsError("not-found", "Employee not found");
        }
        // Get the new position
        const positionDoc = await db
            .doc(`tenants/${tenantId}/positions/${positionId}`)
            .get();
        if (!positionDoc.exists) {
            throw new https_1.HttpsError("not-found", "Position not found");
        }
        const position = Object.assign({ id: positionDoc.id }, positionDoc.data());
        // Get the most recent contract for this employee
        const contractsQuery = await db
            .collection(`tenants/${tenantId}/contracts`)
            .where("employeeId", "==", employeeId)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        if (contractsQuery.empty) {
            throw new https_1.HttpsError("not-found", "No existing contract found for employee");
        }
        const currentContractData = contractsQuery.docs[0].data();
        const currentContract = Object.assign({ id: contractsQuery.docs[0].id }, currentContractData);
        // Create new contract with changes
        const contractId = generateULID();
        const newContractData = {
            employeeId,
            positionId,
            startDate: new Date(effectiveDate),
            endDate: (contractChanges === null || contractChanges === void 0 ? void 0 : contractChanges.endDate)
                ? new Date(contractChanges.endDate)
                : null,
            weeklyHours: (contractChanges === null || contractChanges === void 0 ? void 0 : contractChanges.weeklyHours) || currentContract.weeklyHours,
            overtimeRate: (contractChanges === null || contractChanges === void 0 ? void 0 : contractChanges.overtimeRate) || currentContract.overtimeRate,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        // Create employment snapshot
        const snapshotId = `${employeeId}_${getISODateString(new Date(effectiveDate))}`;
        const snapshotData = {
            employeeId,
            position,
            contract: Object.assign({ id: contractId }, newContractData),
            asOf: new Date(effectiveDate),
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        };
        const batch = db.batch();
        // End the current contract
        if ((contractChanges === null || contractChanges === void 0 ? void 0 : contractChanges.endCurrentContract) !== false) {
            batch.update(db.doc(`tenants/${tenantId}/contracts/${currentContract.id}`), {
                endDate: new Date(effectiveDate),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        // Create new contract
        batch.set(db.doc(`tenants/${tenantId}/contracts/${contractId}`), newContractData);
        // Create new snapshot
        batch.set(db.doc(`tenants/${tenantId}/employmentSnapshots/${snapshotId}`), snapshotData);
        await batch.commit();
        v2_1.logger.info(`Employment snapshot ${snapshotId} created for employee ${employeeId}`, {
            tenantId,
            employeeId,
            contractId,
            snapshotId,
            effectiveDate,
        });
        return {
            success: true,
            contractId,
            snapshotId,
            message: "Employment snapshot created successfully",
        };
    }
    catch (error) {
        v2_1.logger.error("Error creating employment snapshot", {
            error,
            tenantId,
            employeeId,
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Failed to create employment snapshot");
    }
});
// ============================================================================
// FIRESTORE TRIGGERS
// ============================================================================
/**
 * Automatically create employment snapshots when offers are accepted
 */
exports.onOfferAccepted = (0, firestore_1.onDocumentUpdated)("tenants/{tenantId}/offers/{offerId}", async (event) => {
    var _a, _b;
    const { tenantId, offerId } = event.params;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after) {
        v2_1.logger.warn("Missing before/after data in offer update trigger");
        return;
    }
    // Check if offer was just accepted
    if (before.status !== "accepted" && after.status === "accepted") {
        v2_1.logger.info(`Offer ${offerId} was accepted, triggering snapshot creation`, { tenantId, offerId });
        try {
            // This would normally call the acceptOffer function internally
            // For now, we'll just log that the trigger fired
            // In a real implementation, you'd extract the logic from acceptOffer
            // to a shared function that both the callable and trigger can use
            v2_1.logger.info("Offer acceptance trigger completed", {
                tenantId,
                offerId,
            });
        }
        catch (error) {
            v2_1.logger.error("Error in offer acceptance trigger", {
                error,
                tenantId,
                offerId,
            });
        }
    }
});
/**
 * Validate job posting approvals
 */
exports.validateJobApproval = (0, https_1.onCall)(async (request) => {
    const auth = (0, authz_1.requireAuth)(request);
    const { data } = request;
    const { tenantId, jobId, action } = data; // action: 'approve' | 'reject'
    if (!tenantId || !jobId || !action) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters");
    }
    await (0, authz_1.requireTenantMember)(tenantId, auth.uid);
    try {
        // Get the job
        const jobDoc = await db.doc(`tenants/${tenantId}/jobs/${jobId}`).get();
        if (!jobDoc.exists) {
            throw new https_1.HttpsError("not-found", "Job not found");
        }
        const job = jobDoc.data();
        // Check if user is authorized to approve this job
        let canApprove = false;
        if (job.approverMode === "specific" && job.approverId === auth.uid) {
            canApprove = true;
        }
        else if (job.approverMode === "department" && job.approverDepartmentId) {
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
                    const member = memberDoc.data();
                    canApprove = ["owner", "hr-admin", "manager"].includes(member.role);
                }
            }
        }
        if (!canApprove) {
            throw new https_1.HttpsError("permission-denied", "User is not authorized to approve this job");
        }
        // Update job status
        const updateData = {
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        };
        if (action === "approve") {
            updateData.status = "open";
            updateData.approvedAt = firestore_2.FieldValue.serverTimestamp();
            updateData.approvedBy = auth.uid;
        }
        else if (action === "reject") {
            updateData.status = "closed";
            updateData.rejectedAt = firestore_2.FieldValue.serverTimestamp();
            updateData.rejectedBy = auth.uid;
        }
        await jobDoc.ref.update(updateData);
        v2_1.logger.info(`Job ${jobId} ${action}ed by ${auth.uid}`, {
            tenantId,
            jobId,
            action,
        });
        return {
            success: true,
            message: `Job ${action}ed successfully`,
        };
    }
    catch (error) {
        v2_1.logger.error("Error in job approval", { error, tenantId, jobId, action });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Failed to ${action} job`);
    }
});
// Functions are exported inline with their declarations above
//# sourceMappingURL=hiring.js.map