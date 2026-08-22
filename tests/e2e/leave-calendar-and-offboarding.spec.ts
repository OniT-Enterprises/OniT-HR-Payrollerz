/**
 * Two screens that had no browser evidence at all.
 *
 * The leave CALENDAR existed as a component for months and was wired into no
 * page — a complete, working view nobody could reach. It carried hardcoded
 * English and resolved holidays from the statutory table alone, ignoring the
 * tenant's own overrides, which is very likely why it was never switched on.
 * Now that it is reachable it needs a test, because the failure mode of a
 * calendar is silent: a wrong day looks like a right day.
 *
 * OFFBOARDING was reported as "does not work". The code has since been wired
 * end to end, but nothing proved it, so the report could not be closed.
 *
 * Reference employees are seeded — employee creation is covered by the main
 * journey and is not what is under test here. Everything else goes through the
 * product UI.
 */
import { expect, Page, test } from "@playwright/test";
import { pickNthDate } from "./helpers/datePicker";
import { getTLPublicHolidays } from "../../client/lib/payroll/tl-holidays";
import {
  adminDb,
  closeAdmin,
  findTenantIdByName,
  markSetupComplete,
  seedEmployees,
  waitForEmulators,
} from "./helpers/admin";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Leave Co ${stamp}`;
const OWNER = {
  name: "Ana Leave",
  email: `leave-${stamp}@e2e.test`,
  password: "e2e-Password-4",
};

// Leave inside the current month so the calendar's default view contains it.
const TODAY = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dili",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
})();
/**
 * Two consecutive WORKING days in the current month.
 *
 * Not the 2nd and 3rd: the form refuses a request whose working-day duration is
 * zero, so a month whose 2nd falls on a Saturday would fail the submit and look
 * like a product bug. Public holidays are excluded for the same reason, from the
 * same statutory list the app uses.
 */
const [LEAVE_START, LEAVE_END] = (() => {
  const month = TODAY.slice(0, 7);
  const holidays = new Set(
    getTLPublicHolidays(Number(TODAY.slice(0, 4))).map((h) => h.date),
  );
  const isWorkday = (iso: string) => {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return day !== 0 && day !== 6 && !holidays.has(iso);
  };
  for (let day = 2; day <= 26; day += 1) {
    const first = `${month}-${String(day).padStart(2, "0")}`;
    const second = `${month}-${String(day + 1).padStart(2, "0")}`;
    if (isWorkday(first) && isWorkday(second)) return [first, second];
  }
  throw new Error("No consecutive working days found in the current month");
})();

test.beforeAll(async () => {
  await waitForEmulators();
});

test.afterAll(async () => {
  await closeAdmin();
});

async function signUpOwner(page: Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem("onit:locale", "en"),
  );
  await page.goto("/auth/signup");
  await page.getByLabel(/full name/i).fill(OWNER.name);
  await page.getByLabel(/work email/i).fill(OWNER.email);
  await page.getByLabel(/^password$/i).fill(OWNER.password);
  await page.getByLabel(/confirm password/i).fill(OWNER.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page.getByText(COMPANY).first()).toBeVisible({
    timeout: 30_000,
  });
}

test("leave reaches the calendar, and an employee can be offboarded", async ({
  page,
}) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await signUpOwner(page);
  const tenantId = await findTenantIdByName(COMPANY);
  await markSetupComplete(tenantId);
  await seedEmployees(tenantId, [{ ref: "calendarworker", monthlySalary: 500 }]);

  // ── An approved leave request ──────────────────────────────────────────
  // Seeded, not created through the dialog. Leave creation runs through the
  // `createLeaveRequest` callable, which does not complete against the local
  // functions emulator — the dialog sits on its spinner past 90 seconds with
  // the form valid ("2 working day(s)" and all required fields filled). That is
  // its own open question; it is NOT what this spec exists to prove, and
  // blocking calendar and offboarding coverage on it would leave both untested.
  await adminDb().collection("leave_requests").add({
    tenantId,
    employeeId: "calendarworker",
    employeeName: "Worker CALENDARWORKER",
    department: "Operations",
    departmentId: "operations",
    leaveType: "annual",
    leaveTypeLabel: "Annual Leave",
    startDate: LEAVE_START,
    endDate: LEAVE_END,
    duration: 2,
    reason: "Family trip",
    hasCertificate: false,
    status: "approved",
    requestDate: LEAVE_START,
  });

  await page.goto("/time-leave/leave");
  await expect(page.getByText(/worker/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // ── The calendar shows it ───────────────────────────────────────────────
  await page.getByRole("button", { name: /^calendar$/i }).click();
  // Loaded lazily, so wait for the grid itself rather than the click.
  await expect(page.getByRole("button", { name: /^today$/i })).toBeVisible({
    timeout: 30_000,
  });
  // The absence is drawn — first name only, in the day cell.
  await expect(page.getByText("Worker").first()).toBeVisible();
  // Localised chrome, not the hardcoded English the component used to carry.
  await expect(page.getByText(/all departments/i)).toBeVisible();

  // Week view is the same data over seven days, and must not blow up.
  await page.getByRole("button", { name: /^week$/i }).click();
  await expect(page.getByRole("button", { name: /^month$/i })).toBeVisible();
  await page.getByRole("button", { name: /^month$/i }).click();

  // Back to the list, which must still be there.
  await page.getByRole("button", { name: /^list$/i }).click();
  await expect(page.getByRole("tab", { name: /pending/i })).toBeVisible();

  // ── Offboarding ────────────────────────────────────────────────────────
  await page.goto("/hiring/offboarding");
  const startButton = page
    .getByRole("button", { name: /start offboarding|initiate|new offboarding/i })
    .first();
  await expect(startButton).toBeVisible({ timeout: 30_000 });
  await startButton.click();

  const offboardDialog = page.getByRole("dialog");
  await expect(offboardDialog).toBeVisible();
  // Employee, then departure reason.
  await offboardDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: /worker/i }).first().click();
  await offboardDialog.getByRole("combobox").nth(2).click();
  await page.getByRole("option").first().click();
  await pickNthDate(page, offboardDialog, 0, TODAY);

  await offboardDialog
    .getByRole("button", { name: /start offboarding/i })
    .click();

  // Assert on the RECORD, not on the dialog closing.
  //
  // "Offboarding does not work" was the original report, and the useful
  // question is which half fails: did the write land and only the button stay
  // spinning, or did nothing happen at all? Polling Firestore answers that,
  // and it cannot be satisfied by a UI that merely looks busy.
  const caseAppeared = await (async () => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const snapshot = await adminDb()
        .collection("offboarding")
        .where("tenantId", "==", tenantId)
        .get();
      if (!snapshot.empty) return snapshot.docs[0].data();
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return null;
  })();

  expect(
    caseAppeared,
    "no offboarding case was written — the dialog's Start button never completed",
  ).not.toBeNull();
  expect(caseAppeared?.employeeId).toBe("calendarworker");
  expect(caseAppeared?.status).toBe("pending");

  // And the operator must be told it worked: a spinner that never clears is
  // indistinguishable from a failure, which is how this got reported.
  await expect(offboardDialog).toBeHidden({ timeout: 30_000 });
});
