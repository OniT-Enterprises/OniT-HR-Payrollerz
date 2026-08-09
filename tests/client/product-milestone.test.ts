import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'milestone-ref' })),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  setDoc: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { setDoc } from 'firebase/firestore';
import { recordProductMilestone } from '@/services/productMilestoneService';

const mockedSetDoc = vi.mocked(setDoc);

describe('product milestone recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues the immutable write immediately without a read round trip', async () => {
    mockedSetDoc.mockResolvedValue(undefined);

    await recordProductMilestone('tenant-a', 'first_bill_created');

    expect(mockedSetDoc).toHaveBeenCalledOnce();
    expect(mockedSetDoc).toHaveBeenCalledWith(
      { path: 'milestone-ref' },
      {
        milestone: 'first_bill_created',
        schemaVersion: 1,
        reachedAt: 'server-timestamp',
      },
    );
  });

  it('never surfaces a telemetry write failure to the business operation', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedSetDoc.mockRejectedValue(new Error('offline'));

    await expect(
      recordProductMilestone('tenant-a', 'first_bill_created'),
    ).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledOnce();

    warning.mockRestore();
  });
});
