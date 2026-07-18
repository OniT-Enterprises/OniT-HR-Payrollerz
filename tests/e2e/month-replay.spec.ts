/**
 * Through-the-UI real-month payroll replay.
 *
 * Loads a de-identified six-employee schedule mined from the firm's own
 * workpapers (salaries $150 to $2,151.40, spanning the $500 WIT threshold),
 * then drives the REAL payroll wizard — the same screens a user clicks — and
 * asserts the run Xefe produces matches the firm's worked totals to the cent.
 *
 * Employees are seeded via the Admin SDK (the main E2E already proves employee
 * creation through the UI); everything from "Run Payroll" onward is the actual
 * product. Assertions read the saved run + records from Firestore — ground
 * truth, not formatted DOM text.
 */
import { expect, Page, test } from "@playwright/test";
import {
  activateSubscription,
  closeAdmin,
  findTenantIdByName,
  getLatestRunRecordTotals,
  getLatestRunTotals,
  markSetupComplete,
  seedEmployees,
  waitForEmulators,
} from "./helpers/admin";
import {
  firmMonthEmployees,
  firmMonthExpectedTotals,
} from "../client/fixtures/deidentified-firm-month";

const stamp = Date.now().toString(36);
const COMPANY = `Replay Co ${stamp}`;
const OWNER = {
  name: "Owner Replay",
  email: `replay-${stamp}@e2e.test`,
  password: "e2e-Password-1",
};

test.beforeAll(async () => {
  await waitForEmulators();
});

test.afterAll(async () => {
  await closeAdmin();
});

async function signUpOwner(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("onit:locale", "en"));
  await page.goto("/auth/signup");
  await page.getByLabel(/full name/i).fill(OWNER.name);
  await page.getByLabel(/work email/i).fill(OWNER.email);
  await page.getByLabel(/^password$/i).fill(OWNER.password);
  await page.getByLabel(/confirm password/i).fill(OWNER.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page.getByText(COMPANY).first()).toBeVisible({ timeout: 30_000 });
}

test("replays a real firm month through the payroll wizard", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 300));
  });

  await signUpOwner(page);

  const tenantId = await findTenantIdByName(COMPANY);
  await activateSubscription(tenantId);
  await markSetupComplete(tenantId);
  await seedEmployees(
    tenantId,
    firmMonthEmployees.map((e) => ({ ref: e.ref, monthlySalary: e.monthlySalary })),
  );

  // Drive the actual payroll wizard: period -> employees -> hours -> submit.
  await page.goto("/payroll/run");

  // The wizard header confirms the full seeded schedule loaded.
  await expect(
    page.getByText(/process payroll for 6 active employees/i),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Next", exact: true }).click(); // period -> employees

  // Seeded workers have no timesheet contracts on file; acknowledge if asked.
  const ack = page.getByRole("checkbox").first();
  if (await ack.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await ack.click();
    const reason = page.getByRole("combobox").filter({ hasText: /select a reason/i });
    if (await reason.isVisible().catch(() => false)) {
      await reason.click();
      await page.getByRole("option").first().click();
    }
  }
  await page.getByRole("button", { name: "Next", exact: true }).click(); // employees -> hours
  await page.getByRole("button", { name: "Next", exact: true }).click(); // hours -> review

  // Review step shows the run totals; submit creates the run + records.
  await page.getByRole("button", { name: /submit for approval/i }).last().click();
  await expect(page.getByText(/draft|submitted|success/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // Ground truth: the saved run's aggregates must match the firm's schedule.
  let runTotals = await getLatestRunTotals(tenantId);
  for (let i = 0; i < 30 && !runTotals; i++) {
    await new Promise((r) => setTimeout(r, 1_000));
    runTotals = await getLatestRunTotals(tenantId);
  }
  expect(runTotals).not.toBeNull();
  expect(runTotals!.employeeCount).toBe(firmMonthEmployees.length);

  expect(Math.abs(runTotals!.totalGrossPay - firmMonthExpectedTotals.gross)).toBeLessThanOrEqual(0.02);
  expect(Math.abs(runTotals!.totalNetPay - firmMonthExpectedTotals.net)).toBeLessThanOrEqual(0.02);

  const recordTotals = await getLatestRunRecordTotals(tenantId);
  expect(recordTotals.count).toBe(firmMonthEmployees.length);
  expect(Math.abs(recordTotals.incomeTax - firmMonthExpectedTotals.wit)).toBeLessThanOrEqual(0.02);
  expect(Math.abs(recordTotals.inssEmployee - firmMonthExpectedTotals.inssEmployee)).toBeLessThanOrEqual(0.02);
});
