/**
 * Hotel Esplanada presentation — automated QA pass (same engine as the TL video).
 *
 * Runs AFTER render.mjs, over the per-scene segments in ./tmp/scene-NN.mp4.
 *   1. Deterministic gate (sets exit code): black/blank frames in recordings,
 *      silent VO, duration drift.
 *   2. Vision contact sheets → ./tmp/qa/scene-NN.png (+ report.json) for an
 *      eyeball / Claude review against each scene's expect/forbid.
 *
 * Usage: node qa.mjs   ·   node qa.mjs --scene=6   ·   node qa.mjs --open
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const argVal = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const ONLY = argVal('scene', null);
const FPS = Number(argVal('fps', 6));
const OPEN = args.includes('--open');

const TMP_DIR = path.resolve('./tmp');
const AUDIO_DIR = path.resolve('./audio');
const QA_DIR = path.join(TMP_DIR, 'qa');

const BG = '#16304a';
const FG = '#F7F5F8';
const FONT = path.resolve('./fonts/Lato-Regular.ttf');

const BLACK = 6;
const LEADIN = 0.5;
const LEADIN_WHITE = 235;
const PURE_WHITE_MEAN = 252;
const PURE_STD = 3;
const SILENT_DB = -50;

const CHAPTERS = {
  101: 'Your Morning View', 102: 'Your Whole Team', 103: 'Every Hour Counts',
  104: 'Payroll in Minutes', 105: 'The Engine Underneath', 106: 'File & Pay',
  107: 'Money In, Money Out', 108: 'One Set of Books', 109: 'Always Within Reach',
};
const chapterTitle = (n) => CHAPTERS[n] || `Chapter ${n}`;

const FORBID_OVERLAYS = ['setup/onboarding banner', 'PWA "install app" prompt', 'error toast'];

const EXPECT = {
  0: { type: 'card', title: 'Intro card', hasVO: true,
       expect: ['amber label "HR · PAYROLL · ACCOUNTING"', 'Xefe wordmark (gold crescent)', 'near-black background'] },
  1: { type: 'card', title: 'The problem', hasVO: true,
       expect: ['amber label "BUILT FOR TIMOR-LESTE"', 'title "Payroll, done properly."'] },
  2: { type: 'recording', title: 'Dashboard', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['Kafé Aroma dashboard (dark)', 'overview cards: payday countdown / 8 employees', 'typing into the XefeBot ask box'] },
  3: { type: 'recording', title: 'People', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['employee directory with 8 café staff', 'an employee profile opened'] },
  4: { type: 'recording', title: 'Hiring', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['open Barista job', 'candidate pipeline with 3 applicants'] },
  5: { type: 'recording', title: 'Time & Leave', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['July attendance grid with real rows', 'leave page with a pending request (Lucia Pereira)'] },
  6: { type: 'recording', title: 'Shifts', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['weekly shift coverage grid with published shifts (Jul 20–25)'] },
  7: { type: 'recording', title: 'Run payroll', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['payroll wizard', 'employee rows with computed WIT/INSS amounts'] },
  8: { type: 'recording', title: 'Approve & payslips', hasVO: true, forbid: FORBID_OVERLAYS,
       expect: ['June 2026 run (approved/paid)', 'run detail or payslip view'] },
  9: { type: 'recording', title: 'The engine', hasVO: true,
       expect: ['dark gold /engine page', 'calculation trace card', 'statute cards / rate table while scrolling'] },
  10: { type: 'recording', title: 'File (tax & INSS)', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['Tax & INSS hub with deadlines', 'monthly WIT filing screen'] },
  11: { type: 'recording', title: 'Pay (bank pack)', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['bank transfers page for the paid run'] },
  12: { type: 'recording', title: 'Invoices', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['invoice list or detail', 'share dialog with WhatsApp option if reached'] },
  13: { type: 'recording', title: 'Bills & expenses', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['expenses list with 3 seeded rows', 'new bill form (supplier withholding select visible)'] },
  14: { type: 'recording', title: 'Accounting', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['journal entry JE-2026-0001 expanded (payroll lines)', 'trial balance'] },
  15: { type: 'recording', title: 'Reports', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['reports hub cards', 'a payroll report page'] },
  16: { type: 'recording', title: 'XefeBot', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['question typed to XefeBot', 'ideally a streamed answer about June payroll'] },
  17: { type: 'recording', title: 'Mobile', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['portrait phone-width capture (pillarboxed)', 'dashboard + attendance on mobile'] },
  18: { type: 'recording', title: 'Languages', hasVO: true, forbid: FORBID_OVERLAYS,
        expect: ['UI flipping English → Tetun → Português'] },
  19: { type: 'card', title: 'Trust card', hasVO: true,
        expect: ['amber label "BUILT TO BE TRUSTED"', 'three short lines of controls copy'] },
  20: { type: 'card', title: 'Close card', hasVO: true,
        expect: ['amber label with XEFE.TL and $4 per employee', 'Xefe wordmark'] },
};
for (const n of Object.keys(CHAPTERS).map(Number)) {
  EXPECT[n] = { type: 'interstitial', title: `Chapter — ${chapterTitle(n)}`, hasVO: false,
                expect: [`legible Aclonica title "${chapterTitle(n)}"`, 'amber rule above it', 'deep-navy background', 'no audio'] };
}

const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
const duration = (f) => Number(sh(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${f}"`));
const hasAudioStream = (f) => sh(`ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "${f}"`).includes('audio');
function maxVolumeDb(f) {
  try {
    const out = execSync(`ffmpeg -hide_banner -i "${f}" -af volumedetect -f null - 2>&1`).toString();
    const m = out.match(/max_volume:\s*(-?[\d.]+) dB/);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}
function extractFrames(seg, outDir) {
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  execSync(`ffmpeg -y -loglevel error -i "${seg}" -vf "fps=${FPS},scale=480:-1" "${outDir}/f_%04d.png"`);
  return readdirSync(outDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(outDir, f));
}
function statBatch(frames) {
  if (!frames.length) return [];
  const list = frames.map((f) => `"${f}"`).join(' ');
  const out = sh(`magick ${list} -colorspace Gray -format "%[fx:mean*255],%[fx:standard_deviation*255]\\n" info:`);
  return out.split('\n').filter(Boolean).map((l) => { const [mean, std] = l.split(',').map(Number); return { mean, std }; });
}
function buildMontage(frames, n, outPng, title) {
  const count = frames.length;
  const slots = Math.min(n, count);
  const pick = [];
  for (let i = 0; i < slots; i++) pick.push(Math.round((i * (count - 1)) / Math.max(1, slots - 1)));
  const uniq = [...new Set(pick)];
  const inputs = uniq.map((idx) => `-label "t=${(idx / FPS).toFixed(1)}s" "${frames[idx]}"`).join(' ');
  execSync(`magick montage -font "${FONT}" ${inputs} -tile 4x -geometry "400x225+4+4" -background "${BG}" -fill "${FG}" -pointsize 18 -title "${title.replace(/"/g, '')}" "${outPng}"`, { stdio: 'ignore' });
}

if (!existsSync(TMP_DIR)) { console.error(`✗ ${TMP_DIR} not found — run \`npm run render\` first.`); process.exit(2); }
if (existsSync(QA_DIR)) rmSync(QA_DIR, { recursive: true });
mkdirSync(QA_DIR, { recursive: true });

let segNums = readdirSync(TMP_DIR).map((f) => f.match(/^scene-(\d+)\.mp4$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
if (ONLY != null) segNums = segNums.filter((n) => n === Number(ONLY));
if (!segNums.length) { console.error(`✗ no scene-*.mp4 in ${TMP_DIR}.`); process.exit(2); }

const C = { reset: '\x1b[0m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', dim: '\x1b[2m', bold: '\x1b[1m' };
const report = [];
let fails = 0, warns = 0;
console.log(`\n${C.bold}QA — Esplanada · ${segNums.length} scenes · ${FPS}fps${C.reset}\n`);

for (const num of segNums) {
  const seg = path.join(TMP_DIR, `scene-${String(num).padStart(2, '0')}.mp4`);
  const meta = EXPECT[num] || { type: 'unknown', title: `Scene ${num}`, hasVO: true, expect: [] };
  const checks = [];
  const fail = (m) => { checks.push({ level: 'FAIL', msg: m }); fails++; };
  const warn = (m) => { checks.push({ level: 'WARN', msg: m }); warns++; };

  const dur = duration(seg);
  const frameDir = path.join(QA_DIR, `frames-${String(num).padStart(2, '0')}`);
  const frames = extractFrames(seg, frameDir);
  const stats = statBatch(frames);
  const t = (i) => i / FPS;
  const minL = Math.min(...stats.map((s) => s.mean));
  const maxL = Math.max(...stats.map((s) => s.mean));

  if (meta.type === 'recording') {
    const dark = stats.map((s, i) => ({ s, i })).filter(({ s }) => s.mean < BLACK);
    if (dark.length) fail(`${dark.length} dead/black frame(s) at ${dark.map(({ i }) => `${t(i).toFixed(1)}s`).join(', ')}`);
    const blank = stats.map((s, i) => ({ s, i })).filter(({ s, i }) => (t(i) < LEADIN && s.mean > LEADIN_WHITE) || (s.mean > PURE_WHITE_MEAN && s.std < PURE_STD));
    if (blank.length) fail(`${blank.length} blank page-load frame(s) at ${blank.map(({ i }) => `${t(i).toFixed(1)}s`).join(', ')}`);
  }

  const hasAud = hasAudioStream(seg);
  const vol = hasAud ? maxVolumeDb(seg) : null;
  if (meta.hasVO) {
    if (!hasAud) fail('no audio stream (VO missing)');
    else if (vol != null && vol < SILENT_DB) fail(`VO effectively silent (max ${vol.toFixed(1)} dB)`);
  } else if (hasAud && vol != null && vol > SILENT_DB) {
    warn(`interstitial has audible sound (max ${vol.toFixed(1)} dB)`);
  }

  let expDur = null;
  if (meta.hasVO && existsSync(path.join(AUDIO_DIR, `scene-${String(num).padStart(2, '0')}.mp3`))) {
    expDur = duration(path.join(AUDIO_DIR, `scene-${String(num).padStart(2, '0')}.mp3`));
    if (Math.abs(dur - expDur) > 2 && dur < expDur - 2) warn(`segment ${dur.toFixed(1)}s shorter than VO ${expDur.toFixed(1)}s — tail may be clipped`);
  }

  const montage = path.join(QA_DIR, `scene-${String(num).padStart(2, '0')}.png`);
  buildMontage(frames, 12, montage, `scene ${num} — ${meta.title}`);
  rmSync(frameDir, { recursive: true });

  const verdict = checks.some((c) => c.level === 'FAIL') ? 'FAIL' : checks.some((c) => c.level === 'WARN') ? 'WARN' : 'PASS';
  const icon = verdict === 'FAIL' ? `${C.red}✗` : verdict === 'WARN' ? `${C.yellow}⚠` : `${C.green}✓`;
  console.log(`${icon} scene ${String(num).padStart(3)} ${C.reset}${meta.title} ${C.dim}(${dur.toFixed(1)}s, luma ${minL.toFixed(0)}–${maxL.toFixed(0)}${vol != null ? `, ${vol.toFixed(0)}dB` : ''})${C.reset}`);
  for (const c of checks) console.log(`      ${c.level === 'FAIL' ? C.red : C.yellow}${c.level}${C.reset} ${c.msg}`);

  report.push({ scene: num, title: meta.title, type: meta.type, verdict, duration: Number(dur.toFixed(2)),
    expectedVoDuration: expDur ? Number(expDur.toFixed(2)) : null, luma: { min: Number(minL.toFixed(1)), max: Number(maxL.toFixed(1)) },
    audio: { hasStream: hasAud, maxDb: vol }, checks, montage, expect: meta.expect || [], forbid: meta.forbid || [] });
}

const reportPath = path.join(QA_DIR, 'report.json');
writeFileSync(reportPath, JSON.stringify({ scenes: report }, null, 2));
console.log(`\n${C.bold}${fails ? C.red : warns ? C.yellow : C.green}${fails} fail · ${warns} warn · ${report.filter((r) => r.verdict === 'PASS').length} pass${C.reset}`);
console.log(`${C.dim}contact sheets → ${QA_DIR}/scene-*.png · manifest → ${reportPath}${C.reset}`);
if (OPEN) { try { execSync(`open "${QA_DIR}"`); } catch {} }
process.exit(fails ? 1 : 0);
