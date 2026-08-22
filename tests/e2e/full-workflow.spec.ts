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
import { expect, Page, test, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getInitialPayrollDates } from "../../client/lib/payroll/payroll-schedule";
import { pickDate, pickNthDate } from "./helpers/datePicker";
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

// Use the same schedule helper as the wizard, including the Art. 40(5)
// preceding-business-day adjustment for weekends and public holidays.
const PAY_DATE_ISO = getInitialPayrollDates({
  frequency: "monthly",
  payDay: 25,
}).payDate;
const [PAY_YEAR, payMonthNumber] = PAY_DATE_ISO.split("-");
const PAY_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
}).format(new Date(`${PAY_DATE_ISO}T12:00:00Z`));
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
const PROJECT_CODE = `HEALTH-${stamp}`;
const FUNDING_SOURCE = 'Donor "A", Health';

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
  test.setTimeout(420_000);
  const checkpoint = (label: string) => console.log(`[e2e] ${label}`);
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

  // Shared navigation stays calm: one module and one nested group at a time,
  // with group rows acting only as disclosures rather than duplicate links.
  await page.goto("/people");
  const sidebar = page.getByRole("complementary", {
    name: "Main navigation",
  });
  await sidebar.getByRole("button", { name: /employees expand/i }).click();
  await expect(sidebar.getByText("Employee list", { exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: /performance expand/i }).click();
  await expect(sidebar.getByText("Employee list", { exact: true })).toBeHidden();
  await expect(sidebar.getByText("Goals", { exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$/);
  await expect(sidebar.getByText("Goals", { exact: true })).toBeHidden();

  // The route directory is generated from that same permission-filtered
  // navigation source. It stays compact and does not advertise stale page
  // counts or duplicate English-only descriptions.
  await page.goto("/sitemap");
  await expect(page.getByRole("heading", { name: "Sitemap" })).toBeVisible();
  await expect(
    page.getByText(
      "Every place you can go in Xefe, grouped by the work you want to do.",
    ),
  ).toBeVisible();
  await expect(page.locator('a[href="/people/employees"]')).toBeVisible();
  await expect(page.getByText("Complete navigation guide for Xefe")).toHaveCount(0);

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
  // Statutory identifiers sit behind a disclosure: a first-time owner should
  // not have to face TIN/NISS to save their company name.
  await page.getByRole("button", { name: /tax and registration numbers/i }).click();
  await page.getByLabel(/employer niss/i).fill("EMP-NISS-98765");
  await page.getByRole("button", { name: /save/i }).first().click();
  // Assert the actual confirmation, not any text containing "saved" — the
  // page carries a static note ("Teams are saved as soon as you add or
  // remove them") that made the old /saved/i match a false positive.
  await expect(
    page.getByText(/company details updated/i).first(),
  ).toBeVisible({ timeout: 15_000 });

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

  // ── 2b. Time Off policies ───────────────────────────────────────────────
  // The page groups into "your decisions" vs "fixed by law" and every row
  // answers itself before you tap it. Row toggles are addressed by
  // aria-controls: the visible titles repeat inside the panels ("See all 18
  // public holidays…"), so a name match would be ambiguous once open.
  await page.goto("/time-leave/settings");
  await expect(page.getByText("Your company's decisions")).toBeVisible();
  await expect(page.getByText("Fixed by Timor-Leste law")).toBeVisible();
  // The statutory answers are readable with nothing tapped.
  await expect(page.getByText(/INSS pays the mother/i)).toBeVisible();
  await expect(page.getByText(/first 6 days at full pay/i)).toBeVisible();

  const annualRow = page.locator('button[aria-controls="annual-panel"]');
  const holidayRow = page.locator('button[aria-controls="holidays-panel"]');

  await expect(page.locator("#annual-panel")).toBeHidden();
  await annualRow.click();
  await expect(page.locator("#annual-panel")).toBeVisible();
  // The answer must NOT vanish the moment you open the row to edit it.
  await expect(page.getByText(/12 days a year/i).first()).toBeVisible();

  // Below the Art. 32 floor the row warns and offers the one-tap repair.
  await page.locator("#annual-days").fill("8");
  await expect(page.getByText(/at least 12 days a year/i)).toBeVisible();
  await page.getByRole("button", { name: /set to 12 days/i }).click();
  await expect(page.locator("#annual-days")).toHaveValue("12");

  // The holiday override form is a live react-hook-form populated by the
  // per-day Override buttons. Collapsing its row must NOT discard half-typed
  // input — this is why the row body is `hidden` and not a Radix
  // CollapsibleContent, which unmounts its children.
  await holidayRow.click();
  await expect(page.locator("#holidays-panel")).toBeVisible();
  await page.locator("#holiday-name").fill("Company anniversary");
  await annualRow.click(); // one row open at a time — this closes holidays
  await expect(page.locator("#holidays-panel")).toBeHidden();
  await holidayRow.click();
  await expect(page.locator("#holiday-name")).toHaveValue(
    "Company anniversary",
  );

  await page.getByRole("button", { name: /save leave settings/i }).click();
  await expect(
    page.getByText(/time-off policies updated/i).first(),
  ).toBeVisible({ timeout: 15_000 });

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

  // One scrolling screen — the 4-step wizard is gone, so there is no Next.
  await page.goto("/people/add");
  await page.getByLabel(/first name/i).fill(EMPLOYEE.first);
  await page.getByLabel(/last name/i).fill(EMPLOYEE.last);

  // Department, job title and start date
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Operations" }).click();
  await page.getByLabel(/job title/i).fill("Barista");
  await pickNthDate(page, page, 0, "2026-01-05");
  await page
    .getByRole("button", { name: /project & donor details/i })
    .click();
  await page.getByLabel(/project code/i).fill(PROJECT_CODE);
  await page.getByLabel(/funding source/i).fill(FUNDING_SOURCE);

  // Monthly salary above minimum wage — now a required field
  await page
    .getByLabel(/monthly salary/i)
    .first()
    .fill("600");

  // Email is optional now and lives under "More details"; the app invite
  // needs it, so open the disclosure and fill it.
  await page.getByRole("button", { name: /more details/i }).first().click();
  await page.getByLabel(/email/i).first().fill(EMPLOYEE.email);

  // Statutory identifiers are behind a disclosure — the INSS monthly filing
  // refuses to generate for an employee without a NISS number.
  await page
    .getByRole("button", { name: /id and inss number/i })
    .click();
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

  // Tax residence is a required tax fact — payroll refuses to infer it from
  // nationality, and the form refuses to submit without it.
  await page.getByLabel(/tax residence/i).click();
  await page.getByRole("option", { name: "Timor-Leste resident" }).click();

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

  // ── 3b. Employee profile is its own page, not a dialog ──────────────────
  // Viewing an employee used to open a modal; it is a route now, so it must
  // survive a direct visit and a reload the way a dialog never could.
  await page
    .getByText(`${EMPLOYEE.first} ${EMPLOYEE.last}`)
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/people\/employees\/.+/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", {
      name: `${EMPLOYEE.first} ${EMPLOYEE.last}`,
      level: 1,
    }),
  ).toBeVisible({ timeout: 20_000 });
  // Mirrors the Add/Edit form's sections, and the statutory ID block.
  await expect(page.getByText("Who they are")).toBeVisible();
  await expect(page.getByText(/what they do and what you pay them/i)).toBeVisible();
  await expect(page.getByText("ID and INSS number")).toBeVisible();
  // A value the form wrote, rendered read-only with no input around it.
  await expect(page.getByText("TIN-EMP-12345")).toBeVisible();
  const profileUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: `${EMPLOYEE.first} ${EMPLOYEE.last}`,
      level: 1,
    }),
  ).toBeVisible({ timeout: 20_000 });
  expect(page.url()).toBe(profileUrl);
  await page.goBack();

  // Workforce reporting reads the employee/department just created through
  // the same tenant-scoped queries used in production.
  await page.goto("/reports/employees");
  await expect(page.getByRole("heading", { name: /employee reports/i })).toBeVisible({
    timeout: 30_000,
  });
  const directoryDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export directory/i }).click();
  const directoryDownload = await directoryDownloadPromise;
  const directoryPath = await directoryDownload.path();
  expect(directoryPath).toBeTruthy();
  const directoryCsv = await readFile(directoryPath!, "utf8");
  expect(directoryCsv).toContain(EMPLOYEE.email);

  await page.goto("/reports/departments");
  await expect(page.getByRole("heading", { name: /department reports/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("row").filter({ hasText: "Operations" })).toBeVisible();

  // ── 3c. A sick day is recordable, and lands as LEAVE not absence ────────
  // The Mark dialog requires a clock-in, so before this there was no way to
  // record a non-worked day here at all. Sick must go through the leave path:
  // payroll derives the Art. 33(4) 6@100%/6@50% banding from leave_requests,
  // so an attendance-only "sick" would look right and pay nothing.
  await page.goto("/time-leave/attendance");
  // Default posture is "record only the exceptions" — the page says so, and a
  // day with no record must not be presented as a gap to chase.
  await expect(
    page.getByText(/you record absences and overtime only/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /record an absence/i }).click();
  // Never trust the default date: it is Timor-Leste's today, so the run lands
  // on a weekend whenever the machine clock is late enough in a western
  // timezone, and a weekend carries no leave. Pick a known Wednesday.
  const absenceDialog = page.getByRole("dialog");
  await pickDate(
    page,
    absenceDialog.locator("[data-datepicker]").first(),
    "2026-01-07",
  );
  await page.getByLabel(/employee/i).first().click();
  await page
    .getByRole("option", { name: `${EMPLOYEE.first} ${EMPLOYEE.last}` })
    .click();
  await page.getByLabel(/why were they away/i).click();
  await page.getByRole("option", { name: "Sick", exact: true }).click();
  // The statutory bands are stated before the day is recorded, not after —
  // and the annual limit is stated as a CEILING ("up to 12"), because
  // Art. 33(4) reads "até 12 dias por ano". A bare "12 days" invites an
  // employer to read a floor into a cap, which is the error class the
  // check:statutory guard now blocks.
  await expect(page.getByText(/up to 12 days a year/i)).toBeVisible();
  await expect(page.getByText(/first 6 at full pay/i)).toBeVisible();
  await page.getByRole("button", { name: /^record it$/i }).click();
  await expect(page.getByText(/recorded for/i).first()).toBeVisible({
    timeout: 20_000,
  });
  // It must NOT have become an unjustified absence.
  await expect(page.getByText(/did not come to work/i)).toHaveCount(0);

  await page.goto("/reports/attendance");
  await expect(page.getByRole("heading", { name: /attendance reports/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/no attendance records found/i)).toBeVisible();

  // An open attendance record is work in progress, not a completed "Present"
  // day. Record only a clock-in on a historical date and verify the calmer,
  // accurate label shown to the owner.
  await page.goto("/time-leave/attendance");
  await pickDate(
    page,
    page.locator("[data-datepicker]").first(),
    "2026-01-08",
  );
  await page
    .getByRole("button", { name: /mark attendance/i })
    .first()
    .click();
  const markAttendanceDialog = page.getByRole("dialog", {
    name: /mark attendance/i,
  });
  await markAttendanceDialog.getByRole("combobox").first().click();
  await page
    .getByRole("option", { name: `${EMPLOYEE.first} ${EMPLOYEE.last}` })
    .click();
  await markAttendanceDialog.getByRole("button", { name: /clock in/i }).click();
  await markAttendanceDialog.getByRole("button", { name: "08:00" }).click();
  await markAttendanceDialog
    .getByRole("button", { name: /mark attendance/i })
    .click();
  await expect(page.getByText("Clocked in").first()).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/reports/setup");
  await expect(page.getByRole("heading", { name: /setup reports/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/setup progress/i).first()).toBeVisible();

  await page.goto("/reports/custom");
  const activeEmployeesTemplate = page
    .getByText(/active employees directory/i)
    .locator("..")
    .locator("..")
    .locator("..");
  await expect(activeEmployeesTemplate).toBeVisible({ timeout: 30_000 });
  await activeEmployeesTemplate.getByRole("button", { name: /^run$/i }).click();
  await expect(page.getByText(/report preview/i)).toBeVisible();
  await expect(
    page.getByRole("cell", { name: EMPLOYEE.email, exact: true }),
  ).toBeVisible();

  const departmentHeadcountTemplate = page
    .getByText(/department headcount/i)
    .locator("..")
    .locator("..")
    .locator("..");
  await departmentHeadcountTemplate
    .getByRole("button", { name: /^run$/i })
    .click();
  await expect(page.getByRole("columnheader", { name: /headcount/i })).toBeVisible();
  const departmentPreviewRow = page
    .getByRole("row")
    .filter({ hasText: "Operations" })
    .last();
  await expect(departmentPreviewRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();

  // ── 4. Run payroll to a draft ───────────────────────────────────────────
  checkpoint("workforce and custom reports verified; creating payroll");
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
  checkpoint("payroll drafted and approver invited; approving payroll");
  await signOut(page);
  await signIn(page, APPROVER.email, APPROVER.password);
  await page.goto("/payroll/history");
  await page
    .getByRole("button", { name: /^approve$/i })
    .first()
    .click();
  // Configured allocation must not require the unassigned-cost override.
  await expect(page.getByText(/approve payroll run/i).first()).toBeVisible();
  const allocationAck = page.locator("#approve-unassigned-allocation");
  await expect(allocationAck).toBeHidden({ timeout: 20_000 });
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

  // ── 7. NGO allocation → accounting journal → donor exports ─────────────
  checkpoint("payroll approved and journal balanced; verifying report exports");
  await page.goto("/reports/payroll");
  await expect(page.getByRole("heading", { name: /payroll reports/i })).toBeVisible({
    timeout: 30_000,
  });
  const payrollReportRow = page
    .getByRole("row")
    .filter({ hasText: `${EMPLOYEE.first} ${EMPLOYEE.last}` });
  await expect(payrollReportRow).toBeVisible({ timeout: 30_000 });
  await expect(payrollReportRow.getByText("$600.00").first()).toBeVisible();
  const payrollReportDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export reports/i }).click();
  expect((await payrollReportDownloadPromise).suggestedFilename()).toBe(
    `payroll-report-${PAY_DATE_ISO}.csv`,
  );

  await page.goto("/reports/payroll-allocation");
  await page.locator("#allocation-report-year").click();
  await page.getByRole("option", { name: PAY_YEAR, exact: true }).click();
  await page.locator("#allocation-report-month").click();
  await page.getByRole("option", { name: PAY_MONTH, exact: true }).click();
  const allocationRow = page
    .getByRole("row")
    .filter({ hasText: PROJECT_CODE })
    .filter({ hasText: FUNDING_SOURCE });
  await expect(allocationRow).toBeVisible({ timeout: 30_000 });
  await expect(allocationRow.getByText("$600.00").first()).toBeVisible();

  const allocationDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  const allocationDownload = await allocationDownloadPromise;
  expect(allocationDownload.suggestedFilename()).toBe(
    `payroll-allocation-${PAY_YEAR}-${payMonthNumber}.csv`,
  );
  const allocationPath = await allocationDownload.path();
  expect(allocationPath).toBeTruthy();
  const allocationCsv = await readFile(allocationPath!, "utf8");
  expect(allocationCsv).toContain(PROJECT_CODE);
  expect(allocationCsv).toContain('"Donor ""A"", Health"');

  await page.goto("/reports/donor-export");
  await pickDate(page, page.locator("#donor-export-start"), PAY_DATE_ISO);
  await pickDate(page, page.locator("#donor-export-end"), PAY_DATE_ISO);
  const donorSummaryRow = page
    .getByRole("row")
    .filter({ hasText: PROJECT_CODE })
    .filter({ hasText: FUNDING_SOURCE });
  await expect(donorSummaryRow).toBeVisible({ timeout: 30_000 });
  await expect(donorSummaryRow.getByText("$600.00").first()).toBeVisible();

  const donorDownloads: Download[] = [];
  const collectDownload = (download: Download) => donorDownloads.push(download);
  page.on("download", collectDownload);
  await page.getByRole("button", { name: /export pack/i }).click();
  await expect.poll(() => donorDownloads.length, { timeout: 15_000 }).toBe(2);
  page.off("download", collectDownload);
  expect(
    donorDownloads.map((download) => download.suggestedFilename()).sort(),
  ).toEqual([
    `donor-payroll-journal-lines-${PAY_DATE_ISO}-to-${PAY_DATE_ISO}.csv`,
    `donor-payroll-summary-${PAY_DATE_ISO}-to-${PAY_DATE_ISO}.csv`,
  ]);
  for (const download of donorDownloads) {
    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = await readFile(path!, "utf8");
    expect(csv).toContain(PROJECT_CODE);
    expect(csv).toContain('"Donor ""A"", Health"');
  }

  // ── 8. Payslip PDF download from the approved run's details ─────────────
  checkpoint("payroll, allocation, and donor CSVs verified; downloading payslip");
  await page.goto("/payroll/history");
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

  // ── 9. Bank completion is the payment event and posts the cash journal ──
  checkpoint("payslip verified; settling payroll payment");
  await page.goto("/payroll/payments");
  await page.getByRole("button", { name: /new transfer/i }).click();
  const transferDialog = page.getByRole("dialog", {
    name: /record bank transfer/i,
  });
  await transferDialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option").first().click();
  await transferDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await pickNthDate(page, transferDialog, 0, PAY_DATE_ISO);
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

  // ── 10. WIT return and payment are separate, then clear WIT payable ─────
  checkpoint("payroll settlement journal verified; filing and paying WIT");
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

  // The WIT rewrite moved the return's "Mark filed" into the filing row's
  // overflow menu ("More actions"); the primary button is now "Continue
  // return". Radix renders the menu content in a page-level portal, so the
  // menuitem is queried at page scope rather than inside the row.
  const witReturnRow = page
    .getByRole("row")
    .filter({ hasText: new RegExp(PAY_MONTH, "i") })
    .last();
  await witReturnRow.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: /^mark filed$/i }).click();
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

  // ── 11. Statutory export + INSS liability payment clearing ──────────────
  checkpoint("WIT filing/payment verified; generating and paying INSS");
  // The return is keyed by pay date (25/07), matching the page's default
  // current-month period. "Found 1 records" proves the approved+paid run
  // actually flowed into the filing — not just that the page rendered.
  await page.goto("/payroll/tax/inss-monthly");
  // The page defaults to the previous month; select the payroll year/month
  // explicitly, including the supported late-December next-year rollover.
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: PAY_YEAR, exact: true }).click();
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

  await page.goto("/payroll/tax/inss-annual");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: PAY_YEAR, exact: true }).click();
  await page.getByRole("button", { name: /generate annual summary/i }).click();
  const annualInssRow = page
    .getByRole("row")
    .filter({ hasText: `${EMPLOYEE.first} ${EMPLOYEE.last}` });
  await expect(annualInssRow).toBeVisible({ timeout: 30_000 });
  await expect(annualInssRow.getByText("$600.00")).toBeVisible();
  await expect(annualInssRow.getByText("$24.00")).toBeVisible();
  await expect(annualInssRow.getByText("$36.00")).toBeVisible();
  const annualInssDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  const annualInssDownload = await annualInssDownloadPromise;
  expect(annualInssDownload.suggestedFilename()).toContain(PAY_YEAR);
  const annualInssPath = await annualInssDownload.path();
  expect(annualInssPath).toBeTruthy();
  expect(await readFile(annualInssPath!, "utf8")).toContain(
    `${EMPLOYEE.first} ${EMPLOYEE.last}`,
  );

  // Form C remains an honest preparation hand-off: persist the accounting
  // checklist, but never claim that Xefe generated or filed the official form.
  checkpoint("monthly and annual INSS verified; saving Form C preparation");
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
    "payroll.run",
    "payroll.approve",
    "payroll.pay",
    "tax.payment_recorded",
    "tax.form_c_preparation_updated",
  ]);
  expect(auditActions).toEqual(
    expect.arrayContaining([
      "payroll.run",
      "payroll.approve",
      "payroll.pay",
      "tax.payment_recorded",
      "tax.form_c_preparation_updated",
    ]),
  );
  // ── 10. Help, and the Art. 64 policy row ────────────────────────────────
  // Before the petroleum step below, which deliberately blocks payroll.
  //
  // The sidebar's "Get help" used to open WhatsApp in a new tab. It now
  // navigates, which is precisely the kind of change that passes typecheck,
  // lint and every unit test while being completely broken in a browser.
  checkpoint("Form C saved; checking help and the Art. 64 policy row");
  await page.getByRole("button", { name: /get help/i }).click();
  await expect(page).toHaveURL(/\/help$/);
  // The human escape hatch has to survive the change, and stay an external
  // link — routing to WhatsApp would strand someone whose app is broken.
  const whatsapp = page.getByRole("link", { name: /whatsapp/i });
  await expect(whatsapp).toHaveAttribute("href", /wa\.me/);

  // Three examples are enough to teach search without turning Help into a
  // tag cloud. The night-shift example also proves aliases land on one answer.
  const suggestedSearches = page.getByLabel(/suggested searches/i);
  await expect(suggestedSearches.getByRole("button")).toHaveCount(3);
  await suggestedSearches
    .getByRole("button", { name: /^night shifts$/i })
    .click();
  await expect(page.getByRole("searchbox")).toHaveValue("Night shifts");
  const nightShiftHit = page
    .getByRole("link", { name: /^night shifts/i })
    .first();
  await expect(nightShiftHit).toHaveAttribute(
    "href",
    "/help/guide/time-and-leave?q=Night+shifts#night-shifts",
  );

  await page.getByRole("searchbox").fill("nigth shift");
  await expect(
    page.getByRole("link", { name: /^night shifts/i }).first(),
  ).toBeVisible();

  // The schedule screen stays compact: one contextual guide link and a
  // conditional next-day hint are enough to explain overnight entry. Phones
  // open on the calmer list instead of squeezing the coverage table.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/time-leave/shifts");
  await expect(
    page.getByRole("heading", { name: /shift scheduling/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("link", { name: /help with this page/i }),
  ).toHaveAttribute("href", "/help/guide/time-and-leave#shifts");
  await expect(page.getByRole("button", { name: /^list$/i }))
    .toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: /^create shift$/i })
    .first()
    .click();
  const shiftDialog = page.getByRole("dialog", { name: /create shift/i });
  await shiftDialog.getByRole("button", { name: "08:00" }).click();
  await shiftDialog.getByLabel("Hour").selectOption("22");
  await shiftDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(shiftDialog.getByText(/ends next day/i)).toBeVisible();
  await shiftDialog.getByRole("button", { name: /^cancel$/i }).click();
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto("/help");

  // The signed-in help center reuses the practical public guides instead of
  // making a new customer discover a second, smaller documentation set.
  const gettingStartedGuide = page.getByRole("link", {
    name: /getting started/i,
  });
  await expect(gettingStartedGuide).toBeVisible();
  await gettingStartedGuide.click();
  await expect(page).toHaveURL(/\/help\/guide\/getting-started$/);
  await expect(
    page.getByRole("heading", { name: /add your team/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /continue setup/i }),
  ).toBeVisible();

  // Dense documentation should reflow for the phones many customers use:
  // tables become labelled cards, and long legal contents start collapsed.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help/guide/tax-and-filings#return-vs-payment");
  await expect(page.getByTestId("doc-table-cards")).toBeVisible();
  await expect(page.getByTestId("doc-table-desktop")).toBeHidden();
  await expect(
    page.getByText("Return due", { exact: true }).first(),
  ).toBeVisible();

  await page.goto("/help/how-xefe-reads-the-law");
  const mobileContentsGroup = page.getByRole("button", {
    name: /questions that change what someone is paid/i,
  });
  const legalQuestion = page.getByRole("link", {
    name: /does dismissal for cause remove the service compensation/i,
  });
  await expect(mobileContentsGroup).toBeVisible();
  await expect(legalQuestion).toBeHidden();
  await mobileContentsGroup.click();
  await expect(legalQuestion).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });

  // Search includes the lazily loaded guide bodies and keeps the section
  // anchor, so the answer opens at the useful paragraph rather than the top.
  await page.goto("/help");
  await page.getByRole("searchbox").fill("bank reconciliation");
  const guideHit = page
    .getByRole("link", { name: /bank reconciliation/i })
    .first();
  await expect(guideHit).toHaveAttribute(
    "href",
    "/help/guide/invoices-and-money?q=bank+reconciliation#bank-reconciliation",
  );
  await guideHit.click();
  await expect(page).toHaveURL(
    /\/help\/guide\/invoices-and-money\?q=bank\+reconciliation#bank-reconciliation$/,
  );
  await expect(page.locator('[data-search-highlight="true"]')).toContainText(
    /bank reconciliation/i,
  );

  const searchBackLink = page.getByRole("link", { name: /back to help/i });
  await expect(searchBackLink).toHaveAttribute(
    "href",
    "/help?q=bank+reconciliation",
  );
  await searchBackLink.click();
  await expect(page.getByRole("searchbox")).toHaveValue("bank reconciliation");
  await expect(guideHit).toBeVisible();

  // A failed search keeps the user in context and puts the human escape hatch
  // beside the empty result instead of making them scroll back to the top.
  await page.getByRole("searchbox").fill("xefe-no-such-answer");
  const noResults = page.getByTestId("help-no-results");
  await expect(noResults).toBeVisible();
  await expect(noResults.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
    "href",
    /wa\.me/,
  );

  await page.goto("/help");

  // Search has to find an entry by the word a reader would type, not by the
  // words the statute uses. "Severance" appears nowhere in the article prose.
  await page.getByRole("searchbox").fill("severance");
  const hit = page.getByRole("link", { name: /service compensation/i }).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(
    /\/help\/how-xefe-reads-the-law\?q=severance#severance-cause$/,
  );
  await expect(page.locator('[data-search-highlight="true"]')).toContainText(
    /service compensation/i,
  );
  // The position itself, not just the debate around it.
  await expect(page.getByText(/what xefe does today/i).first()).toBeVisible();

  // The monthly guide exists for its deadlines. If those stop rendering the
  // page is decoration — so assert the dates, not the headings.
  await page.goto("/help/your-month");
  await expect(
    page.getByText(/by the 15th of the following month/i),
  ).toBeVisible();
  await expect(page.getByText(/first 10 days of the following month/i)).toBeVisible();
  await expect(page.getByText(/by 20 december/i)).toBeVisible();

  // Art. 64 childcare leave: the days and the fact it is unpaid both have to
  // reach the person configuring the policy.
  await page.goto("/time-leave/settings");
  const childcareRow = page.getByRole("button", {
    name: /caring for a sick child/i,
  });
  await expect(childcareRow).toBeVisible();
  await expect(page.getByText(/5 unpaid days a year/i)).toBeVisible();

  // ── 11. A petroleum Contractor cannot run domestic payroll ──────────────
  // Lei 8/2008 Sec. 72.2 sends a Contractor's employees to Schedule IX, a
  // parallel regime. Xefe has not built it, and running them at Schedule V
  // rates UNDER-withholds — Sec. 25.3 makes the shortfall the employer's. The
  // wizard must therefore refuse, not compute. Last in the journey because it
  // deliberately blocks the thing every earlier step needed.
  await page.goto("/payroll/settings");
  // Less-common payroll policies sit behind a disclosure. Schedule V rates are
  // read-only, but the petroleum classification lives in this section.
  await page.getByRole("button", { name: /advanced payroll policies/i }).click();
  const petroleumToggle = page.locator("#petroleum-contractor");
  await petroleumToggle.click();
  await expect(petroleumToggle).toHaveAttribute("data-state", "checked");
  await page
    .getByRole("button", { name: /save payroll configuration/i })
    .click();
  await expect(page.getByText(/saved/i).first()).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/payroll/run");
  await expect(
    page.getByText(/payroll is not available for a petroleum contractor/i),
  ).toBeVisible({ timeout: 20_000 });
  // The wizard itself must be gone, not merely warned over.
  await expect(page.getByRole("button", { name: /^next$/i })).toHaveCount(0);

  // And it lets you back out — a setting that traps you is worse than the bug.
  await page.getByRole("button", { name: /change this in payroll settings/i }).click();
  await expect(page).toHaveURL(/payroll\/settings/, { timeout: 15_000 });

  expect(updateDepthErrors, "React update loops detected").toEqual([]);
});
