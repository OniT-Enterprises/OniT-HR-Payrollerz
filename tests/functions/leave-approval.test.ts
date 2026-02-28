/**
 * Unit Tests: Leave Approval Function
 *
 * Tests the leave approval logic including paid vs unpaid leave handling,
 * balance updates, and shift cancellations.
 */

import { describe, test, expect, beforeEach, jest } from "@jest/globals";

// Mock Firebase modules (similar to timesheet test setup)
const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
  batch: jest.fn(),
};

const mockCollection = {
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  get: jest.fn(),
};

const mockDoc = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  ref: {},
};

const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  commit: jest.fn(),
};

const mockQuerySnapshot = {
  docs: [],
  empty: true,
};

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockFirestore,
  FieldValue: {
    serverTimestamp: () => ({ _methodName: "FieldValue.serverTimestamp" }),
    arrayUnion: (value: unknown) => ({
      _methodName: "FieldValue.arrayUnion",
      _elements: [value],
    }),
    increment: (value: number) => ({
      _methodName: "FieldValue.increment",
      _operand: value,
    }),
  },
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: jest.fn().mockResolvedValue({
      customClaims: { tenants: ["test-tenant"] },
    }),
  }),
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = "HttpsError";
    }
  },
}));

// Import the function under test
import { approveLeaveRequest } from "../../functions/src/timeleave";

// Test constants
const TENANT_ID = "test-tenant";
const USER_ID = "approver-123";
const EMPLOYEE_ID = "emp-456";
const REQUEST_ID = "leave-req-789";

describe("Leave Approval Function", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockFirestore.collection.mockReturnValue(mockCollection);
    mockFirestore.doc.mockReturnValue(mockDoc);
    mockFirestore.batch.mockReturnValue(mockBatch);
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.limit.mockReturnValue(mockCollection);
    mockCollection.get.mockReturnValue(mockQuerySnapshot);
    mockBatch.commit.mockResolvedValue(undefined);
    mockBatch.update.mockReturnValue(mockBatch);
  });

  describe("Authentication and Authorization", () => {
    test("requires authenticated user", async () => {
      const request = {
        auth: null,
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).rejects.toThrow("User must be authenticated");
    });

    test("validates tenant access", async () => {
      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).resolves.toBeDefined();
    });

    test("requires valid parameters", async () => {
      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          // Missing requestId and approved
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).rejects.toThrow("Missing required parameters");
    });
  });

  describe("Leave Request Validation", () => {
    test("fails when leave request not found", async () => {
      mockDoc.get.mockResolvedValueOnce({
        exists: false,
      });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).rejects.toThrow("Leave request not found");
    });

    test("fails when leave request not in pending status", async () => {
      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          empId: EMPLOYEE_ID,
          status: "approved", // Already approved
          from: { toDate: () => new Date("2024-02-01") },
          to: { toDate: () => new Date("2024-02-03") },
          type: "vacation",
        }),
      });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).rejects.toThrow(
        "Leave request is not in pending status",
      );
    });
  });

  describe("Leave Approval Logic", () => {
    test("successfully approves leave request", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-02-01") },
        to: { toDate: () => new Date("2024-02-03") }, // 3 days
      };

      // Mock leave request
      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      // Mock existing leave balance
      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          empId: EMPLOYEE_ID,
          year: 2024,
          openingDays: 20,
          movements: [],
          computedBalance: 20,
        }),
      });

      // Mock no overlapping shifts (empty collections)
      mockCollection.get
        .mockResolvedValueOnce({ docs: [] }) // First month roster
        .mockResolvedValueOnce({ docs: [] }); // Second month roster (if needed)

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
          note: "Approved for vacation",
        },
      };

      const result = await approveLeaveRequest.handler(request);

      expect(result).toEqual({
        success: true,
        message: "Leave request approved successfully",
      });

      // Verify leave request was updated
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockDoc.ref,
        expect.objectContaining({
          status: "approved",
          approvedBy: USER_ID,
          approverNote: "Approved for vacation",
        }),
      );

      // Verify leave balance was updated
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          movements: expect.objectContaining({
            _methodName: "FieldValue.arrayUnion",
            _elements: [
              expect.objectContaining({
                type: "usage",
                days: -3,
                reason: `Leave request ${REQUEST_ID} approved`,
              }),
            ],
          }),
          computedBalance: expect.objectContaining({
            _methodName: "FieldValue.increment",
            _operand: -3,
          }),
        }),
      );
    });

    test("successfully rejects leave request", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-02-01") },
        to: { toDate: () => new Date("2024-02-03") },
      };

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: false,
          note: "Insufficient balance",
        },
      };

      const result = await approveLeaveRequest.handler(request);

      expect(result).toEqual({
        success: true,
        message: "Leave request rejected successfully",
      });

      // Verify leave request was updated with rejection
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockDoc.ref,
        expect.objectContaining({
          status: "rejected",
          approvedBy: USER_ID,
          approverNote: "Insufficient balance",
        }),
      );

      // Should not update leave balance for rejected requests
      expect(mockBatch.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("Leave Balance Updates", () => {
    test("updates leave balance correctly for different leave types", async () => {
      const testCases = [
        {
          type: "vacation",
          shouldUpdateBalance: true,
          description: "vacation leave",
        },
        {
          type: "sick",
          shouldUpdateBalance: true,
          description: "sick leave",
        },
        {
          type: "personal",
          shouldUpdateBalance: true,
          description: "personal leave",
        },
        {
          type: "unpaid",
          shouldUpdateBalance: false,
          description: "unpaid leave",
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const leaveRequest = {
          empId: EMPLOYEE_ID,
          status: "pending",
          type: testCase.type,
          from: { toDate: () => new Date("2024-02-01") },
          to: { toDate: () => new Date("2024-02-05") }, // 5 days
        };

        mockDoc.get.mockResolvedValueOnce({
          exists: true,
          data: () => leaveRequest,
        });

        if (testCase.shouldUpdateBalance) {
          mockDoc.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({
              empId: EMPLOYEE_ID,
              year: 2024,
              computedBalance: 15,
            }),
          });
        }

        mockCollection.get
          .mockResolvedValueOnce({ docs: [] })
          .mockResolvedValueOnce({ docs: [] });

        const request = {
          auth: { uid: USER_ID },
          data: {
            tenantId: TENANT_ID,
            requestId: REQUEST_ID,
            approved: true,
          },
        };

        await approveLeaveRequest.handler(request);

        if (testCase.shouldUpdateBalance) {
          expect(mockBatch.update).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
              computedBalance: expect.objectContaining({
                _methodName: "FieldValue.increment",
                _operand: -5,
              }),
            }),
          );
        }
      }
    });

    test("handles missing leave balance document", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-02-01") },
        to: { toDate: () => new Date("2024-02-02") },
      };

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      // Mock missing balance document
      mockDoc.get.mockResolvedValueOnce({
        exists: false,
      });

      mockCollection.get
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = await approveLeaveRequest.handler(request);

      // Should still succeed even without balance document
      expect(result.success).toBe(true);

      // Should update leave request status
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockDoc.ref,
        expect.objectContaining({
          status: "approved",
        }),
      );
    });
  });

  describe("Shift Cancellation", () => {
    test("cancels overlapping shifts when leave is approved", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-02-01") },
        to: { toDate: () => new Date("2024-02-03") },
      };

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ computedBalance: 10 }),
      });

      // Mock overlapping shifts
      const overlappingShifts = [
        {
          id: "shift1",
          employeeId: EMPLOYEE_ID,
          date: "2024-02-01",
          start: "09:00",
          end: "17:00",
        },
        {
          id: "shift2",
          employeeId: EMPLOYEE_ID,
          date: "2024-02-02",
          start: "09:00",
          end: "17:00",
        },
      ];

      mockCollection.get.mockResolvedValueOnce({
        docs: overlappingShifts.map((shift) => ({
          data: () => shift,
          ref: { id: shift.id },
        })),
      });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      await approveLeaveRequest.handler(request);

      // Verify shifts were cancelled
      expect(mockBatch.update).toHaveBeenCalledWith(
        { id: "shift1" },
        expect.objectContaining({
          status: "cancelled",
          cancelReason: `Leave request ${REQUEST_ID} approved`,
        }),
      );

      expect(mockBatch.update).toHaveBeenCalledWith(
        { id: "shift2" },
        expect.objectContaining({
          status: "cancelled",
          cancelReason: `Leave request ${REQUEST_ID} approved`,
        }),
      );
    });

    test("handles shifts spanning multiple months", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-01-30") }, // End of January
        to: { toDate: () => new Date("2024-02-02") }, // Start of February
      };

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ computedBalance: 10 }),
      });

      // Mock shifts from both months
      const januaryShifts = [
        {
          id: "jan-shift",
          employeeId: EMPLOYEE_ID,
          date: "2024-01-30",
        },
      ];

      const februaryShifts = [
        {
          id: "feb-shift",
          employeeId: EMPLOYEE_ID,
          date: "2024-02-01",
        },
      ];

      mockCollection.get
        .mockResolvedValueOnce({
          docs: januaryShifts.map((shift) => ({
            data: () => shift,
            ref: { id: shift.id },
          })),
        })
        .mockResolvedValueOnce({
          docs: februaryShifts.map((shift) => ({
            data: () => shift,
            ref: { id: shift.id },
          })),
        });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      await approveLeaveRequest.handler(request);

      // Should cancel shifts from both months
      expect(mockBatch.update).toHaveBeenCalledWith(
        { id: "jan-shift" },
        expect.objectContaining({ status: "cancelled" }),
      );

      expect(mockBatch.update).toHaveBeenCalledWith(
        { id: "feb-shift" },
        expect.objectContaining({ status: "cancelled" }),
      );
    });

    test("does not cancel shifts when leave is rejected", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-02-01") },
        to: { toDate: () => new Date("2024-02-03") },
      };

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: false, // Rejected
        },
      };

      await approveLeaveRequest.handler(request);

      // Should only update the leave request, not cancel any shifts
      expect(mockBatch.update).toHaveBeenCalledTimes(1);
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockDoc.ref,
        expect.objectContaining({
          status: "rejected",
        }),
      );
    });
  });

  describe("Leave Type Classification", () => {
    test("correctly identifies paid leave types", async () => {
      const paidLeaveTypes = [
        "vacation",
        "sick",
        "personal",
        "maternity",
        "paternity",
      ];

      for (const leaveType of paidLeaveTypes) {
        jest.clearAllMocks();

        const leaveRequest = {
          empId: EMPLOYEE_ID,
          status: "pending",
          type: leaveType,
          from: { toDate: () => new Date("2024-02-01") },
          to: { toDate: () => new Date("2024-02-01") }, // 1 day
        };

        mockDoc.get.mockResolvedValueOnce({
          exists: true,
          data: () => leaveRequest,
        });

        mockDoc.get.mockResolvedValueOnce({
          exists: true,
          data: () => ({ computedBalance: 10 }),
        });

        mockCollection.get.mockResolvedValueOnce({ docs: [] });

        const request = {
          auth: { uid: USER_ID },
          data: {
            tenantId: TENANT_ID,
            requestId: REQUEST_ID,
            approved: true,
          },
        };

        await approveLeaveRequest.handler(request);

        // Should update balance for paid leave types
        expect(mockBatch.update).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            computedBalance: expect.objectContaining({
              _methodName: "FieldValue.increment",
              _operand: -1,
            }),
          }),
        );
      }
    });

    test("does not update balance for unpaid leave types", async () => {
      const unpaidLeaveTypes = ["unpaid"];

      for (const leaveType of unpaidLeaveTypes) {
        jest.clearAllMocks();

        const leaveRequest = {
          empId: EMPLOYEE_ID,
          status: "pending",
          type: leaveType,
          from: { toDate: () => new Date("2024-02-01") },
          to: { toDate: () => new Date("2024-02-01") },
        };

        mockDoc.get.mockResolvedValueOnce({
          exists: true,
          data: () => leaveRequest,
        });

        mockCollection.get.mockResolvedValueOnce({ docs: [] });

        const request = {
          auth: { uid: USER_ID },
          data: {
            tenantId: TENANT_ID,
            requestId: REQUEST_ID,
            approved: true,
          },
        };

        await approveLeaveRequest.handler(request);

        // Should only update leave request status, not balance
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
        expect(mockBatch.update).toHaveBeenCalledWith(
          mockDoc.ref,
          expect.objectContaining({
            status: "approved",
          }),
        );
      }
    });
  });

  describe("Error Handling", () => {
    test("handles Firestore errors gracefully", async () => {
      mockDoc.get.mockRejectedValueOnce(
        new Error("Firestore connection failed"),
      );

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).rejects.toThrow("Failed to approve leave request");
    });

    test("handles batch commit failures", async () => {
      const leaveRequest = {
        empId: EMPLOYEE_ID,
        status: "pending",
        type: "vacation",
        from: { toDate: () => new Date("2024-02-01") },
        to: { toDate: () => new Date("2024-02-01") },
      };

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => leaveRequest,
      });

      mockDoc.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ computedBalance: 10 }),
      });

      mockCollection.get.mockResolvedValueOnce({ docs: [] });

      // Mock batch commit failure
      mockBatch.commit.mockRejectedValueOnce(new Error("Batch commit failed"));

      const request = {
        auth: { uid: USER_ID },
        data: {
          tenantId: TENANT_ID,
          requestId: REQUEST_ID,
          approved: true,
        },
      };

      const result = approveLeaveRequest.handler(request);
      await expect(result).rejects.toThrow("Failed to approve leave request");
    });
  });
});
