/**
 * First-customer mobile gauntlet for the failure modes that ordinary happy
 * path coverage misses:
 *
 *   signup → recover employee form → slow employee save → payroll draft →
 *   recover money/job forms → public application → overnight shift in EN/PT/TET
 *
 * The deeper accounting and approval assertions remain in the full workflow
 * specs. This one stays deliberately compact enough to run often, at the
 * 390px width and network conditions used by many Xefe customers.
 */
import { expect, type Page, test } from "@playwright/test";
import { pickNthDate } from "./helpers/datePicker";
import {
  adminDb,
  closeAdmin,
  findTenantIdByName,
  markSetupComplete,
  seedDomesticWithholdingVendor,
  waitForEmulators,
} from "./helpers/admin";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Mobile Co ${stamp}`;
const OWNER = {
  name: "Lucia Mobile",
  email: `mobile-${stamp}@e2e.test`,
  password: "e2e-Password-4",
};
const EMPLOYEE = {
  first: "Ana",
  last: "Soares",
};
const CUSTOMER = `Kios ${stamp}`;

test.beforeAll(async () => {
  await waitForEmulators();
});

test.afterAll(async () => {
  await closeAdmin();
});

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}

async function waitForLocalDraftValue(
  page: Page,
  suffix: string,
  path: Array<string | number>,
  expected: string,
) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ draftSuffix, valuePath }) => {
          const key = Object.keys(window.localStorage).find(
            (candidate) =>
              candidate.startsWith("xefe:form-draft:v1:") &&
              candidate.endsWith(draftSuffix),
          );
          const raw = key ? window.localStorage.getItem(key) : null;
          if (!raw) return undefined;

          let value: unknown = JSON.parse(raw);
          for (const segment of valuePath) {
            if (!value || typeof value !== "object") return undefined;
            value = (value as Record<string, unknown>)[String(segment)];
          }
          return value;
        },
        { draftSuffix: suffix, valuePath: path },
      ),
    )
    .toBe(expected);
}

async function expectNoLocalDraft(page: Page, suffix: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (draftSuffix) =>
          Object.keys(window.localStorage).some(
            (key) =>
              key.startsWith("xefe:form-draft:v1:") &&
              key.endsWith(draftSuffix),
          ),
        suffix,
      ),
    )
    .toBe(false);
}

async function reloadPastUnsavedWarning(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
}

async function setLocale(page: Page, locale: "en" | "pt" | "tet") {
  await page.evaluate((nextLocale) => {
    window.sessionStorage.setItem("e2e:locale", nextLocale);
    window.localStorage.setItem("onit:locale", nextLocale);
  }, locale);
  await page.reload();
}

test("a first customer can recover, resume, and work overnight on a phone", async ({
  page,
}) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "onit:locale",
      window.sessionStorage.getItem("e2e:locale") || "en",
    );
  });

  // ── Signup ──────────────────────────────────────────────────────────────
  await page.goto("/auth/signup");
  await expectNoHorizontalScroll(page);
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

  const tenantId = await findTenantIdByName(COMPANY);
  await markSetupComplete(tenantId);
  const vendor = await seedDomesticWithholdingVendor(tenantId);
  const departmentRef = adminDb().collection("departments").doc();
  await departmentRef.set({
    tenantId,
    name: "Operations",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ── Employee recovery, leave warning, and slow save feedback ────────────
  await page.goto("/people/add");
  await expect(
    page.getByRole("heading", { name: /add employee/i }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByLabel(/first name/i).fill(EMPLOYEE.first);
  await page.getByLabel(/last name/i).fill(EMPLOYEE.last);
  await pickNthDate(page, page, 0, "2026-01-05");
  await page
    .getByLabel(/monthly salary/i)
    .first()
    .fill("600");
  await waitForLocalDraftValue(
    page,
    ":employee-new",
    ["data", "form", "salary"],
    "600",
  );

  await reloadPastUnsavedWarning(page);
  await expect(page.getByText("Continue your unfinished form?")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel(/first name/i)).toHaveValue(EMPLOYEE.first);
  await expect(page.getByLabel(/last name/i)).toHaveValue(EMPLOYEE.last);
  await expect(page.getByLabel(/monthly salary/i).first()).toHaveValue("600");

  // Tax residence is a required tax fact — the create below cannot submit
  // without it. Selected after the draft-recovery reload on purpose: the
  // recovery assertions above only cover the drafted text fields.
  await page.getByLabel(/tax residence/i).click();
  await page.getByRole("option", { name: "Timor-Leste resident" }).click();

  const warningMessage = new Promise<string>((resolve) => {
    page.once("dialog", async (dialog) => {
      resolve(dialog.message());
      await dialog.dismiss();
    });
  });
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .last()
    .click();
  expect(await warningMessage).toBe("Leave this form with unsaved changes?");
  await expect(page).toHaveURL(/\/people\/add/);

  // A high-latency connection must explain the wait instead of looking
  // frozen. Once that status appears, remove the throttle and let the same
  // in-flight create finish.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 10_000,
    downloadThroughput: 1_000_000,
    uploadThroughput: 1_000_000,
    connectionType: "cellular3g",
  });
  await page
    .getByRole("button", { name: "Add Employee", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("status").getByText("Still saving — keep this page open."),
  ).toBeVisible({ timeout: 15_000 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await expect(page).toHaveURL(/\/people\/employees/, { timeout: 45_000 });
  await cdp.detach();
  await expect(
    page.getByText(`${EMPLOYEE.first} ${EMPLOYEE.last}`).first(),
  ).toBeVisible();
  await expectNoLocalDraft(page, ":employee-new");
  expect(
    (await adminDb().collection(`tenants/${tenantId}/employees`).get()).size,
  ).toBe(1);

  // ── The existing end-to-end payroll path, now checked at phone width ───
  await page.goto("/payroll/run");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText(`${EMPLOYEE.first} ${EMPLOYEE.last}`).first(),
  ).toBeVisible();
  const complianceAck = page.getByRole("checkbox").first();
  if (await complianceAck.isVisible().catch(() => false)) {
    await complianceAck.click();
    await page
      .getByRole("combobox")
      .filter({ hasText: /select a reason/i })
      .click();
    await page.getByRole("option").first().click();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: /submit for approval/i })
    .last()
    .click();
  await expect(page).toHaveURL(/\/payroll\/history$/, {
    timeout: 45_000,
  });
  expect(
    (
      await adminDb()
        .collection("payrollRuns")
        .where("tenantId", "==", tenantId)
        .get()
    ).size,
  ).toBe(1);

  // ── Invoice recovery and a real offline resume ──────────────────────────
  await page.goto("/money/invoices/new");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: /add a customer first/i }).click();
  const customerDialog = page.getByRole("dialog", { name: /new customer/i });
  await customerDialog.getByLabel(/^name/i).fill(CUSTOMER);
  await customerDialog.getByRole("button", { name: /add customer/i }).click();
  await expect(customerDialog).toBeHidden({ timeout: 30_000 });
  await page
    .getByPlaceholder(/description of service or product/i)
    .fill("Mobile payroll support");
  await page.locator('input[name="items.0.unitPrice"]').fill("75");
  await waitForLocalDraftValue(
    page,
    ":invoice-new",
    ["data", "items", 0, "description"],
    "Mobile payroll support",
  );

  await reloadPastUnsavedWarning(page);
  await expect(page.getByText("Continue your unfinished form?")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByPlaceholder(/description of service or product/i),
  ).toHaveValue("Mobile payroll support");
  await expect(page.getByRole("combobox").first()).toContainText(CUSTOMER);

  await page.context().setOffline(true);
  // Two taps can arrive before React paints the disabled state. Send both
  // while offline, then verify the pending operation resumes as one create
  // when connectivity returns.
  await page.getByRole("button", { name: /save draft/i }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Still saving — keep this page open.",
    {
      timeout: 15_000,
    },
  );
  await page.context().setOffline(false);
  await expect(page).toHaveURL(/\/money\/invoices$/, { timeout: 45_000 });
  await expectNoLocalDraft(page, ":invoice-new");
  const invoices = await adminDb()
    .collection(`tenants/${tenantId}/invoices`)
    .get();
  expect(invoices.size).toBe(1);
  expect(invoices.docs[0].data().invoiceNumber).toMatch(/^INV-\d{4}-001$/);
  expect(
    (
      await adminDb().doc(`tenants/${tenantId}/settings/invoice_settings`).get()
    ).data()?.nextNumber,
  ).toBe(2);

  // ── Bill recovery and one stable payable after an offline double tap ───
  await page.goto("/money/bills/new");
  await expectNoHorizontalScroll(page);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: vendor.name }).click();
  await page.getByPlaceholder(/what is this bill for/i).fill("Mobile data plan");
  await page.locator('input[name="amount"]').fill("42");
  await waitForLocalDraftValue(
    page,
    ":bill-new",
    ["data", "description"],
    "Mobile data plan",
  );

  await reloadPastUnsavedWarning(page);
  await expect(page.getByText("Continue your unfinished form?")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByPlaceholder(/what is this bill for/i)).toHaveValue(
    "Mobile data plan",
  );
  await expect(page.getByRole("combobox").first()).toContainText(vendor.name);

  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Save", exact: true }).last().evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Still saving — keep this page open.",
    { timeout: 15_000 },
  );
  await page.context().setOffline(false);
  await expect(page).toHaveURL(/\/money\/bills\/[^/]+$/, { timeout: 45_000 });
  await expectNoLocalDraft(page, ":bill-new");
  expect(
    (await adminDb().collection(`tenants/${tenantId}/bills`).get()).size,
  ).toBe(1);

  // ── Recurring invoice recovery, stable retry, and thumb-reach save ─────
  await page.goto("/money/invoices/recurring/new");
  await expectNoHorizontalScroll(page);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: CUSTOMER }).click();
  await page
    .getByPlaceholder(/service or product description/i)
    .fill("Monthly payroll support");
  await page.locator('input[name="items.0.unitPrice"]').fill("90");
  await waitForLocalDraftValue(
    page,
    ":recurring-invoice-new",
    ["data", "items", 0, "description"],
    "Monthly payroll support",
  );

  await reloadPastUnsavedWarning(page);
  await expect(page.getByText("Continue your unfinished form?")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByPlaceholder(/service or product description/i),
  ).toHaveValue("Monthly payroll support");
  await expect(page.getByRole("combobox").first()).toContainText(CUSTOMER);

  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Create Recurring", exact: true })
    .last()
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Still saving — keep this page open.",
    { timeout: 15_000 },
  );
  await page.context().setOffline(false);
  await expect(page).toHaveURL(/\/money\/invoices\/recurring$/, {
    timeout: 45_000,
  });
  await expectNoLocalDraft(page, ":recurring-invoice-new");
  expect(
    (await adminDb().collection(`tenants/${tenantId}/recurring_invoices`).get()).size,
  ).toBe(1);

  // ── Job recovery and one atomic public/private posting after retry ─────
  await page.goto("/people/jobs");
  await expectNoHorizontalScroll(page);
  const firstJobHeading = page.getByRole("heading", {
    name: "Create your first job",
  });
  await expect(firstJobHeading).toBeVisible();
  const firstJobState = firstJobHeading.locator("..").locator("..");
  const firstJobStateBox = await firstJobState.boundingBox();
  expect(firstJobStateBox?.height).toBeLessThan(280);
  const firstJobButton = page.getByRole("button", {
    name: "New job",
    exact: true,
  });
  await expect(firstJobButton).toHaveCount(1);
  await firstJobButton.click();
  await expect(page).toHaveURL(/\/people\/jobs\/new$/);
  await expectNoHorizontalScroll(page);
  await page.getByLabel(/job title/i).fill("Payroll Assistant");
  await page.getByLabel(/department/i).click();
  await page.getByRole("option", { name: "Operations" }).click();
  await page.getByLabel(/work location/i).fill("Dili");
  await page
    .getByLabel(/job description/i)
    .fill("Support monthly payroll and employee records.");
  await waitForLocalDraftValue(
    page,
    ":job-new",
    ["data", "title"],
    "Payroll Assistant",
  );

  await reloadPastUnsavedWarning(page);
  await expect(page.getByText("Continue your unfinished form?")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel(/job title/i)).toHaveValue("Payroll Assistant");
  await expect(page.getByLabel(/department/i)).toContainText("Operations");
  await expect(page.getByLabel(/job description/i)).toHaveValue(
    "Support monthly payroll and employee records.",
  );
  await expect(page.getByLabel(/probation length/i)).toContainText("30 days");

  const jobWarningMessage = new Promise<string>((resolve) => {
    page.once("dialog", async (dialog) => {
      resolve(dialog.message());
      await dialog.dismiss();
    });
  });
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .last()
    .click();
  expect(await jobWarningMessage).toBe("Leave this form with unsaved changes?");
  await expect(page).toHaveURL(/\/people\/jobs\/new$/);

  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Create Job", exact: true })
    .last()
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Still saving — keep this page open.",
    { timeout: 15_000 },
  );
  await page.context().setOffline(false);
  const shareJobDialog = page.getByRole("dialog", { name: "Share job post" });
  await expect(shareJobDialog).toBeVisible({ timeout: 45_000 });
  await expectNoLocalDraft(page, ":job-new");
  const jobs = await adminDb()
    .collection("jobs")
    .where("tenantId", "==", tenantId)
    .get();
  const jobPrivateDetails = await adminDb()
    .collection("jobPrivateDetails")
    .where("tenantId", "==", tenantId)
    .get();
  expect(jobs.size).toBe(1);
  expect(jobPrivateDetails.size).toBe(1);
  expect(jobPrivateDetails.docs[0].id).toBe(jobs.docs[0].id);
  await shareJobDialog.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/people\/jobs\?job=/);

  // ── Public applicant protection without persisting PII on the device ───
  await page.goto(`/apply/${jobs.docs[0].id}`);
  await expectNoHorizontalScroll(page);
  await page.getByLabel(/full name/i).fill("Maria Candidate");
  await page.getByLabel(/^email/i).fill(`candidate-${stamp}@e2e.test`);
  await page.getByLabel(/mobile/i).fill("77123456");
  await page.getByLabel(/cv \/ resume/i).setInputFiles({
    name: "maria-cv.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% E2E candidate CV\n"),
  });

  const applicationWarningMessage = new Promise<string>((resolve) => {
    page.once("dialog", async (dialog) => {
      resolve(dialog.message());
      await dialog.dismiss();
    });
  });
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  expect(await applicationWarningMessage).toBe(
    "Leave this application with unsaved changes?",
  );
  await expect(page).toHaveURL(new RegExp(`/apply/${jobs.docs[0].id}$`));

  // The public form silently absorbs submissions completed in under one
  // second as bots; cross that intentional threshold before the real submit.
  await page.waitForTimeout(1_100);
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .last()
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(
    page.getByRole("heading", { name: "Application submitted" }),
  ).toBeVisible({ timeout: 45_000 });
  expect(
    (
      await adminDb()
        .collection("jobApplications")
        .where("tenantId", "==", tenantId)
        .get()
    ).size,
  ).toBe(1);

  // Only one tenant timestamp per first-use action: no actors, record IDs,
  // money, page views, or other behavioural payloads.
  await expect
    .poll(async () => {
      const snapshot = await adminDb()
        .collection(`tenants/${tenantId}/productMilestones`)
        .get();
      return snapshot.docs.map((entry) => entry.id).sort();
    })
    .toEqual([
      "first_bill_created",
      "first_employee_created",
      "first_invoice_created",
      "first_payroll_run_created",
      "first_recurring_invoice_created",
      "signup_completed",
    ]);

  // ── Overnight shifts and the same 24-hour control in all app languages ─
  await page.goto("/time-leave/shifts");
  await expectNoHorizontalScroll(page);
  await expect(page.getByRole("button", { name: /^list$/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("button", { name: /^create shift$/i })
    .first()
    .click();
  const shiftDialog = page.getByRole("dialog", { name: /create shift/i });
  await shiftDialog.getByRole("combobox").first().click();
  await page
    .getByRole("option", { name: `${EMPLOYEE.first} ${EMPLOYEE.last}` })
    .click();
  await shiftDialog.getByRole("button", { name: "08:00" }).click();
  await shiftDialog.getByLabel("Hour").selectOption("22");
  await shiftDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(shiftDialog.getByText(/ends next day/i)).toBeVisible();
  await shiftDialog.getByPlaceholder("Select location").fill("Dili Office");
  await shiftDialog
    .getByRole("button", { name: "Create Shift", exact: true })
    .click();
  await expect(shiftDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(/22:00.*17:00.*ends next day/i)).toBeVisible();

  await setLocale(page, "pt");
  await expectNoHorizontalScroll(page);
  await page
    .getByRole("button", { name: "Criar Turno", exact: true })
    .first()
    .click();
  const ptShiftDialog = page.getByRole("dialog", { name: "Criar Turno" });
  await ptShiftDialog.getByRole("button", { name: "08:00" }).click();
  await expect(ptShiftDialog.getByText("Seleção rápida")).toBeVisible();
  await expect(ptShiftDialog.getByLabel("Hora")).toBeVisible();
  await expect(ptShiftDialog.getByLabel("Minuto")).toBeVisible();
  await ptShiftDialog.getByRole("button", { name: "Concluir" }).click();
  await ptShiftDialog.getByRole("button", { name: "Cancelar" }).click();

  await setLocale(page, "tet");
  await expectNoHorizontalScroll(page);
  await page
    .getByRole("button", { name: "Kria Turnu", exact: true })
    .first()
    .click();
  const tetShiftDialog = page.getByRole("dialog", { name: "Kria Turnu" });
  await tetShiftDialog.getByRole("button", { name: "08:00" }).click();
  await expect(tetShiftDialog.getByText("Hili lalais")).toBeVisible();
  await expect(tetShiftDialog.getByLabel("Oras")).toBeVisible();
  await expect(tetShiftDialog.getByLabel("Minutu")).toBeVisible();
  await tetShiftDialog.getByRole("button", { name: "Remata" }).click();
  await tetShiftDialog.getByRole("button", { name: "Kansela" }).click();
});
