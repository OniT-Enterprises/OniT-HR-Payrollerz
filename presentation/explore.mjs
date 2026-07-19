/** Scout authenticated app screens: log in once, screenshot each route. */
import './env.mjs';
import { chromium } from 'playwright';

const SITE = process.env.XEFE_URL || 'https://xefe.tl';
const EMAIL = process.env.XEFE_EMAIL;
const PASSWORD = process.env.XEFE_PASSWORD;
if (!EMAIL || !PASSWORD) {
  throw new Error('Set XEFE_EMAIL and XEFE_PASSWORD (demo login) in the environment.');
}
const routes = [
  ['dashboard', '/'],
  ['people', '/people'],
  ['payroll', '/payroll'],
  ['runpayroll', '/payroll/run'],
  ['tax', '/payroll/tax'],
  ['accounting', '/accounting'],
  ['chart', '/accounting/chart'],
  ['timeleave', '/time-leave'],
  ['reports', '/reports'],
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
const page = await ctx.newPage();

async function settle() {
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 22000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 22000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div,section,aside')) {
      if (!/Setup is not finished/i.test(el.textContent || '')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 20 && r.height < 200) el.style.display = 'none';
    }
  }).catch(() => {});
}

await page.goto(`${SITE}/auth/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#email', { timeout: 20000 });
await page.locator('#email').pressSequentially(EMAIL, { delay: 20 });
await page.locator('#password').pressSequentially(PASSWORD, { delay: 20 });
await page.getByRole('button', { name: /sign in|login/i }).first().click().catch(() => {});
await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(4000);

for (const [name, route] of routes) {
  await page.goto(`${SITE}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle();
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160);
  await page.screenshot({ path: `/tmp/capcheck/app_${name}.png` });
  console.log(`${name.padEnd(12)} ${route.padEnd(16)} | ${text}`);
}
await browser.close();
console.log('done');
