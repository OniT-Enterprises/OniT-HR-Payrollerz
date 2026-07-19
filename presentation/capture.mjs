/**
 * Xefe product video — automated screen capture (IN-PRODUCT, authenticated).
 *
 * v4 "comprehensive" cut: REAL interaction recordings. Modern headless Chrome
 * composites the app shell correctly now (verified via tmp/probe.mjs), so each
 * scene is a Playwright recordVideo clip of scripted actions — scrolling,
 * opening records, walking the payroll wizard — not a Ken-Burns still.
 *
 * Mechanics:
 *   · One authenticated context; each scene runs in a NEW page, which gives it
 *     its own .webm. The SPA cold-boot lead-in is measured per scene and
 *     ffmpeg-trimmed off the front (contentStart), then saved to
 *     recordings/<scene>/page.webm for render.mjs.
 *   · Scene durations come from audio/scene-NN.mp3 (run `npm run audio` first).
 *   · Actions are written to roughly fill the VO window; render.mjs speed-fits
 *     whatever remains.
 *   · The engine scene records the public /engine page from ENGINE_URL
 *     (defaults to the local dev server — the page isn't deployed yet).
 *   · The mobile scene uses its own 390×844 context (portrait clip, padded to
 *     16:9 by render.mjs).
 *
 * Usage:
 *   node capture.mjs                       # all scenes
 *   node capture.mjs --scene=07-runpayroll
 *   XEFE_URL=… ENGINE_URL=… HEADLESS=false node capture.mjs
 *
 * Demo creds (scripts/seed-demo-tenant.mjs + presentation/prep-demo-*.mjs).
 */
import './env.mjs';
import { chromium } from 'playwright';
import { mkdir, rm, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const sceneOnly = args.find((a) => a.startsWith('--scene='))?.split('=')[1];

const SITE = process.env.XEFE_URL || 'https://xefe.tl';
const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8080';
const EMAIL = process.env.XEFE_EMAIL;
const PASSWORD = process.env.XEFE_PASSWORD;
if (!EMAIL || !PASSWORD) {
  throw new Error('Set XEFE_EMAIL and XEFE_PASSWORD (demo login) in the environment.');
}
const HEADLESS = process.env.HEADLESS !== 'false';

const OUT = path.resolve('./recordings');
const AUDIO_DIR = path.resolve('./audio');
const RAW_DIR = path.resolve('./tmp/raw-videos');
const DESKTOP = { width: 1920, height: 1080 };
const MOBILE = { width: 390, height: 844 };

function durationMs(sceneNum, fallback = 15000) {
  const mp3 = path.join(AUDIO_DIR, `scene-${String(sceneNum).padStart(2, '0')}.mp3`);
  if (!existsSync(mp3)) return fallback;
  try {
    const sec = Number(execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${mp3}"`).toString().trim());
    return Math.round((sec + 0.6) * 1000);
  } catch { return fallback; }
}

// ── shared page helpers ─────────────────────────────────────────────────────
async function settle(page, ms = 2200) {
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 25000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 25000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
  await hideSetupBanner(page);
  await page.waitForTimeout(ms);
}

async function hideSetupBanner(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div,section,aside')) {
      if (!/setup is not finished|finish setup/i.test(el.textContent || '')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 20 && r.height < 220) el.style.display = 'none';
    }
  }).catch(() => {});
}

async function slowScroll(page, totalPx, steps = 8, stepMs = 450) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, totalPx / steps);
    await page.waitForTimeout(stepMs);
  }
}

async function clickIfVisible(page, locator, wait = 1200) {
  try {
    if (await locator.isVisible({ timeout: 1500 })) {
      await locator.click({ timeout: 4000 });
      await page.waitForTimeout(wait);
      return true;
    }
  } catch { /* non-fatal */ }
  return false;
}

async function typeSlow(page, locator, text, delay = 55) {
  try {
    await locator.click({ timeout: 4000 });
    await locator.pressSequentially(text, { delay });
    return true;
  } catch { return false; }
}

async function login(page) {
  await page.goto(`${SITE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();
  await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 30000 });
  await page.waitForTimeout(3500);
}

// ── scene actions ───────────────────────────────────────────────────────────
// Each receives (page, durMs) AFTER goto+settle and should roughly fill durMs.
const SCENES = [
  {
    num: 2, name: '02-dashboard', route: '/',
    async act(page, dur) {
      for (const label of [/until payday|payday/i, /active employees/i, /pending request/i]) {
        const card = page.getByText(label).first();
        if (await card.isVisible().catch(() => false)) { await card.hover().catch(() => {}); await page.waitForTimeout(1300); }
      }
      const ask = page.getByPlaceholder(/ask xefebot/i).first();
      await typeSlow(page, ask, "Who's on leave today?", 70);
      await page.waitForTimeout(1500);
    },
  },
  {
    num: 3, name: '03-people', route: '/people/employees',
    async act(page) {
      await slowScroll(page, 500, 4);
      await clickIfVisible(page, page.getByText('Filomena da Costa').first(), 2500);
      await slowScroll(page, 600, 5);
    },
  },
  {
    num: 4, name: '04-hiring', route: '/people/jobs',
    async act(page) {
      await page.waitForTimeout(1200);
      await clickIfVisible(page, page.getByText(/^Barista$/).first(), 2600);
      await slowScroll(page, 500, 5);
      await clickIfVisible(page, page.getByText('Zelia Fernandes').first(), 2500);
    },
  },
  {
    num: 5, name: '05-timeleave', route: '/time-leave/attendance',
    async act(page) {
      await slowScroll(page, 600, 5);
      await page.goto(`${SITE}/time-leave/leave`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 1500);
      const pending = page.getByText('Lucia Pereira').first();
      if (await pending.isVisible().catch(() => false)) await pending.hover().catch(() => {});
      await page.waitForTimeout(1800);
    },
  },
  {
    num: 6, name: '06-shifts', route: '/time-leave/shifts',
    async act(page) {
      // seeded shifts live in NEXT week (Jul 20–25) — page opens on current week
      const next = page.locator('button:has(svg)').filter({ hasNot: page.locator('[disabled]') })
        .and(page.getByRole('button', { name: /next|→|>/i }));
      if (!(await clickIfVisible(page, next.first(), 2200))) {
        // fallback: any chevron-right styled week nav
        await clickIfVisible(page, page.locator('button[aria-label*="next" i]').first(), 2200);
      }
      await slowScroll(page, 500, 5);
    },
  },
  {
    num: 7, name: '07-runpayroll', route: '/payroll/run',
    async act(page, dur) {
      // step 1: period — accept defaults, advance
      await page.waitForTimeout(1800);
      await clickIfVisible(page, page.getByRole('button', { name: /next|continue/i }).first(), 2500);
      // step 2: employee rows with live calculations
      await page.waitForTimeout(2500);
      await slowScroll(page, 500, 4, 550);
      // expand the first employee row if it has a toggle
      await clickIfVisible(page, page.locator('table button:has(svg), [role="row"] button:has(svg)').first(), 2000);
      await slowScroll(page, 400, 3, 550);
      await clickIfVisible(page, page.getByRole('button', { name: /next|continue|review/i }).first(), 2500);
      await slowScroll(page, 400, 3, 550);
    },
  },
  {
    num: 8, name: '08-approve', route: '/payroll/history',
    async act(page) {
      // June run is approved + paid; open its detail
      await clickIfVisible(page, page.getByText(/june 2026/i).first(), 2600);
      await slowScroll(page, 500, 4);
      await clickIfVisible(page, page.getByRole('button', { name: /payslip/i }).first(), 3000);
      await page.waitForTimeout(1500);
    },
  },
  {
    num: 9, name: '09-engine', route: null, url: `${ENGINE_URL}/engine`,
    noAuth: true,
    async act(page, dur) {
      const steps = 14;
      const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, total / steps);
        await page.waitForTimeout((dur - 3000) / steps);
      }
    },
  },
  {
    num: 10, name: '10-tax', route: '/payroll/tax',
    async act(page) {
      await slowScroll(page, 450, 4);
      await page.goto(`${SITE}/payroll/tax/monthly-wit`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 1800);
      await slowScroll(page, 500, 5);
    },
  },
  {
    num: 11, name: '11-bank', route: '/payroll/payments',
    async act(page) {
      await page.waitForTimeout(1500);
      await slowScroll(page, 450, 4);
      // open whatever pack/download affordance is visible (no clicks that navigate away)
      const pack = page.getByRole('button', { name: /pack|transfer|download|generate/i }).first();
      if (await pack.isVisible().catch(() => false)) await pack.hover().catch(() => {});
      await page.waitForTimeout(1800);
    },
  },
  {
    num: 12, name: '12-invoices', route: '/money/invoices',
    async act(page) {
      await page.waitForTimeout(1200);
      await clickIfVisible(page, page.locator('table tbody tr, [data-testid="invoice-row"]').first(), 2600);
      await slowScroll(page, 350, 3);
      await clickIfVisible(page, page.getByRole('button', { name: /share|whatsapp|send/i }).first(), 2800);
      await page.waitForTimeout(1500);
    },
  },
  {
    num: 13, name: '13-expenses', route: '/money/expenses',
    async act(page) {
      await slowScroll(page, 400, 4);
      await page.goto(`${SITE}/money/bills/new`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 1800);
      await slowScroll(page, 550, 5);
    },
  },
  {
    num: 14, name: '14-accounting', route: '/accounting/journal',
    async act(page) {
      await clickIfVisible(page, page.getByText('JE-2026-0001').first(), 2600);
      await slowScroll(page, 450, 4);
      await page.goto(`${SITE}/accounting/statements/trial-balance`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 2200);
      await slowScroll(page, 400, 3);
    },
  },
  {
    num: 15, name: '15-reports', route: '/reports',
    async act(page) {
      await slowScroll(page, 450, 4);
      await clickIfVisible(page, page.getByText(/payroll reports/i).first(), 2600);
      await slowScroll(page, 450, 4);
    },
  },
  {
    num: 16, name: '16-bot', route: '/',
    async act(page, dur) {
      const ask = page.getByPlaceholder(/ask xefebot/i).first();
      await typeSlow(page, ask, 'How much did the June payroll cost in total?', 55);
      await page.waitForTimeout(400);
      await ask.press('Enter').catch(() => {});
      // give the live model time to answer; render speed-fits the wait
      await page.waitForFunction(
        () => /\$\s?[\d,]+|june|payroll/i.test(
          [...document.querySelectorAll('[class*="chat"], [class*="message"], [data-role]')]
            .map((e) => e.textContent || '').join(' ').slice(-2000),
        ),
        { timeout: 40000 },
      ).catch(() => {});
      await page.waitForTimeout(4000);
    },
  },
  {
    num: 17, name: '17-mobile', route: '/', mobile: true,
    async act(page) {
      await slowScroll(page, 500, 5);
      await page.goto(`${SITE}/time-leave/attendance`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 1600);
      await slowScroll(page, 500, 5);
    },
  },
  {
    num: 18, name: '18-languages', route: '/',
    async act(page) {
      const switcher = page.getByRole('button', { name: /english/i }).first();
      for (const lang of [/tetun/i, /portugu/i, /english/i]) {
        if (await clickIfVisible(page, switcher, 700)) {
          await clickIfVisible(page, page.getByRole('menuitem', { name: lang }).first(), 2400)
            || await clickIfVisible(page, page.getByText(lang).last(), 2400);
        }
        await hideSetupBanner(page);
      }
    },
  },
];

// ── capture machinery ───────────────────────────────────────────────────────
async function trimAndSave(rawWebm, sceneName, contentStart) {
  const dir = path.join(OUT, sceneName);
  if (existsSync(dir)) await rm(dir, { recursive: true });
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, 'page.webm');
  const ss = Math.max(0, contentStart - 0.4);
  if (ss > 0.05) {
    execSync(`ffmpeg -y -loglevel error -ss ${ss.toFixed(2)} -i "${rawWebm}" -c:v libvpx -b:v 6M -an "${dest}"`);
  } else {
    await rename(rawWebm, dest);
  }
  return dest;
}

async function captureScene(ctx, scene) {
  const durMs = durationMs(scene.num);
  const target = scene.url || `${SITE}${scene.route}`;
  console.log(`▶ ${scene.name}  (${(durMs / 1000).toFixed(1)}s VO)  ${target}`);
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await settle(page);
  const contentStart = (Date.now() - t0) / 1000;
  try {
    await scene.act(page, durMs);
  } catch (err) {
    console.warn(`  ⚠ action error (kept recording): ${err.message?.split('\n')[0]}`);
  }
  await page.waitForTimeout(1200);
  const video = page.video();
  await page.close();
  const raw = await video.path();
  await trimAndSave(raw, scene.name, contentStart);
  console.log(`  ✓ ${scene.name}  (trimmed ${contentStart.toFixed(1)}s lead-in)`);
}

await mkdir(RAW_DIR, { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS });

// Desktop context (authenticated)
const desktop = await browser.newContext({
  viewport: DESKTOP, deviceScaleFactor: 1,
  recordVideo: { dir: RAW_DIR, size: DESKTOP },
});
await desktop.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
{
  const loginPage = await desktop.newPage();
  console.log('▶ login (desktop)…');
  await login(loginPage);
  await loginPage.close();
}

for (const scene of SCENES.filter((s) => !s.mobile)) {
  if (sceneOnly && scene.name !== sceneOnly) continue;
  await captureScene(desktop, scene);
}
await desktop.close();

// Mobile context (its own portrait video size)
const mobileScenes = SCENES.filter((s) => s.mobile && (!sceneOnly || s.name === sceneOnly));
if (mobileScenes.length) {
  const mobile = await browser.newContext({
    viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: RAW_DIR, size: MOBILE },
  });
  await mobile.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
  const loginPage = await mobile.newPage();
  console.log('▶ login (mobile)…');
  await login(loginPage);
  await loginPage.close();
  for (const scene of mobileScenes) await captureScene(mobile, scene);
  await mobile.close();
}

await browser.close();
console.log(`\n✓ Done. Clips in ${OUT}`);
