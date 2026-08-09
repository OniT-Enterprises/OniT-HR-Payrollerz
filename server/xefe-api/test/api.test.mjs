/**
 * Xefe API tests: authentication + tenant scoping + a data endpoint.
 *
 * Runs against the Firestore emulator (no credentials, no external deps —
 * node:test + fetch). From the repo root:
 *
 *   npm run test:api
 *
 * which wraps this in `firebase emulators:exec --only firestore`.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createRequire } from "node:module";

process.env.FIRESTORE_EMULATOR_HOST ||= "localhost:8081";
process.env.FIREBASE_PROJECT_ID = "xefe-api-test";
process.env.API_KEY = "test-api-key";
process.env.ALLOWED_TENANT_ID = "tenant-a";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { app } = require("../index.js");

let server;
let baseUrl;

const get = (path, headers = {}) => fetch(`${baseUrl}${path}`, { headers });
const request = (path, method, body) => fetch(`${baseUrl}${path}`, {
  method,
  headers: {
    "x-api-key": "test-api-key",
    "content-type": "application/json",
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const disabledPayrollMutation = {
  success: false,
  code: "LEGACY_PAYROLL_MUTATION_DISABLED",
  retryable: false,
  message: "Legacy payroll mutations are disabled. Use the canonical Xefe payroll workflow.",
};

describe("xefe-api", () => {
  before(async () => {
    const db = admin.firestore();
    await db.doc("tenants/tenant-a").set({ id: "tenant-a", name: "Tenant A" });
    await db.doc("tenants/tenant-a/employees/emp-1").set({
      status: "active",
      personalInfo: { firstName: "Maria", lastName: "Ximenes" },
      jobDetails: { departmentId: "ops", position: "Barista", salary: 600 },
    });
    await db.doc("tenants/tenant-a/payruns/202608").set({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      payDate: "2026-08-31",
      status: "processing",
    });
    await db.doc("tenants/tenant-a/payrollRuns/legacy-draft").set({
      status: "draft",
      createdBy: "creator@example.com",
    });
    await db.doc("tenants/tenant-a/payrollRuns/legacy-approved").set({
      status: "approved",
      createdBy: "creator@example.com",
    });
    await db.doc("tenants/tenant-a/payrollRuns/legacy-writing").set({
      status: "writing_records",
      expectedRecordCount: 1,
      createdBy: "creator@example.com",
    });
    await db.doc("tenants/tenant-a/payrollRecords/sentinel").set({
      payrollRunId: "unrelated-run",
      netPay: 500,
    });
    await db.doc("tenants/tenant-b").set({ id: "tenant-b", name: "Tenant B" });
    await db.doc("tenants/tenant-b/employees/emp-9").set({
      status: "active",
      personalInfo: { firstName: "Secret", lastName: "Person" },
      jobDetails: { departmentId: "ops", position: "CEO" },
    });
    await db.doc("leave_requests/leave-a").set({
      tenantId: "tenant-a",
      employeeId: "emp-1",
      employeeName: "Maria Ximenes",
      departmentId: "ops",
      status: "pending",
      requestDate: "2026-07-18",
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      duration: 1,
    });
    await db.doc("leave_requests/leave-b").set({
      tenantId: "tenant-b",
      employeeId: "emp-9",
      employeeName: "Secret Person",
      departmentId: "ops",
      status: "pending",
      requestDate: "2026-07-18",
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      duration: 1,
    });
    await db.doc("attendance/attendance-a").set({
      tenantId: "tenant-a",
      employeeId: "emp-1",
      employeeName: "Maria Ximenes",
      departmentId: "ops",
      date: "2026-07-18",
      status: "present",
    });
    await db.doc("attendance/attendance-b").set({
      tenantId: "tenant-b",
      employeeId: "emp-9",
      employeeName: "Secret Person",
      departmentId: "ops",
      date: "2026-07-18",
      status: "present",
    });

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await Promise.all(admin.apps.map((a) => a?.delete()));
  });

  it("health endpoint answers without a key", async () => {
    const res = await get("/api/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.firebase, true);
  });

  it("rejects data requests without an API key", async () => {
    const res = await get("/api/tenants/tenant-a/employees");
    assert.equal(res.status, 401);
  });

  it("rejects a wrong API key", async () => {
    const res = await get("/api/tenants/tenant-a/employees", {
      "x-api-key": "wrong-key",
    });
    assert.equal(res.status, 401);
  });

  it("scopes the key to its allowed tenant", async () => {
    const res = await get("/api/tenants/tenant-b/employees", {
      "x-api-key": "test-api-key",
    });
    assert.equal(res.status, 403);
  });

  it("returns tenant data with a valid key on the allowed tenant", async () => {
    const res = await get("/api/tenants/tenant-a/employees", {
      "x-api-key": "test-api-key",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const names = JSON.stringify(body.data ?? body.employees ?? body);
    assert.match(names, /Ximenes/);
    assert.doesNotMatch(names, /Secret Person/);
  });

  it("preserves canonical payroll reads and the calculation-only preview", async () => {
    const runsResponse = await get("/api/tenants/tenant-a/payroll/runs", {
      "x-api-key": "test-api-key",
    });
    assert.equal(runsResponse.status, 200);
    const runsBody = await runsResponse.json();
    assert.equal(runsBody.runs[0].id, "202608");

    const legacyRuns = admin.firestore().collection("tenants/tenant-a/payrollRuns");
    const legacyRecords = admin.firestore().collection("tenants/tenant-a/payrollRecords");
    const beforeRunCount = (await legacyRuns.get()).size;
    const beforeRecordCount = (await legacyRecords.get()).size;

    const previewResponse = await request(
      "/api/tenants/tenant-a/payroll/calculate",
      "POST",
      {
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        payDate: "2026-08-31",
      },
    );
    assert.equal(previewResponse.status, 200);
    const previewBody = await previewResponse.json();
    assert.equal(previewBody.success, true);
    assert.equal(previewBody.summary.employeeCount, 1);
    assert.equal((await legacyRuns.get()).size, beforeRunCount);
    assert.equal((await legacyRecords.get()).size, beforeRecordCount);
  });

  it("fails every legacy payroll mutation closed without writing or bypassing status", async () => {
    const db = admin.firestore();
    const legacyRuns = db.collection("tenants/tenant-a/payrollRuns");
    const legacyRecords = db.collection("tenants/tenant-a/payrollRecords");
    const auditLogs = db.collection("tenants/tenant-a/auditLogs");
    const beforeRunCount = (await legacyRuns.get()).size;
    const beforeRecordCount = (await legacyRecords.get()).size;
    const beforeAuditCount = (await auditLogs.get()).size;

    const mutations = [
      {
        path: "/api/tenants/tenant-a/payroll/runs",
        method: "POST",
        body: {
          payrollRun: {
            periodStart: "2026-09-01",
            periodEnd: "2026-09-30",
            payDate: "2026-09-30",
            status: "approved",
          },
          records: [{ employeeId: "emp-1", netPay: 999999 }],
          createdBy: "bot",
        },
      },
      {
        path: "/api/tenants/tenant-a/payroll/runs/legacy-draft/approve",
        method: "PUT",
        body: { approvedBy: "different-user@example.com" },
      },
      {
        path: "/api/tenants/tenant-a/payroll/runs/legacy-draft/reject",
        method: "PUT",
        body: { rejectedBy: "bot", reason: "unsafe legacy transition" },
      },
      {
        path: "/api/tenants/tenant-a/payroll/runs/legacy-approved/mark-paid",
        method: "PUT",
        body: { paidBy: "bot" },
      },
      {
        path: "/api/tenants/tenant-a/payroll/runs/legacy-writing/repair",
        method: "POST",
        body: {},
      },
    ];

    for (const mutation of mutations) {
      const response = await request(mutation.path, mutation.method, mutation.body);
      assert.equal(response.status, 503, mutation.path);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), disabledPayrollMutation);
    }

    assert.equal((await legacyRuns.get()).size, beforeRunCount);
    assert.equal((await legacyRecords.get()).size, beforeRecordCount);
    assert.equal((await auditLogs.get()).size, beforeAuditCount);
    assert.equal((await legacyRuns.doc("legacy-draft").get()).data()?.status, "draft");
    const approved = await legacyRuns.doc("legacy-approved").get();
    assert.equal(approved.data()?.status, "approved");
    assert.equal(approved.data()?.paidAt, undefined);
    assert.equal((await legacyRuns.doc("legacy-writing").get()).data()?.status, "writing_records");
  });

  it("reads canonical leave and attendance records without crossing tenants", async () => {
    const leaveResponse = await get("/api/tenants/tenant-a/leave/requests", {
      "x-api-key": "test-api-key",
    });
    assert.equal(leaveResponse.status, 200);
    const leaveBody = await leaveResponse.json();
    assert.match(JSON.stringify(leaveBody), /Maria Ximenes/);
    assert.doesNotMatch(JSON.stringify(leaveBody), /Secret Person/);

    const attendanceResponse = await get(
      "/api/tenants/tenant-a/attendance/daily?date=2026-07-18",
      { "x-api-key": "test-api-key" },
    );
    assert.equal(attendanceResponse.status, 200);
    const attendanceBody = await attendanceResponse.json();
    assert.match(JSON.stringify(attendanceBody), /Maria Ximenes/);
    assert.doesNotMatch(JSON.stringify(attendanceBody), /Secret Person/);
  });

  it("creates canonical leave with working-day duration and department scope", async () => {
    const response = await request("/api/tenants/tenant-a/leave/requests", "POST", {
      employeeId: "emp-1",
      leaveType: "annual",
      startDate: "2026-07-17",
      endDate: "2026-07-19",
      reason: "Family appointment",
      requestedBy: "api-test",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.duration, 1);

    const created = await admin.firestore().doc(`leave_requests/${body.id}`).get();
    assert.equal(created.data()?.tenantId, "tenant-a");
    assert.equal(created.data()?.departmentId, "ops");
    assert.equal(created.data()?.status, "pending");
  });

  it("excludes officially announced 2026 holidays from leave duration", async () => {
    const response = await request("/api/tenants/tenant-a/leave/requests", "POST", {
      employeeId: "emp-1",
      leaveType: "annual",
      startDate: "2026-03-20",
      endDate: "2026-03-23",
      reason: "Family observance",
      requestedBy: "api-test",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.duration, 1);
  });

  it("stores night hours for overnight attendance created through the API", async () => {
    const db = admin.firestore();
    await db.doc("tenants/tenant-a/shifts/night-api-test").set({
      tenantId: "tenant-a",
      employeeId: "emp-1",
      date: "2026-08-10",
      startTime: "22:00",
      endTime: "06:00",
      status: "published",
    });

    const response = await request("/api/tenants/tenant-a/attendance", "POST", {
      employeeId: "emp-1",
      date: "2026-08-10",
      clockIn: "22:00",
      clockOut: "06:00",
      recordedBy: "api-test",
    });
    assert.equal(response.status, 200);
    const body = await response.json();

    const created = await db.doc(`attendance/${body.id}`).get();
    assert.equal(created.data()?.totalHours, 7);
    assert.equal(created.data()?.nightHours, 7);
    assert.equal(created.data()?.lateMinutes, 0);
    assert.equal(created.data()?.earlyDepartureMinutes, 0);
  });

  it("uses only published schedules and calculates lateness across midnight", async () => {
    const db = admin.firestore();
    const date = "2026-08-11";
    await Promise.all([
      db.doc("tenants/tenant-a/shifts/a-cancelled-api-test").set({
        tenantId: "tenant-a", employeeId: "emp-1", date,
        startTime: "08:00", endTime: "17:00", status: "cancelled",
      }),
      db.doc("tenants/tenant-a/shifts/b-draft-api-test").set({
        tenantId: "tenant-a", employeeId: "emp-1", date,
        startTime: "20:00", endTime: "04:00", status: "draft",
      }),
      db.doc("tenants/tenant-a/shifts/z-published-api-test").set({
        tenantId: "tenant-a", employeeId: "emp-1", date,
        startTime: "22:00", endTime: "06:00", status: "published",
      }),
    ]);

    const response = await request("/api/tenants/tenant-a/attendance", "POST", {
      employeeId: "emp-1",
      date,
      clockIn: "00:30",
      clockOut: "06:00",
      recordedBy: "api-test",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    const created = await db.doc(`attendance/${body.id}`).get();
    assert.equal(created.data()?.lateMinutes, 150);
    assert.equal(created.data()?.earlyDepartureMinutes, 0);
  });

  it("calculates an early clock-out on the start night", async () => {
    const db = admin.firestore();
    const date = "2026-08-12";
    await db.doc("tenants/tenant-a/shifts/night-early-api-test").set({
      tenantId: "tenant-a", employeeId: "emp-1", date,
      startTime: "22:00", endTime: "06:00", status: "confirmed",
    });
    const response = await request("/api/tenants/tenant-a/attendance", "POST", {
      employeeId: "emp-1",
      date,
      clockIn: "22:00",
      clockOut: "23:00",
      recordedBy: "api-test",
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    const created = await db.doc(`attendance/${body.id}`).get();
    assert.equal(created.data()?.earlyDepartureMinutes, 420);
  });

  it("rejects impossible attendance calendar dates", async () => {
    const response = await request("/api/tenants/tenant-a/attendance", "POST", {
      employeeId: "emp-1",
      date: "2026-99-99",
      clockIn: "08:00",
      clockOut: "17:00",
    });
    assert.equal(response.status, 400);
  });

  it("never approves a leave request belonging to another tenant", async () => {
    const response = await request(
      "/api/tenants/tenant-a/leave/requests/leave-b/approve",
      "PUT",
      { approvedBy: "api-test" },
    );
    assert.equal(response.status, 404);
  });
});
