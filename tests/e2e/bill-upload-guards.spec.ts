/**
 * The guards between an uploaded document and a saved bill, in a real browser.
 *
 * Each of these exists because a real Timor-Leste document broke it, and each is
 * a money error the user would not otherwise see:
 *
 *   - a euro invoice pre-filled into a USD-only field, saved as dollars
 *   - one file holding two invoices, booking one and silently losing the other
 *   - a bank payment slip treated as a bill to pay
 *   - the same invoice entered twice, queuing the supplier to be paid twice
 *
 * The extraction call is INTERCEPTED rather than really made. CI has no
 * CLAUDE_CODE_OAUTH_TOKEN, and a test that depends on a model's answer proves
 * nothing about our code and fails for reasons that are not defects. Canned
 * responses make the guards deterministic; the extractor itself is measured
 * separately against real documents (scripts/extraction-audit).
 */
import { expect, Page, test } from "@playwright/test";
import {
  closeAdmin,
  findTenantIdByName,
  markSetupComplete,
  waitForEmulators,
} from "./helpers/admin";

const stamp = Date.now().toString(36);
const COMPANY = `E2E Upload Co ${stamp}`;
const VENDOR = `Primos Boot Unipessoal Lda ${stamp}`;
const OWNER = {
  name: "Ana Upload",
  email: `upload-${stamp}@e2e.test`,
  password: "e2e-Password-4",
};

/** A minimal but real PDF, so the file input and upload gate behave normally. */
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Size 2/Root 1 0 R>>\n%%EOF\n",
);

/** Fields the server would return; only the parts each guard reads matter. */
const baseFields = {
  documentType: "bill",
  vendorName: VENDOR,
  vendorTaxId: null,
  billNumber: "5390",
  billDate: "2026-07-01",
  dueDate: "2026-07-31",
  amount: 450,
  taxAmount: null,
  currency: "USD",
  description: "Accounting services",
  category: "professional_services",
  containsMultipleDocuments: false,
  confidence: 0.9,
};

/** Answer the extraction endpoint with a canned result for this test. */
async function stubExtraction(page: Page, fields: Record<string, unknown>) {
  await page.route("**/ai/extract-document", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, fields: { ...baseFields, ...fields } }),
    });
  });
}

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

/** Drop a document on the Bills page, which opens the quick-add dialog. */
async function uploadDocument(page: Page, name = "invoice.pdf") {
  await page.goto("/money/bills");
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}

test("upload guards keep bad money out of the bill form", async ({ page }) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(30_000);
  await signUpOwner(page);
  const tenantId = await findTenantIdByName(COMPANY);
  await markSetupComplete(tenantId);

  // ── A euro invoice must not pre-fill a USD field ────────────────────────
  await stubExtraction(page, { currency: "EUR", amount: 8496.59 });
  let dialog = await uploadDocument(page, "fatura-nomads.pdf");
  await expect(dialog.getByText(/US dollars/i)).toBeVisible({ timeout: 30_000 });
  // The amount stays empty: 8496.59 euro is not 8496.59 dollars.
  await expect(dialog.getByPlaceholder("0.00")).toHaveValue("");
  await dialog.getByRole("button", { name: /cancel/i }).click();
  await expect(dialog).toBeHidden();

  // ── One file holding two invoices ───────────────────────────────────────
  await stubExtraction(page, { containsMultipleDocuments: true, amount: 3250 });
  dialog = await uploadDocument(page, "invoices-5389-e-5390.pdf");
  await expect(dialog.getByText(/more than one invoice/i)).toBeVisible({
    timeout: 30_000,
  });
  // Amount and number are ambiguous, so neither is filled in for the user.
  await expect(dialog.getByPlaceholder("0.00")).toHaveValue("");
  await dialog.getByRole("button", { name: /cancel/i }).click();
  await expect(dialog).toBeHidden();

  // ── A bank payment slip is not a bill ───────────────────────────────────
  await stubExtraction(page, { documentType: "payment_proof", amount: 472 });
  dialog = await uploadDocument(page, "comprovativo-pagamento.pdf");
  await expect(dialog.getByText(/bank payment slip/i)).toBeVisible({
    timeout: 30_000,
  });
  await dialog.getByRole("button", { name: /cancel/i }).click();
  await expect(dialog).toBeHidden();

  // ── A normal invoice still fills the form in ────────────────────────────
  await stubExtraction(page, {});
  dialog = await uploadDocument(page, "invoice-5390.pdf");
  await expect(dialog.getByPlaceholder("0.00")).toHaveValue("450");
  // The vendor is on the document but not yet on file: add it from here.
  await dialog.getByRole("button", { name: new RegExp(`Add "${VENDOR}"`, "i") }).click();
  await dialog.getByRole("button", { name: /^save|create bill$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("5390").first()).toBeVisible({ timeout: 30_000 });

  // ── The same invoice a second time is flagged ───────────────────────────
  await stubExtraction(page, {});
  dialog = await uploadDocument(page, "invoice-5390-again.pdf");
  // Vendor now matches by name, so the duplicate check has both sides.
  await expect(dialog.getByText(/already recorded/i)).toBeVisible({
    timeout: 30_000,
  });
});
