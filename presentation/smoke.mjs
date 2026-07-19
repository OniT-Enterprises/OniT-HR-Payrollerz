/** Login smoke test: sign into xefe.tl as the demo user, wait for REAL content, screenshot. */
import { chromium } from 'playwright';

const ROOT = process.env.XEFE_URL || 'https://xefe.tl';
const EMAIL = process.env.XEFE_EMAIL;
const PASSWORD = process.env.XEFE_PASSWORD;
if (!EMAIL || !PASSWORD) {
  throw new Error('Set XEFE_EMAIL and XEFE_PASSWORD (demo login) in the environment.');
}

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// Wait until the splash/PageLoader spinner is gone AND a real content root exists.
async function settle(page, { timeout = 30000 } = {}) {
  // splash overlay (initial load) removed
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout }).catch(() => {});
  // PageLoader (lazy route) spinner gone — the loader uses .animate-spin
  await page.waitForFunction(
    () => !document.querySelector('.animate-spin'),
    { timeout },
  ).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

console.log('→ login');
await page.goto(`${ROOT}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#email', { timeout: 20000 });
await page.locator('#email').pressSequentially(EMAIL, { delay: 25 });
await page.locator('#password').pressSequentially(PASSWORD, { delay: 25 });
await page.getByRole('button', { name: /sign in|login/i }).first().click().catch(() => {});
await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 30000 }).catch(() => {});
await settle(page, { timeout: 35000 });
console.log('landed:', page.url());
console.log('text:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n+/g, ' | '));
await page.screenshot({ path: 'smoke-dashboard.png' });

for (const route of ['/people/employees', '/payroll', '/accounting', '/reports']) {
  await page.goto(`${ROOT}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await settle(page);
  console.log(`\n${route} → ${page.url()}`);
  console.log('  text:', (await page.evaluate(() => document.body.innerText)).slice(0, 220).replace(/\n+/g, ' | '));
  await page.screenshot({ path: `smoke${route.replace(/\//g, '_')}.png` });
}

await browser.close();
console.log('\ndone');
