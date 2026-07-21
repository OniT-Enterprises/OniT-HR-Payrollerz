/**
 * Focused browser proof for the customer-invoice adjustment chain:
 * issue → receipt → refund → credit note → reports.
 *
 * Every mutation goes through the product UI against production Firestore and
 * Storage rules running in the emulator suite.
 */
import { expect, Page, test } from "@playwright/test";
import {
  closeAdmin,
  findTenantIdByName,
  markSetupComplete,
  waitForEmulators,
  waitForJournalBySource,
} from "./helpers/admin";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Invoice Co ${stamp}`;
const CUSTOMER = `E2E Invoice Customer ${stamp}`;
const OWNER = {
  name: "Isabel Invoice",
  email: `invoice-${stamp}@e2e.test`,
  password: "e2e-Password-4",
};
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

test.beforeAll(async () => waitForEmulators());
test.afterAll(async () => closeAdmin());

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
  await expect(page.getByText(COMPANY).first()).toBeVisible({ timeout: 30_000 });
}

test("refund and credit note stay balanced and flow into reports", async ({
  page,
}) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  await signUpOwner(page);
  const tenantId = await findTenantIdByName(COMPANY);
  await markSetupComplete(tenantId);

  await page.goto("/accounting/chart");
  const initialize = page
    .getByRole("button", { name: /initialize.*default/i })
    .first();
  if (await initialize.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await initialize.click();
  }
  await expect(page.getByText("1000", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/money/invoices/new");
  await page.getByRole("button", { name: /add a customer first/i }).click();
  const customerDialog = page.getByRole("dialog", { name: /new customer/i });
  await customerDialog.getByLabel(/^name/i).fill(CUSTOMER);
  await customerDialog.getByRole("button", { name: /add customer/i }).click();
  await expect(customerDialog).toBeHidden({ timeout: 30_000 });

  await page
    .getByPlaceholder(/description of service or product/i)
    .fill("Advisory services");
  await page.locator('input[name="items.0.quantity"]').fill("1");
  await page.locator('input[name="items.0.unitPrice"]').fill("120");
  await page.getByRole("button", { name: /save & send/i }).click();
  await expect(page).toHaveURL(/\/money\/invoices$/, { timeout: 30_000 });

  const issueJournal = await waitForJournalBySource(tenantId, "invoice");
  expect(issueJournal.byCode["1210"]?.debit ?? 0).toBeCloseTo(120, 2);
  expect(issueJournal.byCode["4100"]?.credit ?? 0).toBeCloseTo(120, 2);

  await page.getByText(CUSTOMER).first().click();
  await page.getByRole("button", { name: /record payment/i }).first().click();
  const paymentDialog = page.getByRole("dialog", { name: /record payment/i });
  await paymentDialog.getByLabel(/reference/i).fill(`RECEIPT-${stamp}`);
  await paymentDialog
    .getByRole("button", { name: /record payment/i })
    .click();
  await expect(paymentDialog).toBeHidden({ timeout: 30_000 });

  const receiptJournal = await waitForJournalBySource(
    tenantId,
    "payment",
    "1210",
  );
  expect(receiptJournal.byCode["1120"]?.debit ?? 0).toBeCloseTo(120, 2);
  expect(receiptJournal.byCode["1210"]?.credit ?? 0).toBeCloseTo(120, 2);

  await page.getByRole("button", { name: "Refund", exact: true }).click();
  const refundDialog = page.getByRole("dialog", { name: /refund payment/i });
  await refundDialog.getByLabel(/refund amount/i).fill("20");
  await refundDialog.getByLabel(/^reason$/i).fill("Service scope reduced");
  await refundDialog.getByRole("button", { name: /record refund/i }).click();
  await expect(refundDialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("$20.00 refunded")).toBeVisible({
    timeout: 30_000,
  });

  const refundJournal = await waitForJournalBySource(tenantId, "refund");
  expect(refundJournal.byCode["1210"]?.debit ?? 0).toBeCloseTo(20, 2);
  expect(refundJournal.byCode["1120"]?.credit ?? 0).toBeCloseTo(20, 2);

  await page.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: /issue credit note/i }).click();
  const creditDialog = page.getByRole("dialog", { name: /issue credit note/i });
  await creditDialog.getByLabel(/credit amount/i).fill("20");
  await creditDialog
    .getByLabel(/^reason$/i)
    .fill("Credit for reduced service scope");
  await creditDialog.getByRole("button", { name: /issue credit note/i }).click();
  await expect(creditDialog).toBeHidden({ timeout: 30_000 });

  const creditNumber = page.getByText(/-CN-01$/);
  await expect(creditNumber).toBeVisible({ timeout: 30_000 });
  const creditJournal = await waitForJournalBySource(tenantId, "credit_note");
  expect(creditJournal.byCode["4100"]?.debit ?? 0).toBeCloseTo(20, 2);
  expect(creditJournal.byCode["1210"]?.credit ?? 0).toBeCloseTo(20, 2);

  const download = page.waitForEvent("download", { timeout: 30_000 });
  await page
    .getByRole("button", { name: /download.*-CN-01/i })
    .click();
  expect((await download).suggestedFilename()).toMatch(/-CN-01\.pdf$/);

  await page.goto("/money/payments");
  await expect(page.getByText("$100.00").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/accounting/statements/income-statement");
  await page.locator('input[type="date"]').nth(0).fill(`${TODAY.slice(0, 4)}-01-01`);
  await page.locator('input[type="date"]').nth(1).fill(TODAY);
  await page.getByRole("button", { name: /^generate$/i }).click();
  const revenueRow = page.getByRole("row").filter({ hasText: "4100" });
  await expect(revenueRow.getByText("$100.00")).toBeVisible({
    timeout: 30_000,
  });
});
