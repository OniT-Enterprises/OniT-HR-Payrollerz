/**
 * Browser evidence for the non-payroll accounting chains that must agree with
 * the ledger before launch:
 *
 *   invoice → issue → receipt → refund → credit note → bank reconciliation
 *   bill → supplier withholding settlement → payment journal
 *   fixed-asset acquisition → depreciation journal → fiscal-period close
 *
 * Reference vendor facts are seeded because vendor maintenance is not under
 * test here. Every financial mutation is performed through the product UI.
 */
import { expect, Page, test } from "@playwright/test";
import {
  closeAdmin,
  findTenantIdByName,
  markSetupComplete,
  seedDomesticWithholdingVendor,
  waitForAuditActions,
  waitForEmulators,
  waitForJournalBySource,
} from "./helpers/admin";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Books Co ${stamp}`;
const OWNER = {
  name: "Beatriz Books",
  email: `books-${stamp}@e2e.test`,
  password: "e2e-Password-3",
};
const CUSTOMER = `E2E Customer ${stamp}`;
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
const CURRENT_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "long",
}).format(new Date(`${TODAY}T12:00:00+09:00`));

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

test("invoice, bill, asset, depreciation, reconciliation, and close reach balanced books", async ({
  page,
}) => {
  // This journey intentionally exercises every non-payroll posting chain and
  // the resulting statements. Firebase emulator startup and serial journal
  // polling make four minutes too tight on slower development machines.
  test.setTimeout(480_000);
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log("[console.error]", message.text().slice(0, 400));
    }
  });

  await signUpOwner(page);
  const tenantId = await findTenantIdByName(COMPANY);
  await markSetupComplete(tenantId);
  const vendor = await seedDomesticWithholdingVendor(tenantId);

  // Accounting source documents only post when a chart exists. Signup may
  // provision it already; otherwise use the same empty-state action a
  // first-time customer sees.
  await page.goto("/accounting/chart");
  const initialize = page
    .getByRole("button", { name: /initialize.*default/i })
    .first();
  if (await initialize.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await initialize.click();
  }
  // The chart renders its top-level groups collapsed. Seeing the 1000 group
  // proves initialization completed; its 1110 child still exists for posting.
  await expect(page.getByText("1000", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });

  // ── Invoice → issue journal → receipt journal ───────────────────────────
  await page.goto("/money/invoices/new");
  await page.getByRole("button", { name: /add a customer first/i }).click();
  const customerDialog = page.getByRole("dialog", { name: /new customer/i });
  await customerDialog.getByLabel(/^name/i).fill(CUSTOMER);
  await customerDialog.getByRole("button", { name: /add customer/i }).click();
  await expect(customerDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByRole("combobox").first()).toContainText(CUSTOMER);

  await page
    .getByPlaceholder(/description of service or product/i)
    .fill("Accounting support");
  await page.locator('input[name="items.0.quantity"]').fill("1");
  await page.locator('input[name="items.0.unitPrice"]').fill("120");
  await expect(
    page.getByPlaceholder(/description of service or product/i),
  ).toHaveValue("Accounting support");
  await page.getByRole("button", { name: /save & send/i }).click();
  await expect(page).toHaveURL(/\/money\/invoices$/, { timeout: 30_000 });
  await expect(page.getByText(CUSTOMER).first()).toBeVisible();

  const invoiceJournal = await waitForJournalBySource(tenantId, "invoice");
  expect(invoiceJournal.byCode["1210"]?.debit ?? 0).toBeCloseTo(120, 2);
  expect(invoiceJournal.byCode["4100"]?.credit ?? 0).toBeCloseTo(120, 2);
  expect(invoiceJournal.totalDebit).toBeCloseTo(invoiceJournal.totalCredit, 2);

  // The receivable appears in the customer aging report before settlement,
  // with 61–90 and 90+ kept as separate columns.
  await page.goto("/money/financials/ar-aging");
  const customerAgingRow = page.getByRole("row").filter({ hasText: CUSTOMER });
  await expect(customerAgingRow).toBeVisible({ timeout: 30_000 });
  await expect(customerAgingRow.getByText("$120").first()).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "61-90" }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "90+" }).last(),
  ).toBeVisible();

  await page.goto("/money/invoices");
  await page.getByText(CUSTOMER).first().click();
  await page
    .getByRole("button", { name: /record payment/i })
    .first()
    .click();
  const receiptDialog = page.getByRole("dialog", { name: /record payment/i });
  await receiptDialog.getByLabel(/reference/i).fill(`INV-RECEIPT-${stamp}`);
  await receiptDialog.getByRole("button", { name: /record payment/i }).click();
  await expect(receiptDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(/paid/i).first()).toBeVisible();

  const receiptJournal = await waitForJournalBySource(
    tenantId,
    "payment",
    "1210",
  );
  expect(receiptJournal.byCode["1120"]?.debit ?? 0).toBeCloseTo(120, 2);
  expect(receiptJournal.byCode["1210"]?.credit ?? 0).toBeCloseTo(120, 2);
  expect(receiptJournal.totalDebit).toBeCloseTo(receiptJournal.totalCredit, 2);

  // Return part of the receipt, then clear the reopened receivable with a
  // formal credit note. Both adjustments must be visible and post balanced
  // reversals; the invoice finishes settled by $100 net cash + $20 credit.
  await page.getByRole("button", { name: "Refund", exact: true }).click();
  const refundDialog = page.getByRole("dialog", { name: /refund payment/i });
  await refundDialog.getByLabel(/refund amount/i).fill("20");
  await refundDialog.getByLabel(/^reason$/i).fill("Service scope reduced");
  await refundDialog.getByRole("button", { name: /record refund/i }).click();
  await expect(refundDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("$20.00 refunded")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: /issue credit note/i }).click();
  const creditDialog = page.getByRole("dialog", { name: /issue credit note/i });
  await creditDialog.getByLabel(/credit amount/i).fill("20");
  await creditDialog
    .getByLabel(/^reason$/i)
    .fill("Credit for reduced service scope");
  await creditDialog
    .getByRole("button", { name: /issue credit note/i })
    .click();
  await expect(creditDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(/-CN-01$/)).toBeVisible({ timeout: 30_000 });

  const refundJournal = await waitForJournalBySource(tenantId, "refund");
  expect(refundJournal.byCode["1210"]?.debit ?? 0).toBeCloseTo(20, 2);
  expect(refundJournal.byCode["1120"]?.credit ?? 0).toBeCloseTo(20, 2);
  expect(refundJournal.totalDebit).toBeCloseTo(refundJournal.totalCredit, 2);

  const creditJournal = await waitForJournalBySource(tenantId, "credit_note");
  expect(creditJournal.byCode["4100"]?.debit ?? 0).toBeCloseTo(20, 2);
  expect(creditJournal.byCode["1210"]?.credit ?? 0).toBeCloseTo(20, 2);
  expect(creditJournal.totalDebit).toBeCloseTo(creditJournal.totalCredit, 2);

  // Import the real bank line, link it to the receipt already recorded above,
  // then reconcile it. Linking must not create a second cash journal.
  await page.goto("/accounting/reconciliation");
  await page.locator('input[type="file"]').setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `Date,Description,Amount\n${TODAY},E2E customer receipt ${stamp},120.00\n${TODAY},E2E customer refund ${stamp},-20.00\n`,
    ),
  });
  const bankRow = page
    .getByRole("row")
    .filter({ hasText: `E2E customer receipt ${stamp}` });
  await expect(bankRow).toBeVisible({ timeout: 30_000 });
  await bankRow.hover();
  await bankRow.getByRole("button", { name: /actions for/i }).click();
  await page.getByRole("menuitem", { name: /^match$/i }).click();
  const matchDialog = page.getByRole("dialog", { name: /match transaction/i });
  const recordedReceipt = matchDialog
    .getByRole("button")
    .filter({ hasText: CUSTOMER })
    .first();
  await expect(recordedReceipt).toBeVisible({ timeout: 30_000 });
  await recordedReceipt.click();
  await expect(matchDialog).toBeHidden({ timeout: 30_000 });
  await expect(bankRow.getByText(/^matched$/i)).toBeVisible();
  await bankRow.getByRole("checkbox").click();
  await page.getByRole("button", { name: /mark reconciled/i }).click();
  await expect(bankRow.getByText(/^reconciled$/i)).toBeVisible({
    timeout: 30_000,
  });

  const refundBankRow = page
    .getByRole("row")
    .filter({ hasText: `E2E customer refund ${stamp}` });
  await expect(refundBankRow).toBeVisible({ timeout: 30_000 });
  await refundBankRow.hover();
  await refundBankRow.getByRole("button", { name: /actions for/i }).click();
  await page.getByRole("menuitem", { name: /^match$/i }).click();
  const refundMatchDialog = page.getByRole("dialog", {
    name: /match transaction/i,
  });
  const recordedRefund = refundMatchDialog
    .getByRole("button")
    .filter({ hasText: /recorded refund/i })
    .filter({ hasText: CUSTOMER })
    .first();
  await expect(recordedRefund).toBeVisible({ timeout: 30_000 });
  await recordedRefund.click();
  await expect(refundMatchDialog).toBeHidden({ timeout: 30_000 });
  await expect(refundBankRow.getByText(/^matched$/i)).toBeVisible();
  await refundBankRow.getByRole("checkbox").click();
  await page.getByRole("button", { name: /mark reconciled/i }).click();
  await expect(refundBankRow.getByText(/^reconciled$/i)).toBeVisible({
    timeout: 30_000,
  });

  // ── Bill → payer withholding → supplier payment journal ────────────────
  await page.goto("/money/bills/new");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: vendor.name }).click();
  await page
    .getByPlaceholder(/what is this bill for/i)
    .fill("Construction services");
  await page.locator('input[name="amount"]').fill("1000");
  await page.getByRole("button", { name: /more details/i }).click();
  const withholdingBlock = page
    .getByText("Supplier withholding", { exact: true })
    .locator("..");
  await withholdingBlock.getByRole("combobox").click();
  await page.getByRole("option", { name: /construction activities/i }).click();
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page).not.toHaveURL(/\/money\/bills\/new$/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/money\/bills\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByText(/construction activities.*2%/i)).toBeVisible();

  const billJournal = await waitForJournalBySource(tenantId, "bill");
  expect(billJournal.byCode["2110"]?.credit ?? 0).toBeCloseTo(1000, 2);
  expect(billJournal.totalDebit).toBeCloseTo(billJournal.totalCredit, 2);

  const billDetailUrl = page.url();
  await page.goto("/money/financials/ap-aging");
  const vendorAgingRow = page.getByRole("row").filter({ hasText: vendor.name });
  await expect(vendorAgingRow).toBeVisible({ timeout: 30_000 });
  await expect(vendorAgingRow.getByText("$1,000").first()).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "61-90" }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "90+" }).last(),
  ).toBeVisible();

  await page.goto(billDetailUrl);
  await page
    .getByRole("button", { name: /record payment/i })
    .first()
    .click();
  const billPaymentDialog = page.getByRole("dialog", {
    name: /record payment/i,
  });
  await billPaymentDialog.locator('input[type="number"]').fill("1000");
  await billPaymentDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: /bank transfer/i }).click();
  await expect(billPaymentDialog.getByText("$20.00")).toBeVisible();
  await expect(billPaymentDialog.getByText("$980.00")).toBeVisible();
  await billPaymentDialog
    .getByRole("button", { name: /record payment/i })
    .click({ timeout: 10_000 });
  await expect(billPaymentDialog).toBeHidden({ timeout: 30_000 });

  const billPaymentJournal = await waitForJournalBySource(
    tenantId,
    "payment",
    "2320",
  );
  expect(billPaymentJournal.byCode["2110"]?.debit ?? 0).toBeCloseTo(1000, 2);
  expect(billPaymentJournal.byCode["1120"]?.credit ?? 0).toBeCloseTo(980, 2);
  expect(billPaymentJournal.byCode["2320"]?.credit ?? 0).toBeCloseTo(20, 2);
  expect(billPaymentJournal.totalDebit).toBeCloseTo(
    billPaymentJournal.totalCredit,
    2,
  );

  // ── Asset acquisition → monthly depreciation ───────────────────────────
  await page.goto("/accounting/fixed-assets");
  await page.getByRole("button", { name: /add asset/i }).click();
  const assetDialog = page.getByRole("dialog", { name: /add asset/i });
  await assetDialog.getByLabel(/asset name/i).fill("E2E Coffee Machine");
  await assetDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: /post the acquisition now/i }).click();
  await assetDialog.getByRole("combobox").nth(2).click();
  await page.getByRole("option", { name: /1120/ }).click();
  await assetDialog.getByLabel(/cost/i).fill("1200");
  await assetDialog.getByLabel(/useful life/i).fill("12");
  await assetDialog.getByRole("button", { name: /^save$/i }).click();
  await expect(
    page.locator("#main-content").getByText("E2E Coffee Machine").first(),
  ).toBeVisible({ timeout: 30_000 });

  const acquisitionJournal = await waitForJournalBySource(
    tenantId,
    "fixed_asset_acquisition",
  );
  expect(acquisitionJournal.byCode["1530"]?.debit ?? 0).toBeCloseTo(1200, 2);
  expect(acquisitionJournal.byCode["1120"]?.credit ?? 0).toBeCloseTo(1200, 2);
  expect(acquisitionJournal.totalDebit).toBeCloseTo(
    acquisitionJournal.totalCredit,
    2,
  );

  await page.getByRole("button", { name: /post depreciation/i }).click();
  const depreciationDialog = page.getByRole("dialog", {
    name: /post depreciation/i,
  });
  await expect(depreciationDialog.getByText("$100.00").first()).toBeVisible();
  await depreciationDialog.getByRole("button", { name: /^post /i }).click();
  await expect(depreciationDialog).toBeHidden({ timeout: 30_000 });

  const depreciationJournal = await waitForJournalBySource(
    tenantId,
    "depreciation",
  );
  expect(depreciationJournal.byCode["5800"]?.debit ?? 0).toBeCloseTo(100, 2);
  expect(depreciationJournal.byCode["1590"]?.credit ?? 0).toBeCloseTo(100, 2);
  expect(depreciationJournal.totalDebit).toBeCloseTo(
    depreciationJournal.totalCredit,
    2,
  );

  // ── Posted journals → statements, filters, exports, cash reconciliation ─
  const yearStart = `${TODAY.slice(0, 4)}-01-01`;

  await page.goto("/accounting/statements/trial-balance");
  await page.locator('input[type="date"]').nth(0).fill(yearStart);
  await page.locator('input[type="date"]').nth(1).fill(TODAY);
  await page.getByRole("button", { name: /^generate$/i }).click();
  await expect(page.getByText("4100", { exact: true }).last()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /more details/i }).click();
  await expect(page.getByText(/books are balanced/i)).toBeVisible();
  const trialDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  expect((await trialDownloadPromise).suggestedFilename()).toBe(
    `trial-balance-${TODAY}.csv`,
  );

  await page.goto("/accounting/statements/income-statement");
  await page.locator('input[type="date"]').nth(0).fill(yearStart);
  await page.locator('input[type="date"]').nth(1).fill(TODAY);
  await page.getByRole("button", { name: /^generate$/i }).click();
  const revenueRow = page.getByRole("row").filter({ hasText: "4100" });
  await expect(revenueRow).toBeVisible({ timeout: 30_000 });
  await expect(revenueRow.getByText("$100.00")).toBeVisible();
  const incomeDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  expect((await incomeDownloadPromise).suggestedFilename()).toBe(
    `income-statement-${yearStart}-to-${TODAY}.csv`,
  );

  await page.goto("/accounting/statements/balance-sheet");
  await page.locator('input[type="date"]').fill(TODAY);
  await page.getByRole("button", { name: /^generate$/i }).click();
  await expect(page.getByText(/total assets/i).last()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /more details/i }).click();
  await expect(page.getByText(/balance sheet is balanced/i)).toBeVisible();
  const balanceDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  expect((await balanceDownloadPromise).suggestedFilename()).toBe(
    `balance-sheet-${TODAY}.csv`,
  );

  await page.goto("/accounting/statements/cash-flow");
  await expect(page.getByText(/cash flow statement/i)).toBeVisible({
    timeout: 30_000,
  });
  const customerPaymentsRow = page
    .getByText(/customer payments/i)
    .locator("..");
  await expect(
    customerPaymentsRow.getByText("$120", { exact: true }),
  ).toBeVisible();
  const customerRefundsRow = page.getByText(/customer refunds/i).locator("..");
  await expect(
    customerRefundsRow.getByText("$20", { exact: true }),
  ).toBeVisible();
  const vendorPaymentsRow = page.getByText(/vendor payments/i).locator("..");
  await expect(
    vendorPaymentsRow.getByText("$980", { exact: true }),
  ).toBeVisible();
  const otherOutflowsRow = page.getByText(/other outflows/i).locator("..");
  await expect(
    otherOutflowsRow.getByText("$1,200", { exact: true }),
  ).toBeVisible();

  // ── Close the period only after every posting above is complete ─────────
  await page.goto("/accounting/statements/fiscal-periods");
  const createYear = page.getByRole("button", { name: /create.*fiscal year/i });
  await expect(createYear).toBeVisible({ timeout: 30_000 });
  await createYear.click();
  const currentMonthCell = page.getByRole("cell", {
    name: new RegExp(`^${CURRENT_MONTH}\\b`),
  });
  await expect(currentMonthCell).toBeVisible({ timeout: 30_000 });
  const currentPeriodRow = currentMonthCell.locator("..");
  await currentPeriodRow.getByRole("button", { name: /close period/i }).click();
  const closeDialog = page.getByRole("alertdialog", {
    name: /close this period/i,
  });
  await closeDialog.getByRole("button", { name: /close period/i }).click();
  await expect(currentPeriodRow.getByText(/^closed$/i)).toBeVisible({
    timeout: 30_000,
  });

  const auditActions = await waitForAuditActions(tenantId, [
    "accounting.journal_post",
    "accounting.period_create_year",
    "accounting.period_close",
  ]);
  expect(auditActions).toEqual(
    expect.arrayContaining([
      "accounting.journal_post",
      "accounting.period_create_year",
      "accounting.period_close",
    ]),
  );
});
