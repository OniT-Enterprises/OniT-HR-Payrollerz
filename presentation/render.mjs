/**
 * Hotel Esplanada presentation — final MP4 assembly.
 *
 * Same engine as the Timor-Leste minister video (Playwright .webm + ElevenLabs
 * .mp3 per scene → ffmpeg → normalized 1920×1080 segments → xfade concat →
 * music mix), re-skinned to the Hotel Esplanada brand (navy #214569 + amber
 * #F59E0B, Aclonica headings) and driven by this video's scene list.
 *
 * Usage:
 *   npm run render
 *   npm run render -- --vo-only     # placeholder cards instead of recordings
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

const langArg = process.argv.slice(2).find((a) => a.startsWith('--lang='))?.split('=')[1] || 'en';
const LANG_SUFFIX = langArg === 'en' ? '' : `-${langArg}`;
const AUDIO_DIR = path.resolve(`./audio${LANG_SUFFIX}`);
const REC_DIR = path.resolve(`./recordings${LANG_SUFFIX}`);
const TMP_DIR = path.resolve(`./tmp${LANG_SUFFIX}`);
const OUT = path.resolve(`./presentation-xefe-${langArg}.mp4`);
const MUSIC = path.resolve('./music/background.mp3');

// Card text per locale (EN canonical). Bookend cards reuse the wordmark.
const CARDS_BY_LANG = {
  en: {
    0: { label: 'HR · PAYROLL · ACCOUNTING', card: 'Xefe' },
    1: { label: 'BUILT FOR TIMOR-LESTE', card: 'Payroll,\ndone properly.' },
    19: { label: 'BUILT TO BE TRUSTED', card: 'Two people to approve.\nBooks that stay balanced.\nEverything logged.', pointsize: 76 },
    20: { label: 'XEFE.TL  ·  $4 PER EMPLOYEE  ·  BUILT BY ONIT', card: 'Xefe' },
  },
};
const cardsForLang = CARDS_BY_LANG[langArg] || CARDS_BY_LANG.en;

// Chapter interstitials (silent). IDs in the 100s so they never collide with
// VO-bearing scenes 0–20.
const CHAPTERS = {
  en: {
    101: 'Your Morning View',
    102: 'Your Whole Team',
    103: 'Every Hour Counts',
    104: 'Payroll in Minutes',
    105: 'The Engine Underneath',
    106: 'File & Pay',
    107: 'Money In, Money Out',
    108: 'One Set of Books',
    109: 'Always Within Reach',
  },
};
const chaptersForLang = CHAPTERS[langArg] || CHAPTERS.en;
const ch = (id) => ({ num: id, interstitial: true, title: chaptersForLang[id] });

const SCENES = [
  { num: 0, rec: null, title: 'Intro', logo: true, ...(cardsForLang[0] || CARDS_BY_LANG.en[0]) },
  { num: 1, rec: null, title: 'The problem', ...(cardsForLang[1] || CARDS_BY_LANG.en[1]) },
  ch(101),
  { num: 2, rec: '02-dashboard', title: 'Your morning view' },
  ch(102),
  { num: 3, rec: '03-people', title: 'Your whole team' },
  { num: 4, rec: '04-hiring', title: 'Hiring built in' },
  ch(103),
  { num: 5, rec: '05-timeleave', title: 'Time & leave' },
  { num: 6, rec: '06-shifts', title: 'Shift planning' },
  ch(104),
  { num: 7, rec: '07-runpayroll', title: 'Payroll in minutes' },
  { num: 8, rec: '08-approve', title: 'Approve & payslips' },
  ch(105),
  { num: 9, rec: '09-engine', title: 'The engine' },
  ch(106),
  { num: 10, rec: '10-tax', title: 'File' },
  { num: 11, rec: '11-bank', title: 'Pay' },
  ch(107),
  { num: 12, rec: '12-invoices', title: 'Invoices' },
  { num: 13, rec: '13-expenses', title: 'Bills & expenses' },
  ch(108),
  { num: 14, rec: '14-accounting', title: 'Real accounts' },
  { num: 15, rec: '15-reports', title: 'Reports' },
  ch(109),
  { num: 16, rec: '16-bot', title: 'Just ask' },
  { num: 17, rec: '17-mobile', title: 'In a pocket' },
  { num: 18, rec: '18-languages', title: 'Your language' },
  { num: 19, rec: null, title: 'Trust', ...(cardsForLang[19] || CARDS_BY_LANG.en[19]) },
  { num: 20, rec: null, title: 'Close', tail: 2.0, logo: true, ...(cardsForLang[20] || CARDS_BY_LANG.en[20]) },
];

const args = process.argv.slice(2);
const VO_ONLY = args.includes('--vo-only');

function audioPath(n) {
  return path.join(AUDIO_DIR, `scene-${String(n).padStart(2, '0')}.mp3`);
}
function audioDuration(n) {
  return Number(execSync(
    `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${audioPath(n)}"`,
  ).toString().trim());
}
function findWebm(dir) {
  const full = path.join(REC_DIR, dir);
  if (!existsSync(full)) return null;
  const files = readdirSync(full).filter((f) => f.endsWith('.webm'));
  return files.length ? path.join(full, files[0]) : null;
}

// Brand fonts (downloaded into ./fonts). The live site renders headings in bold
// Lato (Aclonica is only the logo wordmark and reads chunky/casual at card
// scale), so cards use Lato-Bold for headings + Lato-Regular for labels — this
// matches the site and the SEO stat card. magick needs an explicit font path.
const FONT_HEADING = path.resolve('./fonts/Lato-Bold.ttf');
const FONT_BODY = path.resolve('./fonts/Lato-Regular.ttf');

// Real Xefe wordmark (gold crescent over the x) — used on the bookend cards.
const LOGO = path.resolve('./assets/xefe-logo-light.webp');

// Brand palette (Hotel Esplanada site.json + booking-widget branding):
const COLOR_NAVY = '0x101013';       // card background (Xefe near-black)
const COLOR_NAVY_DEEP = '0x09090B';  // interstitial background (deeper)
const COLOR_AMBER = '0xF59E0B';      // accent (Xefe gold crescent)
const COLOR_CREAM = '0xF7F5F8';      // primary text

const HEX = (c) => '#' + c.replace(/^0x/, '');

function tmpPath(n) {
  return path.join(TMP_DIR, `scene-${String(n).padStart(2, '0')}.mp4`);
}
function tmpPngPath(n, suffix) {
  return path.join(TMP_DIR, `scene-${String(n).padStart(2, '0')}${suffix}.png`);
}

// Detect the first non-white frame so we can -ss past the browser's blank
// page-load lead-in (otherwise the xfade holds on dead white). Samples the
// first 12s at 10fps; returns the time of the first frame with mean luma < 250.
function firstContentTime(webm) {
  const probe = path.join(TMP_DIR, '_probe');
  try {
    if (existsSync(probe)) rmSync(probe, { recursive: true });
    mkdirSync(probe, { recursive: true });
    execSync(`ffmpeg -y -loglevel error -i "${webm}" -t 12 -vf "fps=10,scale=48:27" "${probe}/f_%03d.png"`);
    const files = readdirSync(probe).filter((f) => f.endsWith('.png')).sort();
    for (let i = 0; i < files.length; i++) {
      const mean = Number(
        execSync(`magick identify -format '%[fx:mean*255]' "${path.join(probe, files[i])}"`).toString().trim(),
      );
      if (mean < 250) return Math.min(11, Math.max(0, i / 10 - 0.05));
    }
  } catch {
    /* fall through */
  } finally {
    if (existsSync(probe)) rmSync(probe, { recursive: true });
  }
  return 0;
}

const TAIL_SILENCE = 0.6;

/** Render a scene with a real screen recording, speed-fitted to its VO window. */
function renderRecording(scene, audio, dur) {
  const out = tmpPath(scene.num);
  const webm = findWebm(scene.rec);
  if (!webm) {
    console.warn(`  ⚠ no recording for ${scene.rec} — falling back to placeholder card`);
    return renderCard(scene, audio, dur);
  }
  const tail = scene.tail ?? TAIL_SILENCE;
  let totalDur = dur + tail;
  let audioPad = tail;
  const webmDur = Number(
    execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${webm}"`).toString().trim(),
  );
  const trimStart = firstContentTime(webm);
  const seek = trimStart > 0.05 ? `-ss ${trimStart.toFixed(2)} ` : '';
  const effDur = Math.max(0.5, webmDur - trimStart);
  const raw = effDur / dur;
  const speed = raw >= 1 ? raw : Math.max(0.8, raw);
  let speedPrefix = '';
  if (Math.abs(speed - 1) > 0.01) speedPrefix = `setpts=PTS/${speed.toFixed(4)},`;
  if (trimStart > 0.05 || Math.abs(speed - 1) > 0.01) {
    console.log(`    ↳ trim ${trimStart.toFixed(2)}s white + fit ${effDur.toFixed(1)}s → ${dur.toFixed(1)}s VO (×${speed.toFixed(2)})`);
  }
  const baseChain =
    `${speedPrefix}scale=1920:1080:force_original_aspect_ratio=decrease,` +
    `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,` +
    `tpad=stop_mode=clone:stop_duration=${totalDur}`;

  const filter = `[0:v]${baseChain}[v0];[1:a]apad=pad_dur=${audioPad}[aud]`;
  execSync(
    `ffmpeg -y ${seek}-i "${webm}" -i "${audio}" -filter_complex "${filter}" -map "[v0]" -map "[aud]" -t ${totalDur} ` +
      `-c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${out}"`,
    { stdio: 'inherit' },
  );
  return out;
}

/** Branded card: deep-navy background, amber label + rule, Aclonica title in cream. */
function renderCard(scene, audio, dur, text) {
  const out = tmpPath(scene.num);
  const title = text || scene.card || scene.title;
  const label = (scene.label || '').toUpperCase();
  const png = tmpPngPath(scene.num, '-card');

  let cmd = `magick -size 1920x1080 xc:'${HEX(COLOR_NAVY)}' `;
  if (label) {
    cmd +=
      `-gravity None -fill '${HEX(COLOR_AMBER)}' -draw "rectangle 910,398 1010,402" ` +
      `-gravity center -font '${FONT_BODY}' -pointsize 30 -fill '${HEX(COLOR_AMBER)}' -annotate +0-190 "${label}" `;
  }
  if (scene.logo) {
    // Composite the real wordmark (gold crescent over the x) instead of text.
    cmd += `\\( "${LOGO}" -resize x220 \\) -gravity center -geometry +0+40 -composite "${png}"`;
  } else {
    const pt = scene.pointsize || 118;
    cmd += `-gravity center -font '${FONT_HEADING}' -pointsize ${pt} -interline-spacing 18 -fill '${HEX(COLOR_CREAM)}' -annotate +0+10 "${title}" "${png}"`;
  }
  execSync(cmd, { stdio: 'inherit' });

  const totalDur = dur + (scene.tail ?? TAIL_SILENCE);
  const pad = scene.tail ?? TAIL_SILENCE;
  execSync(
    `ffmpeg -y -loop 1 -framerate 30 -t ${totalDur} -i "${png}" -i "${audio}" ` +
      `-filter_complex "[0:v]scale=1920:1080,setsar=1,fps=30[v];[1:a]apad=pad_dur=${pad}[aud]" ` +
      `-map "[v]" -map "[aud]" -t ${totalDur} ` +
      `-c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${out}"`,
    { stdio: 'inherit' },
  );
  return out;
}

/** Silent full-screen chapter interstitial. Aclonica title, amber rule, deep navy. */
function renderInterstitial(scene, dur = 2.8) {
  const out = tmpPath(scene.num);
  const png = tmpPngPath(scene.num, '-int');
  execSync(
    `magick -size 1920x1080 xc:'${HEX(COLOR_NAVY_DEEP)}' ` +
      `-gravity None -fill '${HEX(COLOR_AMBER)}' -draw "rectangle 860,472 1060,476" ` +
      `-gravity center -font '${FONT_HEADING}' -pointsize 74 -fill '${HEX(COLOR_CREAM)}' -annotate +0+20 "${scene.title}" "${png}"`,
    { stdio: 'inherit' },
  );
  const totalDur = dur + TAIL_SILENCE;
  execSync(
    `ffmpeg -y -loop 1 -framerate 30 -t ${totalDur} -i "${png}" ` +
      `-f lavfi -i "anullsrc=r=44100:cl=mono:d=${totalDur}" ` +
      `-filter_complex "[0:v]scale=1920:1080,setsar=1,fps=30[v]" -map "[v]" -map 1:a -t ${totalDur} ` +
      `-c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${out}"`,
    { stdio: 'inherit' },
  );
  return out;
}

// ─── Run ──────────────────────────────────────────────────────────────────
if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const segments = [];
for (const scene of SCENES) {
  if (scene.interstitial) {
    console.log(`▶ Scene ${scene.num} — ${scene.title}  [interstitial]`);
    segments.push(renderInterstitial(scene));
    continue;
  }
  if (!existsSync(audioPath(scene.num))) {
    throw new Error(`Missing ${audioPath(scene.num)} — run \`npm run audio\` first.`);
  }
  const dur = audioDuration(scene.num);
  console.log(`▶ Scene ${scene.num} — ${scene.title}  (${dur.toFixed(1)}s)`);
  if (VO_ONLY || scene.rec === null) {
    segments.push(renderCard(scene, audioPath(scene.num), dur, scene.card || scene.title));
  } else {
    segments.push(renderRecording(scene, audioPath(scene.num), dur));
  }
}

// xfade chain (0.4s) between all segments.
const XFADE = 0.4;
console.log(`\n▶ Building xfade chain for ${segments.length} segments`);
const segDurations = segments.map((seg) =>
  Number(execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${seg}"`).toString().trim()),
);

const vFilters = [];
const aFilters = [];
let vLabel = '0:v';
let aLabel = '0:a';
let cumOffset = 0;
for (let i = 1; i < segments.length; i++) {
  cumOffset += segDurations[i - 1] - XFADE;
  const outV = `v${i}`;
  const outA = `a${i}`;
  vFilters.push(`[${vLabel}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${cumOffset.toFixed(3)}[${outV}]`);
  aFilters.push(`[${aLabel}][${i}:a]acrossfade=d=${XFADE}:c1=tri:c2=tri[${outA}]`);
  vLabel = outV;
  aLabel = outA;
}

const filterComplex = [...vFilters, ...aFilters].join(';');
const inputs = segments.map((s) => `-i "${s}"`).join(' ');
const totalDur = segDurations.reduce((a, b) => a + b, 0) - XFADE * (segments.length - 1);

const noMusic = path.join(TMP_DIR, 'no-music.mp4');
console.log(`▶ Total runtime: ${totalDur.toFixed(1)}s after xfades`);
execSync(
  `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" ` +
    `-map "[${vLabel}]" -map "[${aLabel}]" ` +
    `-c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p ` +
    `-c:a aac -b:a 192k -movflags +faststart "${noMusic}"`,
  { stdio: 'inherit' },
);

const hasMusic = existsSync(MUSIC);
if (hasMusic) {
  const fadeOutStart = (totalDur - 3).toFixed(2);
  console.log(`▶ Mixing background music under VO (fade in 2s / fade out 3s)`);
  execSync(
    `ffmpeg -y -i "${noMusic}" -stream_loop -1 -i "${MUSIC}" ` +
      `-filter_complex "[1:a]volume=0.13,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3,atrim=0:${totalDur}[mus];` +
      `[0:a][mus]amix=inputs=2:duration=first:normalize=0[mix];[mix]loudnorm=I=-16:TP=-1.5:LRA=11[a]" ` +
      `-map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart "${OUT}"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(
    `ffmpeg -y -i "${noMusic}" -af loudnorm=I=-16:TP=-1.5:LRA=11 ` +
      `-c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart "${OUT}"`,
    { stdio: 'inherit' },
  );
}

const total = Number(
  execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${OUT}"`).toString().trim(),
);
console.log(`\n✓ ${OUT}  (${total.toFixed(1)}s)`);
