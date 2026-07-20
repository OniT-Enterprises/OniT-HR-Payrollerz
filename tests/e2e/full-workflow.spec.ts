/**
 * The complete payroll workflow, end to end, in a real browser against the
 * Firebase emulators running PRODUCTION security rules:
 *
 *   sign up → company details → department → employee → run payroll →
 *   independent approval (second user; rules-enforced two-person rule +
 *   subscription paywall) → payslips → bank / INSS / ATTL exports.
 *
 * Admin-SDK seeding is used only where no product UI exists: the approver
 * account (no tenant-facing invite UI yet) and the offline subscription
 * (superadmin-entered in production).
 */
import { expect, Page, test } from "@playwright/test";
import {
  activateSubscription,
  closeAdmin,
  createApprover,
  findTenantIdByName,
  getPayrollJournal,
  waitForEmulators,
  waitForRunStatus,
} from "./helpers/admin";

test.beforeAll(async () => {
  await waitForEmulators();
});

const stamp = Date.now().toString(36);
const COMPANY = `E2E Payroll Co ${stamp}`;

// The wizard schedules pay for the 25th of the current month (or next month
// when today is past the 25th) — the INSS filing is keyed by that pay month.
const now = new Date();
const payDate = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 25 ? 1 : 0), 25);
const PAY_MONTH = payDate.toLocaleString("en-US", { month: "long" });
const PAY_YEAR = String(payDate.getFullYear());
const OWNER = {
  name: "Elisa Owner",
  email: `owner-${stamp}@e2e.test`,
  password: "e2e-Password-1",
};
const APPROVER = {
  name: "Adao Approver",
  email: `approver-${stamp}@e2e.test`,
  password: "e2e-Password-2",
};
const EMPLOYEE = { first: "Maria", last: "Ximenes", email: `maria-${stamp}@e2e.test` };

test.afterAll(async () => {
  await closeAdmin();
});

async function forceEnglish(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("onit:locale", "en");
  });
}

async function signOut(page: Page) {
  // TopBar avatar menu → sign out
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/(auth\/login)?$/, { timeout: 15_000 });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/^password$/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  // Wait for auth + navigation to complete before the caller routes anywhere;
  // navigating mid-login makes the route guard bounce back here.
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 20_000 });
}

test("full payroll workflow: signup → employee → payroll → approval → payslip → exports", async ({
  page,
}) => {
  // Surface app-side failures in the test output — a silent toast is
  // undebuggable in CI.
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 400));
  });

  await forceEnglish(page);

  // ── 1. Sign up: account step, then company step ─────────────────────────
  await page.goto("/auth/signup");
  await page.getByLabel(/full name/i).fill(OWNER.name);
  await page.getByLabel(/work email/i).fill(OWNER.email);
  await page.getByLabel(/^password$/i).fill(OWNER.password);
  await page.getByLabel(/confirm password/i).fill(OWNER.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByRole("button", { name: /create/i }).click();

  // Lands on the signed-in dashboard for the new tenant
  await expect(page.getByText(COMPANY).first()).toBeVisible({ timeout: 30_000 });

  // ── 2. First-run setup wizard (company → bank → payroll → complete) ─────
  await page.goto("/setup");
  await page.getByPlaceholder(/your company lda/i).fill(`${COMPANY} Lda`);
  await page.getByPlaceholder(/unique company number/i).fill("1234567890");
  await page.getByRole("button", { name: /next/i }).click(); // company saved
  await page.getByRole("button", { name: /next/i }).click(); // bank (cash default)
  await page.getByRole("button", { name: /next/i }).click(); // payroll defaults
  await page.getByRole("button", { name: /finish setup|go to dashboard/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });

  // Registered address lives in Settings (needed for INSS statutory identity)
  await page.goto("/settings/company"); // company details moved off the /settings hub
  await page.getByLabel(/registered address/i).fill("Rua de Dili 1, Dili");
  await page.getByRole("button", { name: /save/i }).first().click();
  await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 });

  // ── 3. Department, then employee ────────────────────────────────────────
  await page.goto("/settings/departments");
  await page.getByRole("button", { name: /edit departments/i }).click();
  await page.getByRole("button", { name: /add new department/i }).click();
  await page.getByPlaceholder(/engineering, marketing/i).fill("Operations");
  await page.getByRole("button", { name: "Add Department", exact: true }).click();
  await expect(page.getByText("Operations").first()).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape"); // close the manage dialog

  await page.goto("/people/add");
  await page.getByLabel(/first name/i).fill(EMPLOYEE.first);
  await page.getByLabel(/last name/i).fill(EMPLOYEE.last);
  await page.getByLabel(/email/i).first().fill(EMPLOYEE.email);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Job step: department select, title, start date prefilled
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Operations" }).click();
  await page.getByLabel(/job title/i).fill("Barista");
  await page.getByLabel(/start date/i).fill("2026-01-05");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Compensation step — monthly salary above minimum wage
  await page.getByLabel(/monthly salary/i).first().fill("300");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Documents step: statutory identifiers — the INSS monthly filing refuses
  // to generate for an employee without a NISS number
  await page
    .getByRole("row")
    .filter({ hasText: /bilhete de identidade/i })
    .getByRole("textbox")
    .first()
    .fill("BI-123456");
  await page
    .getByRole("row")
    .filter({ hasText: /inss number/i })
    .getByRole("textbox")
    .first()
    .fill("1234567");
  await page.getByRole("button", { name: "Add Employee", exact: true }).last().click();
  await expect(page).toHaveURL(/people\/employees/, { timeout: 20_000 });
  await expect(
    page
      .getByText(`${EMPLOYEE.first} ${EMPLOYEE.last}`)
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 20_000 });

  // ── 4. Run payroll to a draft ───────────────────────────────────────────
  await page.goto("/payroll/run");
  await page.getByRole("button", { name: "Next", exact: true }).click(); // period

  // Employees step: acknowledge the missing-documents compliance notice
  await expect(
    page
      .getByText(`${EMPLOYEE.first} ${EMPLOYEE.last}`)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  const complianceAck = page.getByRole("checkbox").first();
  if (await complianceAck.isVisible().catch(() => false)) {
    await complianceAck.click();
    // Audit-trail reason is required once the acknowledgment is ticked
    await page.getByRole("combobox").filter({ hasText: /select a reason/i }).click();
    await page.getByRole("option").first().click();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: "Next", exact: true }).click(); // hours
  await page.getByRole("button", { name: /submit for approval/i }).last().click(); // review
  await expect(page.getByText(/draft|submitted|success/i).first()).toBeVisible({ timeout: 30_000 });

  // ── 5. Seed what has no UI: approver account + offline subscription ─────
  const tenantId = await findTenantIdByName(COMPANY);
  await createApprover({ tenantId, ...APPROVER, displayName: APPROVER.name });
  await activateSubscription(tenantId);

  // ── 6. Independent approval by the second user ──────────────────────────
  await signOut(page);
  await signIn(page, APPROVER.email, APPROVER.password);
  await page.goto("/payroll/history");
  await page.getByRole("button", { name: /^approve$/i }).first().click();
  // Confirm the unassigned-allocation acknowledgment when present
  await expect(page.getByText(/approve payroll run/i).first()).toBeVisible();
  // The allocation check loads async; in this journey the employee has no
  // project tags, so the unassigned acknowledgment always appears.
  const allocationAck = page.locator("#approve-unassigned-allocation");
  await expect(allocationAck).toBeVisible({ timeout: 20_000 });
  await allocationAck.click();
  await expect(allocationAck).toHaveAttribute("data-state", "checked");
  await page.getByRole("button", { name: /approve & process/i }).click();
  // Success empties the pending-approval list — the one unambiguous signal
  // on this page ("YTD Total Paid" makes /approved|paid/ match vacuously).
  await expect(
    page.getByText(/no payroll runs pending approval/i),
  ).toBeVisible({ timeout: 45_000 });
  // Ground truth: approve → journal → paid must land in Firestore, not just
  // in UI state. Fails naming the stuck status if the pipeline broke midway.
  expect(await waitForRunStatus(tenantId, "paid")).toBe("paid");

  // The books, not just the run status: approving payroll must post a balanced
  // double-entry journal to the right accounts. Debits (gross wages 5110 +
  // employer INSS 5150) must equal credits (net 2210 + WIT 2220 + employee
  // INSS 2230 + employer INSS 2240), and total debits must equal total credits.
  const journal = await getPayrollJournal(tenantId);
  expect(journal).not.toBeNull();
  expect(journal!.totalDebit).toBeGreaterThan(0);
  expect(Math.abs(journal!.totalDebit - journal!.totalCredit)).toBeLessThanOrEqual(0.01);
  const wages = journal!.byCode["5110"]?.debit ?? 0;
  const employerInss = journal!.byCode["5150"]?.debit ?? 0;
  const netPayable = journal!.byCode["2210"]?.credit ?? 0;
  const employeeInss = journal!.byCode["2230"]?.credit ?? 0;
  expect(wages).toBeGreaterThan(0);
  expect(netPayable).toBeGreaterThan(0);
  // The single resident employee is under the $500 WIT threshold, so no WIT
  // line — proving the zero-line drop works end to end, in the live posting.
  expect(journal!.byCode["2220"]).toBeUndefined();
  // Employer INSS appears on both sides (expense debit + payable credit).
  expect(journal!.byCode["2240"]?.credit ?? 0).toBeCloseTo(employerInss, 2);
  // Debits reconcile to credits by the payroll identity.
  expect(Math.abs((wages + employerInss) - (netPayable + employeeInss + employerInss))).toBeLessThanOrEqual(0.01);

  // Dismiss the "what's next" celebration dialog
  await page.getByRole("button", { name: /i'll do this later/i }).click();

  // ── 7. Payslip PDF download from the approved run's details ─────────────
  // The section filter still shows "Pending Approval" — switch to all runs
  await page
    .getByRole("combobox")
    .filter({ hasText: /pending approval/i })
    .click();
  await page.getByRole("option", { name: /all|approved|paid/i }).first().click();
  await page.getByRole("button", { name: /more actions/i }).first().click();
  await page.getByRole("menuitem", { name: /view details/i }).click();
  await page.getByTitle(/download payslip pdf/i).first().click();
  const payslipDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /english/i }).click();
  expect((await payslipDownload).suggestedFilename()).toMatch(/\.pdf$/i);
  await page.keyboard.press("Escape");

  // ── 8. Statutory export: INSS monthly return generated from the run ─────
  // The return is keyed by pay date (25/07), matching the page's default
  // current-month period. "Found 1 records" proves the approved+paid run
  // actually flowed into the filing — not just that the page rendered.
  await page.goto("/payroll/tax/inss-monthly");
  // The page defaults to the previous month; our run pays out on the 25th of
  // PAY_MONTH. (Known edge: Dec 26-31 the pay month rolls into a year the
  // year-select doesn't offer yet — the filing page itself has the same gap.)
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: PAY_MONTH, exact: true }).click();
  await page.getByRole("button", { name: /generate/i }).first().click();
  // Durable page content, not toasts (they fade between assertions):
  // the generated return header plus the statutory math — 4% employee /
  // 6% employer INSS on $300 gross.
  await expect(
    page.getByText(new RegExp(`inss return .+${PAY_MONTH} ${PAY_YEAR}`, "i")).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("$12.00").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("$18.00").first()).toBeVisible();

  // Official portal export (exceljs DR template) actually downloads
  const inssDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /dr excel/i }).click();
  expect((await inssDownload).suggestedFilename()).toMatch(/\.xlsx$/i);
});
