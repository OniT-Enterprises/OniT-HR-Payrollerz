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
});
