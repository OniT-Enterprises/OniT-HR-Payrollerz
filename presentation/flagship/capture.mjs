/**
 * Xefe flagship video — fresh, semantically checked product captures.
 *
 * The comprehensive tour keeps its own capture pipeline one directory up.
 * These shots are deliberately shorter and fail when the promised product
 * state is missing, so an empty page cannot quietly become a "passing" scene.
 *
 * Usage (from presentation/):
 *   npm run capture:flagship
 *   node flagship/capture.mjs --shot=payroll,bank
 */
import '../env.mjs';
import { chromium } from 'playwright';
import { mkdir, rename, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'recordings');
const RAW_DIR = path.join(HERE, 'tmp', 'raw-videos');
const APP_URL = process.env.XEFE_APP_URL || 'https://app.xefe.tl';
const PUBLIC_URL = process.env.XEFE_PUBLIC_URL || 'https://xefe.tl';
const EMAIL = process.env.XEFE_EMAIL;
const PASSWORD = process.env.XEFE_PASSWORD;
const HEADLESS = process.env.HEADLESS !== 'false';

const args = process.argv.slice(2);
const requestedArg = args.find((arg) => arg.startsWith('--shot='))?.split('=')[1];
const requested = requestedArg ? new Set(requestedArg.split(',').map((name) => name.trim())) : null;

const DESKTOP = { width: 1920, height: 1080 };
const MOBILE = { width: 430, height: 932 };

async function hideFixtureNoise(page) {
  await page.evaluate(() => {
    const phrases = [
      /setup is not finished|finish setup/i,
      /install (the )?app/i,
    ];
    for (const el of document.querySelectorAll('div, section, aside')) {
      const text = el.textContent || '';
      if (!phrases.some((pattern) => pattern.test(text))) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 20 && rect.height < 240) el.style.display = 'none';
    }
  }).catch(() => {});
}

async function hideOverdueFixtureAlert(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[role="alert"]')) {
      if (!/overdue/i.test(el.textContent || '')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 20 && rect.height < 180) el.style.display = 'none';
    }
    for (const el of document.querySelectorAll('span, p, div')) {
      const text = (el.textContent || '').trim();
      if (!/overdue/i.test(text)) continue;
      const childRepeatsText = [...el.children].some((child) =>
        /overdue/i.test(child.textContent || ''),
      );
      if (childRepeatsText) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && rect.height < 90 && rect.width < 700) {
        el.style.visibility = 'hidden';
      }
    }
  }).catch(() => {});
}

async function settle(page, waitMs = 1300) {
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 25000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(700);
  await hideFixtureNoise(page);
  await page.waitForTimeout(waitMs);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText || '').catch(() => '');
}

async function expectText(page, pattern, label) {
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText || ''),
    { source: pattern.source, flags: pattern.flags },
    { timeout: 12000 },
  ).catch(() => {});
  const text = await bodyText(page);
  if (!pattern.test(text)) throw new Error(`Required state missing: ${label}`);
}

async function clickIfVisible(page, locator, waitMs = 750) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    await locator.click({ timeout: 4000 });
    await page.waitForTimeout(waitMs);
    return true;
  } catch {
    return false;
  }
}

async function mustClick(page, locator, label, waitMs = 750) {
  if (!(await clickIfVisible(page, locator, waitMs))) {
    throw new Error(`Required action unavailable: ${label}`);
  }
}

async function typeSlow(page, locator, text, delay = 45) {
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  await locator.click({ timeout: 4000 });
  await locator.fill('');
  await locator.pressSequentially(text, { delay });
}

async function slowScroll(page, totalPx, steps = 5, stepMs = 430) {
  for (let i = 0; i < steps; i++) {
    const moved = await page.evaluate((px) => {
      const candidates = [
        ...document.querySelectorAll('[role="dialog"] [class*="overflow-y"], [role="dialog"]'),
        ...document.querySelectorAll('main, main [class*="overflow-y"]'),
        document.scrollingElement,
      ].filter(Boolean);
      for (const el of candidates) {
        if (el.scrollHeight <= el.clientHeight + 12) continue;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 6) continue;
        el.scrollBy({ top: px, behavior: 'smooth' });
        return true;
      }
      return false;
    }, Math.round(totalPx / steps)).catch(() => false);
    if (!moved) break;
    await page.waitForTimeout(stepMs);
  }
}

async function navSPA(page, route, waitMs = 1100) {
  await page.evaluate((nextRoute) => {
    window.history.pushState({}, '', nextRoute);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await settle(page, waitMs);
}

async function login(context) {
  const page = await context.newPage();
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();
  await page.waitForURL((url) => !url.toString().includes('/auth/login'), { timeout: 35000 });
  await settle(page, 1800);
  if (!page.url().startsWith(APP_URL)) {
    throw new Error(`Demo login landed on unexpected host: ${page.url()}`);
  }
  await page.close();
}

async function findPopulatedAttendance(page) {
  for (let attempt = 0; attempt < 7; attempt++) {
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 20000 },
    ).catch(() => {});
    const text = await bodyText(page);
    if (/\bpresent\b/i.test(text) && !/no attendance recorded/i.test(text)) return;
    const previous = page.getByRole('button', { name: /previous/i }).first();
    if (!(await clickIfVisible(page, previous, 350))) break;
    await page.waitForTimeout(350);
  }
  await expectText(page, /\bpresent\b/i, 'populated attendance rows');
}

const SHOTS = [
  {
    name: 'dashboard',
    route: '/',
    minMs: 10500,
    async act(page) {
      await expectText(page, /active employees|things to do|until payday/i, 'dashboard overview');
      for (const pattern of [/until payday|payday/i, /active employees/i, /pending request/i]) {
        const item = page.getByText(pattern).first();
        if (await item.isVisible().catch(() => false)) {
          await item.hover().catch(() => {});
          await page.waitForTimeout(850);
        }
      }
      const ask = page.getByPlaceholder(/ask xefebot/i).first();
      if (await ask.isVisible().catch(() => false)) {
        await typeSlow(page, ask, 'What needs my attention today?', 38);
      }
      await page.waitForTimeout(1200);
    },
  },
  {
    name: 'attendance',
    route: '/time-leave/attendance',
    minMs: 9500,
    async prepare(page) {
      await expectText(page, /attendance/i, 'attendance page');
      await findPopulatedAttendance(page);
      await page.waitForTimeout(500);
    },
    async act(page) {
      await slowScroll(page, 520, 5, 520);
      await expectText(page, /\bpresent\b/i, 'visible attendance rows');
    },
  },
  {
    name: 'team',
    route: '/time-leave/attendance',
    minMs: 18000,
    async act(page) {
      await expectText(page, /attendance/i, 'attendance page');
      await findPopulatedAttendance(page);
      await slowScroll(page, 340, 4);
      await navSPA(page, '/time-leave/leave');
      await expectText(page, /leave/i, 'leave page');
      const pending = page.getByText(/pending/i).first();
      if (await pending.isVisible().catch(() => false)) await pending.hover().catch(() => {});
      await page.waitForTimeout(1200);
      await navSPA(page, '/time-leave/shifts');
      await expectText(page, /shift/i, 'shift planner');
      await slowScroll(page, 280, 3);
    },
  },
  {
    name: 'payroll',
    route: '/payroll/run',
    minMs: 27000,
    async act(page) {
      await expectText(page, /payroll|pay period/i, 'payroll wizard');
      await mustClick(
        page,
        page.getByRole('button', { name: /^(next|continue)$/i }).first(),
        'advance from payroll period',
        1300,
      );
      await expectText(page, /employee|staff/i, 'payroll employee step');
      await slowScroll(page, 260, 2, 380);
      await mustClick(
        page,
        page.getByRole('button', { name: /^(next|continue)$/i }).first(),
        'advance from employee selection',
        1800,
      );
      await expectText(page, /hours|overtime|gross|net pay/i, 'calculated pay rows');
      await slowScroll(page, 760, 6, 520);
      await mustClick(
        page,
        page.getByRole('button', { name: /^(next|continue)$/i }).first(),
        'advance to payroll review',
        1800,
      );
      await expectText(page, /review|total|net pay|deduction/i, 'payroll review totals');
      await slowScroll(page, 420, 4, 450);
    },
  },
  {
    name: 'engine',
    local: path.join(HERE, 'engine-animation.html'),
    noLogin: true,
    minMs: 19000,
    async prepare(page) {
      await page.waitForSelector('#engine-animation', { state: 'visible', timeout: 10000 });
      await page.evaluate(() => document.fonts.ready);
    },
    async act(page) {
      await expectText(page, /calculation engine|Timor-Leste rules/i, 'calculation animation');
      await page.evaluate(() => window.startEngineAnimation());
    },
  },
  {
    name: 'tax',
    route: '/payroll/tax/monthly-wit',
    minMs: 14000,
    async act(page) {
      await expectText(page, /monthly.*WIT|withholding/i, 'monthly withholding return');
      await hideOverdueFixtureAlert(page);
      const generate = page.getByRole('button', { name: /generate return/i }).first();
      if (await generate.isVisible().catch(() => false)) {
        await generate.click();
        await page.waitForTimeout(2300);
      }
      await hideOverdueFixtureAlert(page);
      await slowScroll(page, 620, 6, 480);
      await hideOverdueFixtureAlert(page);
      await expectText(page, /employee|tax|filing|withholding/i, 'prepared filing detail');
    },
  },
  {
    name: 'bank',
    route: '/payroll/payments',
    minMs: 17000,
    async act(page) {
      await expectText(page, /bank transfer/i, 'bank transfer page');
      await mustClick(page, page.getByRole('button', { name: /bank files/i }).first(), 'open bank files', 1200);
      const runSelect = page.getByRole('combobox').last();
      if (await clickIfVisible(page, runSelect, 500)) {
        await clickIfVisible(page, page.getByRole('option', { name: /june|2026-06|jul|2026-07/i }).first(), 1000);
      }
      const checkbox = page.locator('[role="dialog"] [role="checkbox"], [role="dialog"] input[type="checkbox"]').first();
      if (!(await clickIfVisible(page, checkbox, 850))) {
        await clickIfVisible(page, page.getByText(/^BNU/i).first(), 850);
      }
      const generate = page.getByRole('button', { name: /generate \d|generate file/i }).last();
      if (await generate.isEnabled().catch(() => false)) {
        await generate.click();
        await page.waitForTimeout(2800);
      }
      await expectText(page, /bank|payment|Portuguese|BNU|BNCTL/i, 'bank pack result');
    },
  },
  {
    name: 'money',
    route: '/money/invoices',
    minMs: 18000,
    async act(page) {
      await expectText(page, /invoice/i, 'invoice list');
      const actions = page.getByRole('button', { name: /more actions/i }).first();
      if (await clickIfVisible(page, actions, 1100)) await page.keyboard.press('Escape').catch(() => {});
      const invoice = page.getByText(/INV[-\d]/i).first();
      if (await clickIfVisible(page, invoice, 1300)) await slowScroll(page, 300, 3);
      await navSPA(page, '/money/expenses');
      await expectText(page, /expense|bill/i, 'expenses and bills');
      await slowScroll(page, 480, 4);
    },
  },
  {
    name: 'accounting',
    route: '/accounting/journal',
    minMs: 18000,
    async act(page) {
      await expectText(page, /journal/i, 'journal entries');
      const payrollEntry = page.getByText(/payroll for/i).first();
      if (await clickIfVisible(page, payrollEntry, 1300)) await slowScroll(page, 360, 3);
      await navSPA(page, '/accounting/statements/trial-balance');
      await expectText(page, /trial balance/i, 'trial balance page');
      const generate = page.getByRole('button', { name: /^generate$/i }).first();
      if (await generate.isVisible().catch(() => false)) {
        await generate.click();
        await page.waitForTimeout(2500);
      }
      await expectText(page, /asset|liabilit|revenue|expense/i, 'generated trial balance');
      await slowScroll(page, 420, 4);
    },
  },
  {
    name: 'trial-balance',
    route: '/accounting/statements/trial-balance',
    minMs: 10500,
    async prepare(page) {
      await expectText(page, /trial balance/i, 'trial balance page');
      const dateInputs = page.locator('input[type="date"]');
      if (await dateInputs.count() >= 2) {
        await dateInputs.nth(0).fill('2026-01-01');
        await dateInputs.nth(1).fill('2026-07-23');
      }
      await mustClick(
        page,
        page.getByRole('button', { name: /^generate$/i }).first(),
        'generate trial balance',
        500,
      );
      await page.waitForFunction(
        () => {
          const text = document.querySelector('main')?.textContent || '';
          return /opening balance/i.test(text) &&
            /closing balance/i.test(text) &&
            !/no trial balance generated/i.test(text);
        },
        { timeout: 30000 },
      );
      await page.waitForTimeout(500);
    },
    async act(page) {
      await expectText(page, /opening balance|closing balance/i, 'generated trial balance');
      await slowScroll(page, 760, 6, 520);
    },
  },
  {
    name: 'bot',
    route: '/',
    minMs: 19000,
    async act(page) {
      const ask = page.getByPlaceholder(/ask xefebot/i).first();
      await typeSlow(page, ask, 'How much did the last payroll cost in total?', 42);
      await ask.press('Enter');
      await page.waitForTimeout(1200);
      await expectText(page, /thinking|payroll|total/i, 'XefeBot conversation');
      let previousLength = 0;
      let stableCount = 0;
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1200);
        const text = await bodyText(page);
        const length = text.length;
        stableCount = length === previousLength ? stableCount + 1 : 0;
        previousLength = length;
        if (stableCount >= 2 && i >= 4) break;
      }
      await page.waitForTimeout(1400);
    },
  },
  {
    name: 'languages',
    route: '/',
    minMs: 11500,
    async act(page) {
      await expectText(page, /active employees|things to do|payday/i, 'localized dashboard');
      for (const language of [/tetun/i, /portugu/i, /english/i]) {
        const switcher = page.getByRole('button').filter({ hasText: /english|tetun|portugu/i }).first();
        await mustClick(page, switcher, 'open language menu', 350);
        const chosen =
          (await clickIfVisible(page, page.getByRole('menuitem', { name: language }).first(), 1050)) ||
          (await clickIfVisible(page, page.getByText(language).last(), 1050));
        if (!chosen) throw new Error(`Language option unavailable: ${language}`);
        await hideFixtureNoise(page);
      }
    },
  },
  {
    name: 'mobile',
    route: '/',
    mobile: true,
    minMs: 16500,
    async act(page) {
      await expectText(page, /active employees|things to do|payday/i, 'mobile dashboard');
      await slowScroll(page, 330, 4);
      await navSPA(page, '/time-leave/attendance');
      await expectText(page, /attendance/i, 'mobile attendance');
      await findPopulatedAttendance(page);
      await slowScroll(page, 520, 5);
    },
  },
];

async function saveRecording(rawPath, shotName, contentStart) {
  const shotDir = path.join(OUT_DIR, shotName);
  if (existsSync(shotDir)) await rm(shotDir, { recursive: true });
  await mkdir(shotDir, { recursive: true });
  const destination = path.join(shotDir, 'page.webm');
  const seek = Math.max(0, contentStart - 0.35);
  if (seek > 0.05) {
    execSync(
      `ffmpeg -y -loglevel error -ss ${seek.toFixed(2)} -i "${rawPath}" -c:v libvpx -b:v 7M -an "${destination}"`,
    );
  } else {
    await rename(rawPath, destination);
  }
  return destination;
}

async function captureShot(context, shot) {
  const target = shot.local
    ? pathToFileURL(shot.local).href
    : `${shot.public ? PUBLIC_URL : APP_URL}${shot.route}`;
  console.log(`▶ ${shot.name}  ${target}`);
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page);
  if (shot.prepare) await shot.prepare(page);
  const contentStart = (Date.now() - started) / 1000;
  const actionStarted = Date.now();
  try {
    await shot.act(page);
    const remaining = shot.minMs - (Date.now() - actionStarted);
    if (remaining > 0) await page.waitForTimeout(remaining);
    await page.waitForTimeout(700);
  } catch (error) {
    await page.close();
    throw new Error(`${shot.name}: ${error.message}`);
  }
  const video = page.video();
  await page.close();
  const raw = await video.path();
  const saved = await saveRecording(raw, shot.name, contentStart);
  const duration = Number(
    execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${saved}"`).toString().trim(),
  );
  console.log(`  ✓ ${duration.toFixed(1)}s (trimmed ${contentStart.toFixed(1)}s browser lead-in)`);
}

const selected = SHOTS.filter((shot) => !requested || requested.has(shot.name));
if (requested) {
  const missing = [...requested].filter((name) => !SHOTS.some((shot) => shot.name === name));
  if (missing.length) throw new Error(`Unknown shot(s): ${missing.join(', ')}`);
}

if (selected.some((shot) => !shot.public && !shot.noLogin) && (!EMAIL || !PASSWORD)) {
  throw new Error('Set XEFE_EMAIL and XEFE_PASSWORD in presentation/.env');
}

await mkdir(RAW_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS });
const desktopShots = selected.filter((shot) => !shot.mobile);
if (desktopShots.length) {
  const desktop = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 1,
    recordVideo: { dir: RAW_DIR, size: DESKTOP },
  });
  await desktop.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch {
      // ignored
    }
  });
  if (desktopShots.some((shot) => !shot.public && !shot.noLogin)) await login(desktop);
  for (const shot of desktopShots) await captureShot(desktop, shot);
  await desktop.close();
}

const mobileShots = selected.filter((shot) => shot.mobile);
if (mobileShots.length) {
  const mobile = await browser.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: RAW_DIR, size: MOBILE },
  });
  await mobile.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch {
      // ignored
    }
  });
  await login(mobile);
  for (const shot of mobileShots) await captureShot(mobile, shot);
  await mobile.close();
}

await browser.close();
console.log(`\n✓ Flagship recordings: ${OUT_DIR}`);
