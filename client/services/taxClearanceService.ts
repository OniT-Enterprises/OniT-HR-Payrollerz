import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { paths } from '@/lib/paths';
import {
  validateTaxClearanceIssued,
  validateTaxClearanceRequest,
  type TaxClearanceIssuedInput,
  type TaxClearanceRequest,
  type TaxClearanceRequestInput,
} from '@/lib/tax/tax-clearance-tl';

function mapRequest(id: string, data: Record<string, unknown>): TaxClearanceRequest {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(0);
  const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : createdAt;
  return {
    id,
    purpose: data.purpose as TaxClearanceRequest['purpose'],
    requestedDate: String(data.requestedDate || ''),
    status: data.status as TaxClearanceRequest['status'],
    ...(typeof data.issuedDate === 'string' ? { issuedDate: data.issuedDate } : {}),
    ...(typeof data.expiryDate === 'string' ? { expiryDate: data.expiryDate } : {}),
    ...(typeof data.certificateNumber === 'string' ? { certificateNumber: data.certificateNumber } : {}),
    ...(typeof data.certificateUrl === 'string' ? { certificateUrl: data.certificateUrl } : {}),
    ...(typeof data.rejectionReason === 'string' ? { rejectionReason: data.rejectionReason } : {}),
    ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
    createdBy: String(data.createdBy || ''),
    createdAt,
    ...(typeof data.updatedBy === 'string' ? { updatedBy: data.updatedBy } : {}),
    updatedAt,
  };
}

class TaxClearanceService {
  async getAll(tenantId: string): Promise<TaxClearanceRequest[]> {
    const snapshot = await getDocs(query(
      collection(db, paths.taxClearanceRequests(tenantId)),
      orderBy('requestedDate', 'desc'),
    ));
    return snapshot.docs.map((item) => mapRequest(item.id, item.data()));
  }

  async create(
    tenantId: string,
    input: TaxClearanceRequestInput,
    userId: string,
  ): Promise<string> {
    if (!userId.trim()) throw new Error('A signed-in user is required to track a request.');
    const normalized = validateTaxClearanceRequest(input);
    const ref = await addDoc(collection(db, paths.taxClearanceRequests(tenantId)), {
      ...normalized,
      status: 'requested',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async markIssued(
    tenantId: string,
    requestId: string,
    input: TaxClearanceIssuedInput,
    userId: string,
  ): Promise<void> {
    if (!requestId.trim()) throw new Error('A tax-clearance request id is required.');
    if (!userId.trim()) throw new Error('A signed-in user is required to record the result.');
    const requestRef = doc(db, paths.taxClearanceRequest(tenantId, requestId));
    await runTransaction(db, async (transaction) => {
      const currentDoc = await transaction.get(requestRef);
      if (!currentDoc.exists()) throw new Error('Tax-clearance request not found.');
      const current = mapRequest(currentDoc.id, currentDoc.data());
      if (current.status !== 'requested') {
        throw new Error('Only a pending request can be marked issued.');
      }
      const normalized = validateTaxClearanceIssued(current, input);
      transaction.update(requestRef, {
        ...normalized,
        status: 'issued',
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    });
  }

  async markRejected(
    tenantId: string,
    requestId: string,
    reasonInput: string,
    userId: string,
  ): Promise<void> {
    if (!requestId.trim()) throw new Error('A tax-clearance request id is required.');
    if (!userId.trim()) throw new Error('A signed-in user is required to record the result.');
    const reason = reasonInput.trim();
    if (!reason) throw new Error('Record the rejection or failure reason.');
    const requestRef = doc(db, paths.taxClearanceRequest(tenantId, requestId));
    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(requestRef);
      if (!current.exists()) throw new Error('Tax-clearance request not found.');
      if (current.data().status !== 'requested') {
        throw new Error('Only a pending request can be marked rejected.');
      }
      transaction.update(requestRef, {
        status: 'rejected',
        rejectionReason: reason,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    });
  }
}

export const taxClearanceService = new TaxClearanceService();
