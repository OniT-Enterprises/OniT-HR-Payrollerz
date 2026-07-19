/**
 * Presentation prep, phase 2 — drive the REAL client to finalize the pending
 * June payroll run on the demo tenant (journals, payslips, bank transfer and
 * YTD all flow through the actual code paths). Screenshots every step into
 * tmp/prep/ for verification.
 *
 *   node prep-demo-ui.mjs
 */
import { chromium } from 'playwright';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SITE = process.env.XEFE_URL || 'https://xefe.tl';
const EMAIL = process.env.XEFE_EMAIL;
const PASSWORD = process.env.XEFE_PASSWORD;
if (!EMAIL || !PASSWORD) {
  throw new Error('Set XEFE_EMAIL and XEFE_PASSWORD (demo login) in the environment.');
}
const OUT = path.resolve('./tmp/prep');

if (existsSync(OUT)) await rm(OUT, { recursive: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
const page = await ctx.newPage();
let step = 0;
const shot = async (name) => {
  step++;
  await page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${name}.png`) });
  console.log(`  📸 ${String(step).padStart(2, '0')}-${name}`);
};

async function settle(ms = 2500) {
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 22000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 22000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

console.log('▶ login…');
await page.goto(`${SITE}/auth/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#email', { timeout: 20000 });
await page.locator('#email').fill(EMAIL);
await page.locator('#password').fill(PASSWORD);
await page.getByRole('button', { name: /sign in|login/i }).first().click();
await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 30000 });
await settle(4000);

console.log('▶ payroll history…');
await page.goto(`${SITE}/payroll/history`, { waitUntil: 'domcontentloaded' });
await settle();
await shot('history');

// Approve the pending run (self-approval enabled by prep-demo-data.mjs).
const buttons = page.getByRole('button', { name: /approve/i });
const count = await buttons.count();
for (let i = 0; i < count; i++) {
  const b = buttons.nth(i);
  console.log(`  button[${i}] approve: visible=${await b.isVisible().catch(() => '?')} enabled=${await b.isEnabled().catch(() => '?')} text="${(await b.textContent().catch(() => '')).trim()}"`);
}
const row = page.locator('tr, [role="row"], div').filter({ hasText: /june 2026/i });
const approve = row.getByRole('button', { name: /^approve$/i }).last();
if (await approve.isVisible().catch(() => false)) {
  console.log('▶ approving pending run…');
  await approve.click();
  await page.waitForTimeout(1200);
  await shot('approve-dialog');
  // Confirm dialog — "Approve & Process" stays disabled while the
  // project/funding-allocation pre-check runs; wait for it to enable.
  const confirm = page
    .locator('[role="alertdialog"], [role="dialog"]')
    .getByRole('button', { name: /approve\s*&\s*process|approve|confirm/i })
    .last();
  await confirm.waitFor({ state: 'visible', timeout: 15000 });
  // The allocation pre-check may surface an "post as Unassigned" confirmation
  // checkbox — tick it (demo tenant has no project/funding tags).
  const dlg = page.locator('[role="alertdialog"], [role="dialog"]');
  const checkbox = dlg.locator('[role="checkbox"], input[type="checkbox"]').first();
  await checkbox.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.click();
    console.log('  ✓ confirmed unassigned allocation');
    await page.waitForTimeout(600);
  }
  await shot('dialog-ready');
  await confirm.click({ timeout: 10000 });
  console.log('  clicked Approve & Process — waiting for processing…');
  await page.waitForTimeout(12000);
  await settle();
  await shot('after-approve');
} else {
  console.log('  (no pending Approve button — maybe already approved)');
}

// Look for a mark-as-paid action on the approved run.
console.log('▶ mark as paid…');
await page.goto(`${SITE}/payroll/history`, { waitUntil: 'domcontentloaded' });
await settle();
await shot('history-after');
const paidBtn = page.getByRole('button', { name: /mark.*paid|record payment/i }).first();
if (await paidBtn.isVisible().catch(() => false)) {
  await paidBtn.click();
  await page.waitForTimeout(1200);
  await shot('paid-dialog');
  const confirm2 = page
    .locator('[role="alertdialog"], [role="dialog"]')
    .getByRole('button', { name: /mark.*paid|confirm|yes/i })
    .first();
  if (await confirm2.isVisible().catch(() => false)) await confirm2.click();
  await page.waitForTimeout(4000);
  await shot('after-paid');
} else {
  console.log('  (no mark-as-paid button visible on history — will check run detail)');
  // open the run row if it is a link/row
  const row = page.getByText(/june 2026/i).first();
  if (await row.isVisible().catch(() => false)) {
    await row.click().catch(() => {});
    await settle();
    await shot('run-detail');
  }
}

console.log('▶ accounting journal check…');
await page.goto(`${SITE}/accounting/journal-entries`, { waitUntil: 'domcontentloaded' });
await settle();
await shot('journal');

await browser.close();
console.log(`\n✓ Done — verify screenshots in ${OUT}`);
