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

describe("xefe-api", () => {
  before(async () => {
    const db = admin.firestore();
    await db.doc("tenants/tenant-a").set({ id: "tenant-a", name: "Tenant A" });
    await db.doc("tenants/tenant-a/employees/emp-1").set({
      status: "active",
      personalInfo: { firstName: "Maria", lastName: "Ximenes" },
      jobDetails: { departmentId: "ops", position: "Barista" },
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

  it("never approves a leave request belonging to another tenant", async () => {
    const response = await request(
      "/api/tenants/tenant-a/leave/requests/leave-b/approve",
      "PUT",
      { approvedBy: "api-test" },
    );
    assert.equal(response.status, 404);
  });
});
