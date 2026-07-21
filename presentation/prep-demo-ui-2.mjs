/**
 * Presentation prep, phase 6 — after the FULL seed (prep-demo-data-4.mjs),
 * run payroll for all 30 staff through the REAL client and finalize it:
 * wizard → Submit for Approval → History → Approve & Process (allocation
 * checkbox). Journals, YTD and bank-transfer data all flow for real.
 * Screenshots to tmp/prep2/ for verification.
 *
 *   node prep-demo-ui-2.mjs
 */
import './env.mjs';
import { chromium } from 'playwright';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SITE = process.env.XEFE_URL || 'https://xefe.tl';
const EMAIL = process.env.XEFE_EMAIL;
const PASSWORD = process.env.XEFE_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('Set XEFE_EMAIL / XEFE_PASSWORD (presentation/.env)');
const OUT = path.resolve('./tmp/prep2');

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
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 25000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 25000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function clickWhenEnabled(locator, timeout = 20000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.click({ timeout });
}

console.log('▶ login…');
await page.goto(`${SITE}/auth/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#email', { timeout: 20000 });
await page.locator('#email').fill(EMAIL);
await page.locator('#password').fill(PASSWORD);
await page.getByRole('button', { name: /sign in|login/i }).first().click();
await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 30000 });
await settle(4000);

console.log('▶ run payroll wizard…');
await page.goto(`${SITE}/payroll/run`, { waitUntil: 'domcontentloaded' });
await settle(3000);
await shot('step1-period');
await clickWhenEnabled(page.getByRole('button', { name: /^(next|continue)$/i }).first());
await settle(2500);
await shot('step2-employees');
await clickWhenEnabled(page.getByRole('button', { name: /^(next|continue)$/i }).first());
await settle(4000);
await shot('step3-hours');
await clickWhenEnabled(page.getByRole('button', { name: /^(next|continue)$/i }).first());
await settle(3000);
await shot('step4-review');

console.log('▶ submitting for approval…');
await clickWhenEnabled(page.getByRole('button', { name: /submit for approval/i }).first());
await page.waitForTimeout(9000);
await settle();
await shot('after-submit');

console.log('▶ approving…');
await page.goto(`${SITE}/payroll/history`, { waitUntil: 'domcontentloaded' });
await settle(3000);
await shot('history');
const row = page.locator('tr, [role="row"], div').filter({ hasText: /2026/i });
const approve = row.getByRole('button', { name: /^approve$/i }).last();
await approve.waitFor({ state: 'visible', timeout: 15000 });
await approve.click();
await page.waitForTimeout(1500);
const dlg = page.locator('[role="alertdialog"], [role="dialog"]');
const checkbox = dlg.locator('[role="checkbox"], input[type="checkbox"]').first();
await checkbox.waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
if (await checkbox.isVisible().catch(() => false)) {
  await checkbox.click();
  console.log('  ✓ confirmed unassigned allocation');
  await page.waitForTimeout(800);
}
await shot('approve-dialog');
const confirm = dlg.getByRole('button', { name: /approve\s*&\s*process|approve/i }).last();
await page.waitForFunction(() => {
  const d = document.querySelector('[role="alertdialog"], [role="dialog"]');
  if (!d) return false;
  const btn = [...d.querySelectorAll('button')].find((b) => /approve/i.test(b.textContent || ''));
  return btn && !btn.disabled;
}, { timeout: 90000 }).catch(() => console.log('  ⚠ approve button never enabled'));
await confirm.click({ timeout: 10000 });
console.log('  clicked Approve & Process — waiting (30 employees)…');
await page.waitForTimeout(20000);
await settle();
await shot('after-approve');

console.log('▶ verify journal…');
await page.goto(`${SITE}/accounting/journal`, { waitUntil: 'domcontentloaded' });
await settle(3000);
await shot('journal');

await browser.close();
console.log(`\n✓ Done — verify screenshots in ${OUT}`);
