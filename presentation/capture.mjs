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
// --scene=07-runpayroll or --scene=05-timeleave,06-shifts,08-approve
const sceneArg = args.find((a) => a.startsWith('--scene='))?.split('=')[1];
const sceneOnly = sceneArg ? new Set(sceneArg.split(',')) : null;

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

// Smooth JS scroll of whatever actually scrolls (the app shell scrolls <main>,
// dialogs scroll themselves, public pages scroll the window). mouse.wheel on a
// non-scrollable pane rubber-bands and makes the recording jiggle — never use it.
async function slowScroll(page, totalPx, steps = 8, stepMs = 450) {
  for (let i = 0; i < steps; i++) {
    const moved = await page.evaluate((px) => {
      const candidates = [
        ...document.querySelectorAll('[role="dialog"] [class*="overflow-y"], [role="dialog"]'),
        ...document.querySelectorAll('main, main [class*="overflow-y"]'),
        document.scrollingElement,
      ].filter(Boolean);
      for (const el of candidates) {
        if (el.scrollHeight > el.clientHeight + 12 &&
            el.scrollTop + el.clientHeight < el.scrollHeight - 6) {
          el.scrollBy({ top: px, behavior: 'smooth' });
          return true;
        }
      }
      return false;
    }, Math.round(totalPx / steps)).catch(() => false);
    if (!moved) break; // nothing (left) to scroll — hold still instead of jiggling
    await page.waitForTimeout(stepMs);
  }
}

async function clickIfVisible(page, locator, wait = 1200) {
  try {
    // pages hydrate content well after the splash clears — wait generously
    await locator.waitFor({ state: 'visible', timeout: 6000 });
    await locator.click({ timeout: 4000 });
    await page.waitForTimeout(wait);
    return true;
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

// Client-side route change (React Router listens to popstate) — avoids the
// full-reload splash screen that a page.goto() would put in the recording.
async function navSPA(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page, 1600);
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
      // today may be an off day — step back to the last day with records
      await clickIfVisible(page, page.getByRole('button', { name: /previous/i }).first(), 2200);
      await slowScroll(page, 500, 4);
      await navSPA(page, '/time-leave/leave');
      const pending = page.getByText('Lucia Pereira').first();
      if (await pending.isVisible().catch(() => false)) await pending.hover().catch(() => {});
      await page.waitForTimeout(1800);
    },
  },
  {
    num: 6, name: '06-shifts', route: '/time-leave/shifts',
    async act(page) {
      // seeded shifts live in NEXT week (Jul 20–25) — week nav is aria-label'd
      await page.waitForTimeout(1200);
      await clickIfVisible(page, page.getByRole('button', { name: /^next$/i }).first(), 2600);
      await slowScroll(page, 500, 5);
    },
  },
  {
    num: 7, name: '07-runpayroll', route: '/payroll/run',
    async act(page, dur) {
      // step 1: period — accept defaults, advance
      await page.waitForTimeout(1800);
      await clickIfVisible(page, page.getByRole('button', { name: /^(next|continue)$/i }).first(), 2200);
      // step 2: employees (compliance-clean since prep-demo-data-3) — advance
      await page.waitForTimeout(1600);
      await slowScroll(page, 300, 2, 500);
      await clickIfVisible(page, page.getByRole('button', { name: /^(next|continue)$/i }).first(), 2800);
      // step 3: hours & pay — the live calculations; give them room to breathe
      await page.waitForTimeout(2600);
      await slowScroll(page, 700, 6, 600);
      // step 4: review totals — look, never submit
      await clickIfVisible(page, page.getByRole('button', { name: /^(next|continue)$/i }).first(), 2800);
      await slowScroll(page, 500, 4, 550);
    },
  },
  {
    num: 8, name: '08-approve', route: '/payroll/history',
    async act(page) {
      // default view is Pending Approval (now empty) — switch to All Runs
      await clickIfVisible(page, page.getByRole('combobox').first(), 900);
      await clickIfVisible(page, page.getByRole('option', { name: /all/i }).first(), 1800);
      // open the paid June run's per-employee records
      await clickIfVisible(page, page.getByRole('button', { name: /more actions/i }).first(), 1000);
      await clickIfVisible(page, page.getByRole('menuitem', { name: /view details/i }).first(), 2600);
      await slowScroll(page, 500, 4, 500);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(600);
      // the payslip itself: the landing page renders the real PayslipPDF layout
      await navSPA(page, '/landing');
      const slip = page.getByText(/document every employee receives/i).first();
      await slip.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
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
      await navSPA(page, '/payroll/tax/monthly-wit');
      await clickIfVisible(page, page.getByRole('button', { name: /generate return/i }).first(), 3000);
      await slowScroll(page, 500, 5);
    },
  },
  {
    num: 11, name: '11-bank', route: '/payroll/payments',
    async act(page) {
      await page.waitForTimeout(1200);
      // open the Bank Files dialog and point it at the paid June run
      await clickIfVisible(page, page.getByRole('button', { name: /bank files/i }).first(), 1600);
      await clickIfVisible(page, page.getByRole('combobox').last(), 900);
      await clickIfVisible(page, page.getByRole('option', { name: /june|2026-06|jun/i }).first(), 1800);
      // pick BNU (checkbox card) and actually generate the pack
      await clickIfVisible(page, page.locator('[role="dialog"] [role="checkbox"], [role="dialog"] input[type="checkbox"]').first(), 1500)
        || await clickIfVisible(page, page.getByText(/^BNU/i).first(), 1500);
      await page.waitForTimeout(1500);
      await clickIfVisible(page, page.getByRole('button', { name: /generate \d|generate file/i }).last(), 4000);
      await page.waitForTimeout(2000);
    },
  },
  {
    num: 12, name: '12-invoices', route: '/money/invoices',
    async act(page) {
      await page.waitForTimeout(1200);
      // the share affordances live in each row's actions menu
      await clickIfVisible(page, page.getByRole('button', { name: /more actions/i }).first(), 2600);
      await page.waitForTimeout(1800);
      await page.keyboard.press('Escape').catch(() => {});
      await clickIfVisible(page, page.getByText(/INV[-\d]/i).first(), 2600);
      await slowScroll(page, 400, 4);
    },
  },
  {
    num: 13, name: '13-expenses', route: '/money/expenses',
    async act(page) {
      await slowScroll(page, 400, 4);
      await navSPA(page, '/money/bills/new');
      await slowScroll(page, 550, 5);
    },
  },
  {
    num: 14, name: '14-accounting', route: '/accounting/journal',
    async act(page) {
      await clickIfVisible(page, page.getByText(/payroll for 2026-06/i).first(), 2600);
      await slowScroll(page, 450, 4);
      await navSPA(page, '/accounting/statements/trial-balance');
      await clickIfVisible(page, page.getByRole('button', { name: /^generate$/i }).first(), 3000);
      await slowScroll(page, 400, 3);
    },
  },
  {
    num: 15, name: '15-reports', route: '/reports',
    async act(page) {
      await slowScroll(page, 400, 3);
      (await clickIfVisible(page, page.getByRole('link', { name: /payroll/i }).first(), 3000))
        || (await clickIfVisible(page, page.getByText(/view reports/i).first(), 3000));
      await settle(page, 1200);
      await slowScroll(page, 500, 4);
    },
  },
  {
    num: 16, name: '16-bot', route: '/',
    async act(page, dur) {
      const ask = page.getByPlaceholder(/ask xefebot/i).first();
      await typeSlow(page, ask, 'How much did the June payroll cost in total?', 55);
      await page.waitForTimeout(400);
      await ask.press('Enter').catch(() => {});
      // wait until the answer text stops growing (stream finished), then linger
      let last = 0;
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(2000);
        const len = await page.evaluate(() =>
          (document.querySelector('[role="dialog"]')?.textContent || document.body.textContent || '').length,
        ).catch(() => 0);
        if (len === last && i > 3) break;
        last = len;
      }
      await page.waitForTimeout(2500);
    },
  },
  {
    num: 17, name: '17-mobile', route: '/', mobile: true,
    async act(page) {
      await slowScroll(page, 500, 5);
      await navSPA(page, '/time-leave/attendance');
      await clickIfVisible(page, page.getByRole('button', { name: /previous/i }).first(), 2000);
      await slowScroll(page, 450, 4);
    },
  },
  {
    num: 18, name: '18-languages', route: '/',
    async act(page) {
      for (const lang of [/tetun/i, /portugu/i, /english/i]) {
        // the switcher's own label changes with the locale — re-locate each time
        const switcher = page.getByRole('button').filter({ hasText: /english|tetun|portugu/i }).first();
        if (await clickIfVisible(page, switcher, 700)) {
          await clickIfVisible(page, page.getByRole('menuitem', { name: lang }).first(), 2400)
            || await clickIfVisible(page, page.getByText(lang).last(), 2400);
        }
        await hideSetupBanner(page);
        await page.waitForTimeout(400);
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
  if (sceneOnly && !sceneOnly.has(scene.name)) continue;
  await captureScene(desktop, scene);
}
await desktop.close();

// Mobile context (its own portrait video size)
const mobileScenes = SCENES.filter((s) => s.mobile && (!sceneOnly || sceneOnly.has(s.name)));
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
