/**
 * A runnable reproduction of a known failure: creating a leave request through
 * the dialog never completes.
 *
 * Marked `fixme`, so it does not fail the suite — but it stays here because the
 * next person to touch leave creation should be able to reproduce this in one
 * command instead of rediscovering it.
 *
 * What is established (2026-08-22):
 *
 *  - The form is valid when Submit is pressed: the dialog shows
 *    "2 working day(s)" and every required field, including the reason, is set.
 *  - The POST to `.../us-central1/createLeaveRequest` IS issued and **never
 *    receives a response** — captured with Playwright's request/response
 *    listeners: one `[req]`, no `[res]`, no `[reqfailed]`. The button spins
 *    past 90 seconds.
 *  - The function is loaded and served: starting the functions emulator by hand
 *    prints `functions[us-central1-createLeaveRequest]: http function
 *    initialized`.
 *  - It is not App Check (no reCAPTCHA key is set, so init returns early), not
 *    a region mismatch (both sides default to us-central1), and not a stale
 *    build (reproduced with a freshly started emulator).
 *  - Callables work in this harness in general: `recordTenantAuditEvent` is a
 *    callable and full-workflow.spec.ts asserts on its written audit events.
 *
 * So something inside THIS function does not return. The first suspects are the
 * two awaits that touch Firestore in ways nothing else here does:
 * `calculateCanonicalLeaveDuration`, and the overlap transaction that calls
 * `transaction.get(query)` on `leave_requests`.
 *
 * Whether a real user is affected is NOT established — production runs a real
 * Cloud Function against real Firestore, which is a different environment. Do
 * not quote this as a production defect until it is reproduced there.
 */
import { expect, test } from "@playwright/test";
import { pickNthDate } from "./helpers/datePicker";
import {
  closeAdmin,
  findTenantIdByName,
  markSetupComplete,
  seedEmployees,
  waitForEmulators,
} from "./helpers/admin";
import { getTLPublicHolidays } from "../../client/lib/payroll/tl-holidays";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Probe Co ${stamp}`;
const OWNER = {
  email: `probe-${stamp}@e2e.test`,
  password: "e2e-Password-5",
};
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dili" }).format(
  new Date(),
);
const [START, END] = (() => {
  const month = TODAY.slice(0, 7);
  const holidays = new Set(
    getTLPublicHolidays(Number(TODAY.slice(0, 4))).map((h) => h.date),
  );
  const ok = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return d !== 0 && d !== 6 && !holidays.has(iso);
  };
  for (let day = 2; day <= 26; day += 1) {
    const a = `${month}-${String(day).padStart(2, "0")}`;
    const b = `${month}-${String(day + 1).padStart(2, "0")}`;
    if (ok(a) && ok(b)) return [a, b];
  }
  throw new Error("no working days");
})();

test.beforeAll(async () => { await waitForEmulators(); });
test.afterAll(async () => { await closeAdmin(); });

test.fixme("creating a leave request completes", async ({ page }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text());
  });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("request", (r) => {
    if (/createLeaveRequest|:5001/.test(r.url())) console.log("[req]", r.method(), r.url());
  });
  page.on("response", async (r) => {
    if (/createLeaveRequest|:5001/.test(r.url())) {
      console.log("[res]", r.status(), r.url(), (await r.text().catch(() => "")).slice(0, 300));
    }
  });
  page.on("requestfailed", (r) => {
    if (/createLeaveRequest|:5001/.test(r.url()))
      console.log("[reqfailed]", r.url(), r.failure()?.errorText);
  });

  await page.addInitScript(() =>
    window.localStorage.setItem("onit:locale", "en"),
  );
  await page.goto("/auth/signup");
  await page.getByLabel(/full name/i).fill("Probe Owner");
  await page.getByLabel(/work email/i).fill(OWNER.email);
  await page.getByLabel(/^password$/i).fill(OWNER.password);
  await page.getByLabel(/confirm password/i).fill(OWNER.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page.getByText(COMPANY).first()).toBeVisible({ timeout: 30_000 });

  const tenantId = await findTenantIdByName(COMPANY);
  await markSetupComplete(tenantId);
  await seedEmployees(tenantId, [{ ref: "probeworker", monthlySalary: 500 }]);

  await page.goto("/time-leave/leave");
  await page.getByRole("button", { name: /new request/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /worker/i }).first().click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: /annual/i }).first().click();
  await pickNthDate(page, dialog, 0, START);
  await pickNthDate(page, dialog, 1, END);
  await dialog.getByLabel(/reason/i).fill("Probe");
  await dialog.getByRole("button", { name: /^submit/i }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
});
