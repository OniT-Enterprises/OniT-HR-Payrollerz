/**
 * The complete payroll workflow, end to end, in a real browser against the
 * Firebase emulators running PRODUCTION security rules:
 *
 *   sign up → company details → department → employee → run payroll →
 *   independent approval (second user; rules-enforced two-person rule +
 *   subscription paywall) → payslip → bank settlement journal → WIT return /
 *   payment → INSS export / payment → liability-clearing journals.
 *
 * The approver membership is created through the owner-facing Team Access UI.
 * Admin SDK is used only to follow the password-setup email in the emulator
 * (which has no inbox) and to enter the offline subscription a superadmin
 * records in production.
 */
import { expect, Page, test } from "@playwright/test";
import {
  activateSubscription,
  closeAdmin,
  findTenantIdByName,
  setInvitedUserPassword,
  waitForAuditActions,
  waitForEmulators,
  waitForJournalBySource,
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
const payDate = new Date(
  now.getFullYear(),
  now.getMonth() + (now.getDate() > 25 ? 1 : 0),
  25,
);
const PAY_MONTH = payDate.toLocaleString("en-US", { month: "long" });
const PAY_YEAR = String(payDate.getFullYear());
const PAY_DATE_ISO = [
  payDate.getFullYear(),
  String(payDate.getMonth() + 1).padStart(2, "0"),
  String(payDate.getDate()).padStart(2, "0"),
].join("-");
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
const EMPLOYEE = {
  first: "Maria",
  last: "Ximenes",
  email: `maria-${stamp}@e2e.test`,
};

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
  await page
    .getByLabel(/^password$/i)
    .first()
    .fill(password);
  await page
    .getByRole("button", { name: /sign in|log in/i })
    .first()
    .click();
  // Wait for auth + navigation to complete before the caller routes anywhere;
  // navigating mid-login makes the route guard bounce back here.
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 20_000 });
}

test("full payroll workflow: signup → employee → payroll → approval → payslip → exports", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const updateDepthErrors: string[] = [];
  // Surface app-side failures in the test output — a silent toast is
  // undebuggable in CI.
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const location = msg.location();
      if (msg.text().includes("Maximum update depth exceeded")) {
        updateDepthErrors.push(new URL(page.url()).pathname);
      }
      console.log(
        "[console.error]",
        new URL(page.url()).pathname,
        `${location.url}:${location.lineNumber}:${location.columnNumber}`,
        msg.text().slice(0, 400),
      );
    }
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
  await expect(page.getByText(COMPANY).first()).toBeVisible({
    timeout: 30_000,
  });

  // ── 2. First-run setup wizard (company → bank → payroll → complete) ─────
  await page.goto("/setup");
  await page.getByPlaceholder(/your company lda/i).fill(`${COMPANY} Lda`);
  await page.getByPlaceholder(/unique company number/i).fill("1234567890");
  await page.getByRole("button", { name: /next/i }).click(); // company saved
  await page.getByRole("button", { name: /next/i }).click(); // bank (cash default)
  await page.getByRole("button", { name: /next/i }).click(); // payroll defaults
  await page
    .getByRole("button", { name: /finish setup|go to dashboard/i })
    .click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });

  // Registered address lives in Settings (needed for INSS statutory identity)
  await page.goto("/settings/company"); // company details moved off the /settings hub
  await page.getByLabel(/registered address/i).fill("Rua de Dili 1, Dili");
  await page.getByLabel(/employer niss/i).fill("EMP-NISS-98765");
  await page.getByRole("button", { name: /save/i }).first().click();
  await expect(page.getByText(/saved/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // Payment evidence must point at a real ledger account. Configure the bank
  // once through Settings so the later transfer can settle salaries to 1130.
  await page.goto("/settings/payments");
  const bankTransferMethod = page
    .getByRole("button", { name: /bank transfer/i })
    .first();
  if ((await bankTransferMethod.getAttribute("aria-pressed")) !== "true") {
    await bankTransferMethod.click();
  }
  await page.getByRole("button", { name: /^add account$/i }).click();
  await page.getByPlaceholder(/bank name/i).fill("BNU");
  await page.getByPlaceholder(/account name/i).fill("Payroll Account");
  await page.getByPlaceholder(/account number/i).fill("00123456789");
  await page.getByRole("button", { name: /save payment structure/i }).click();
  await expect(page.getByText(/saved/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // The detailed ATTL return is intentionally hidden in the simple default
  // experience. The owner opts in through Settings; payroll managers can then
  // finish the statutory workflow without a seeded accountant.
  await page.goto("/settings/integrations");
  const advancedTaxMode = page.getByRole("switch", {
    name: /advanced tax mode/i,
  });
  if ((await advancedTaxMode.getAttribute("data-state")) !== "checked") {
    await advancedTaxMode.click();
  }
  await expect(advancedTaxMode).toHaveAttribute("data-state", "checked");

  // ── 3. Department, then employee ────────────────────────────────────────
  await page.goto("/settings/departments");
  await page.getByRole("button", { name: /edit departments/i }).click();
  await page.getByRole("button", { name: /add new department/i }).click();
  await page.getByPlaceholder(/engineering, marketing/i).fill("Operations");
  await page
    .getByRole("button", { name: "Add Department", exact: true })
    .click();
  await expect(page.getByText("Operations").first()).toBeVisible({
    timeout: 15_000,
  });
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
  await page
    .getByLabel(/monthly salary/i)
    .first()
    .fill("600");
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
  await page
    .getByRole("row")
    .filter({ hasText: /worker nif \/ tin/i })
    .getByRole("textbox")
    .first()
    .fill("TIN-EMP-12345");
  await page
    .getByRole("button", { name: "Add Employee", exact: true })
    .last()
    .click();
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
    await page
      .getByRole("combobox")
      .filter({ hasText: /select a reason/i })
      .click();
    await page.getByRole("option").first().click();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: "Next", exact: true }).click(); // hours
  await page
    .getByRole("button", { name: /submit for approval/i })
    .last()
    .click(); // review
  await expect(page.getByText(/draft|submitted|success/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // ── 5. Invite the independent approver + activate offline subscription ──
  const tenantId = await findTenantIdByName(COMPANY);
  await activateSubscription(tenantId);

  await page.goto("/settings/access");
  await page.getByRole("button", { name: /invite person/i }).click();
  const inviteDialog = page.getByRole("dialog", { name: /invite someone/i });
  await inviteDialog.getByLabel(/email address/i).fill(APPROVER.email);
  await inviteDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: /hr administrator/i }).click();
  await inviteDialog.getByRole("button", { name: /send invitation/i }).click();
  await expect(page.getByText(APPROVER.email).first()).toBeVisible({
    timeout: 30_000,
  });
  await setInvitedUserPassword({
    email: APPROVER.email,
    password: APPROVER.password,
    displayName: APPROVER.name,
  });

  // ── 6. Independent approval by the second user ──────────────────────────
  await signOut(page);
  await signIn(page, APPROVER.email, APPROVER.password);
  await page.goto("/payroll/history");
  await page
    .getByRole("button", { name: /^approve$/i })
    .first()
    .click();
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
  await expect(page.getByText(/no payroll runs pending approval/i)).toBeVisible(
    { timeout: 45_000 },
  );
  // Approval records the liability but must not claim money has left the bank.
  expect(await waitForRunStatus(tenantId, "approved")).toBe("approved");

  // The books, not just the run status: approving payroll must post a balanced
  // double-entry journal to the right accounts. Debits (gross wages 5110 +
  // employer INSS 5150) must equal credits (net 2210 + WIT 2220 + employee
  // INSS 2230 + employer INSS 2240), and total debits must equal total credits.
  const journal = await waitForJournalBySource(tenantId, "payroll");
  expect(journal.totalDebit).toBeGreaterThan(0);
  expect(
    Math.abs(journal.totalDebit - journal.totalCredit),
  ).toBeLessThanOrEqual(0.01);
  const wages = journal.byCode["5110"]?.debit ?? 0;
  const employerInss = journal.byCode["5150"]?.debit ?? 0;
  const netPayable = journal.byCode["2210"]?.credit ?? 0;
  const witPayable = journal.byCode["2220"]?.credit ?? 0;
  const employeeInss = journal.byCode["2230"]?.credit ?? 0;
  expect(wages).toBeGreaterThan(0);
  expect(netPayable).toBeGreaterThan(0);
  // Resident WIT is 10% of wages above the monthly $500 threshold.
  expect(witPayable).toBeCloseTo(10, 2);
  // Employer INSS appears on both sides (expense debit + payable credit).
  expect(journal.byCode["2240"]?.credit ?? 0).toBeCloseTo(employerInss, 2);
  // Debits reconcile to credits by the payroll identity.
  expect(
    Math.abs(
      wages +
        employerInss -
        (netPayable + witPayable + employeeInss + employerInss),
    ),
  ).toBeLessThanOrEqual(0.01);

  // Dismiss the "what's next" celebration dialog
  const nextStepsDialog = page.getByRole("dialog", { name: /what's next/i });
  await expect(nextStepsDialog).toBeVisible();
  await nextStepsDialog
    .getByRole("button", { name: /i'll do this later/i })
    .click();
  await expect(nextStepsDialog).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");

  // ── 7. Payslip PDF download from the approved run's details ─────────────
  // The section filter still shows "Pending Approval" — switch to all runs
  await page
    .getByRole("combobox")
    .filter({ hasText: /pending approval/i })
    .click({ timeout: 15_000 });
  await page
    .getByRole("option", { name: /all|approved|paid/i })
    .first()
    .click();
  await page
    .getByRole("button", { name: /more actions/i })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /view details/i }).click();
  await page
    .getByTitle(/download payslip pdf/i)
    .first()
    .click();
  const payslipDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /english/i }).click();
  expect((await payslipDownload).suggestedFilename()).toMatch(/\.pdf$/i);
  await page.keyboard.press("Escape");

  // ── 8. Bank completion is the payment event and posts the cash journal ──
  await page.goto("/payroll/payments");
  await page.getByRole("button", { name: /new transfer/i }).click();
  const transferDialog = page.getByRole("dialog", {
    name: /record bank transfer/i,
  });
  await transferDialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option").first().click();
  await transferDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await transferDialog.locator('input[type="date"]').fill(PAY_DATE_ISO);
  await transferDialog
    .getByRole("button", { name: /record transfer/i })
    .click();
  await expect(page.getByText(/recorded as pending/i).first()).toBeVisible({
    timeout: 30_000,
  });

  await page
    .getByRole("button", { name: /mark completed/i })
    .first()
    .click();
  const completeDialog = page.getByRole("alertdialog", {
    name: /mark transfer completed/i,
  });
  await expect(
    completeDialog.getByText(/post the bank payment to accounting/i),
  ).toBeVisible();
  await completeDialog.getByRole("button", { name: /mark completed/i }).click();
  expect(await waitForRunStatus(tenantId, "paid")).toBe("paid");

  const settlement = await waitForJournalBySource(tenantId, "payroll_payment");
  expect(settlement.byCode["2210"]?.debit ?? 0).toBeCloseTo(netPayable, 2);
  expect(settlement.byCode["1130"]?.credit ?? 0).toBeCloseTo(netPayable, 2);
  expect(settlement.totalDebit).toBeCloseTo(settlement.totalCredit, 2);

  // ── 9. WIT return and payment are separate, then clear the WIT payable ──
  await page.goto("/payroll/tax/monthly-wit");
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: PAY_YEAR, exact: true }).click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: PAY_MONTH, exact: true }).click();
  await page.getByRole("button", { name: /generate return/i }).click();
  await expect(
    page
      .getByText(new RegExp(`wit return .+${PAY_MONTH} ${PAY_YEAR}`, "i"))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("$10.00").first()).toBeVisible();

  await page
    .getByRole("button", { name: /^mark filed$/i })
    .first()
    .click();
  const witFiledDialog = page.getByRole("dialog", {
    name: /mark return as filed/i,
  });
  await witFiledDialog.getByLabel(/receipt number/i).fill("WIT-FILING-E2E");
  await witFiledDialog.getByRole("button", { name: /confirm filed/i }).click();
  await expect(witFiledDialog).toBeHidden();

  const witHistoryRow = page
    .getByRole("row")
    .filter({ hasText: new RegExp(PAY_MONTH, "i") })
    .last();
  await expect(witHistoryRow.getByText(/return\s*:\s*filed/i)).toBeVisible();
  await expect(
    witHistoryRow.getByText(/payment\s*:\s*(pending|overdue)/i),
  ).toBeVisible();

  await witHistoryRow
    .getByRole("button", { name: /^record payment$/i })
    .click();
  const witPaymentDialog = page.getByRole("dialog", {
    name: /record wit payment/i,
  });
  await witPaymentDialog
    .getByLabel(/bank.*receipt.*reference/i)
    .fill("WIT-PAYMENT-E2E");
  await witPaymentDialog
    .getByRole("button", { name: /^record payment$/i })
    .click();
  await expect(witPaymentDialog).toBeHidden();

  const witPayment = await waitForJournalBySource(
    tenantId,
    "tax_payment",
    "2220",
  );
  expect(witPayment.byCode["2220"]?.debit ?? 0).toBeCloseTo(10, 2);
  expect(witPayment.byCode["1130"]?.credit ?? 0).toBeCloseTo(10, 2);
  expect(witPayment.totalDebit).toBeCloseTo(witPayment.totalCredit, 2);

  // ── 10. Statutory export + INSS liability payment clearing ──────────────
  // The return is keyed by pay date (25/07), matching the page's default
  // current-month period. "Found 1 records" proves the approved+paid run
  // actually flowed into the filing — not just that the page rendered.
  await page.goto("/payroll/tax/inss-monthly");
  // The page defaults to the previous month; our run pays out on the 25th of
  // PAY_MONTH. (Known edge: Dec 26-31 the pay month rolls into a year the
  // year-select doesn't offer yet — the filing page itself has the same gap.)
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: PAY_MONTH, exact: true }).click();
  await page
    .getByRole("button", { name: /generate/i })
    .first()
    .click();
  // Durable page content, not toasts (they fade between assertions):
  // the generated return header plus the statutory math — 4% employee /
  // 6% employer INSS on $600 gross.
  await expect(
    page
      .getByText(new RegExp(`inss return .+${PAY_MONTH} ${PAY_YEAR}`, "i"))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("$24.00").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("$36.00").first()).toBeVisible();

  // Official portal export (exceljs DR template) actually downloads
  const inssDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /dr excel/i }).click();
  expect((await inssDownload).suggestedFilename()).toMatch(/\.xlsx$/i);

  // Record the actual remittance and prove both INSS liability accounts clear
  // against the selected bank account in a balanced journal.
  await page
    .getByRole("button", { name: /mark payment/i })
    .first()
    .click();
  const paymentDialog = page.getByRole("dialog", { name: /mark payment/i });
  await paymentDialog.getByLabel(/receipt|reference/i).fill("INSS-RECEIPT-E2E");
  await paymentDialog.getByRole("button", { name: /^save$/i }).click();

  const statutoryPayment = await waitForJournalBySource(
    tenantId,
    "tax_payment",
    "2230",
  );
  expect(statutoryPayment.byCode["2230"]?.debit ?? 0).toBeCloseTo(24, 2);
  expect(statutoryPayment.byCode["2240"]?.debit ?? 0).toBeCloseTo(36, 2);
  expect(statutoryPayment.byCode["1130"]?.credit ?? 0).toBeCloseTo(60, 2);
  expect(statutoryPayment.totalDebit).toBeCloseTo(
    statutoryPayment.totalCredit,
    2,
  );

  // Form C remains an honest preparation hand-off: persist the accounting
  // checklist, but never claim that Xefe generated or filed the official form.
  await page.goto("/accounting/tax/annual-income-tax");
  await expect(
    page.getByText(/not the official form and xefe does not file it/i),
  ).toBeVisible();
  const formCChecks = page.getByRole("checkbox");
  await expect(formCChecks).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await formCChecks.nth(index).click();
  }
  await page
    .getByLabel(/review note/i)
    .fill("Prepared for independent accountant sign-off");
  await page.getByRole("button", { name: /save progress/i }).last().click();
  // .first(): the toast body and its aria-live announcer both carry the text.
  await expect(page.getByText(/preparation saved/i).first()).toBeVisible();

  // Audit evidence is part of the workflow contract, not an optional side
  // effect. These are written by server-authenticated callables.
  const auditActions = await waitForAuditActions(tenantId, [
    "payroll.approve",
    "payroll.pay",
    "tax.payment_recorded",
    "tax.form_c_preparation_updated",
  ]);
  expect(auditActions).toEqual(
    expect.arrayContaining([
      "payroll.approve",
      "payroll.pay",
      "tax.payment_recorded",
      "tax.form_c_preparation_updated",
    ]),
  );
  expect(updateDepthErrors, "React update loops detected").toEqual([]);
});
