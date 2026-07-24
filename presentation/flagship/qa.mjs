/**
 * Deterministic QA for the Xefe flagship delivery files.
 *
 * Capture-time assertions validate the promised product states. This pass
 * validates the assembled outputs and creates a visual contact sheet for the
 * final human review.
 */
import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRESENTATION_DIR = path.resolve(HERE, '..');
const MASTER = path.join(PRESENTATION_DIR, 'presentation-xefe-flagship-en.mp4');
const WEB = path.join(PRESENTATION_DIR, 'presentation-xefe-flagship-en-web.mp4');
const SRT = path.join(PRESENTATION_DIR, 'presentation-xefe-flagship-en.srt');
const QA_DIR = path.join(HERE, 'tmp', 'qa');
const FRAME_DIR = path.join(QA_DIR, 'frames');
const CONTACT_SHEET = path.join(QA_DIR, 'contact-sheet.png');
const REPORT = path.join(QA_DIR, 'report.json');
const FONT = path.join(PRESENTATION_DIR, 'fonts', 'Lato-Regular.ttf');

function output(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function probe(file) {
  return JSON.parse(output('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,sample_rate,channels',
    '-of', 'json',
    file,
  ]));
}

function frameLuma(files) {
  return files.map((file) => Number(output('magick', [
    file,
    '-colorspace', 'Gray',
    '-format', '%[fx:mean*255]',
    'info:',
  ])));
}

for (const file of [MASTER, WEB, SRT]) {
  if (!existsSync(file)) throw new Error(`Missing flagship output: ${file}`);
}
if (existsSync(QA_DIR)) rmSync(QA_DIR, { recursive: true });
mkdirSync(FRAME_DIR, { recursive: true });

const master = probe(MASTER);
const web = probe(WEB);
const checks = [];
const add = (level, message) => checks.push({ level, message });
const masterVideo = master.streams.find((stream) => stream.codec_type === 'video');
const masterAudio = master.streams.find((stream) => stream.codec_type === 'audio');
const webVideo = web.streams.find((stream) => stream.codec_type === 'video');
const runtime = Number(master.format.duration);
const webSizeMb = Number(web.format.size) / 1024 / 1024;

if (runtime >= 120 && runtime <= 150) add('PASS', `runtime ${runtime.toFixed(1)}s`);
else add('FAIL', `runtime ${runtime.toFixed(1)}s is outside 120–150s`);

if (masterVideo?.width === 1920 && masterVideo?.height === 1080) add('PASS', 'master is 1920×1080');
else add('FAIL', `unexpected master dimensions ${masterVideo?.width}×${masterVideo?.height}`);

if (webVideo?.width === 1280 && webVideo?.height === 720) add('PASS', 'web delivery is 1280×720');
else add('FAIL', `unexpected web dimensions ${webVideo?.width}×${webVideo?.height}`);

if (masterAudio?.codec_name === 'aac') add('PASS', 'AAC narration/music stream present');
else add('FAIL', 'AAC audio stream missing');

if (webSizeMb <= 18) add('PASS', `web delivery is ${webSizeMb.toFixed(1)} MB`);
else add('WARN', `web delivery is ${webSizeMb.toFixed(1)} MB; target is ≤18 MB`);

const captions = readFileSync(SRT, 'utf8');
const captionCount = (captions.match(/-->/g) || []).length;
if (captionCount >= 30) add('PASS', `${captionCount} optional sidecar caption cues`);
else add('FAIL', `only ${captionCount} optional sidecar caption cues`);

execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-i', MASTER,
  '-vf', 'fps=1/6,scale=480:270:flags=lanczos',
  path.join(FRAME_DIR, 'frame-%03d.png'),
]);

const frames = readdirSync(FRAME_DIR)
  .filter((file) => file.endsWith('.png'))
  .sort()
  .map((file) => path.join(FRAME_DIR, file));
const luma = frameLuma(frames);
const deadFrames = luma
  .map((value, index) => ({ value, index }))
  .filter(({ value }) => value < 2.5);
if (deadFrames.length) {
  add('FAIL', `${deadFrames.length} sampled frame(s) are effectively black`);
} else {
  add('PASS', `${frames.length} sampled frames contain visible content`);
}

const montageArgs = [
  'montage',
  '-font', FONT,
  ...frames.flatMap((file, index) => [
    '-label', `${String(index * 6).padStart(3, '0')}s`,
    file,
  ]),
  '-tile', '4x',
  '-geometry', '480x270+6+28',
  '-background', '#0A0A0B',
  '-fill', '#F7F5F8',
  '-pointsize', '18',
  '-title', 'Xefe flagship — final visual QA',
  CONTACT_SHEET,
];
execFileSync('magick', montageArgs, { stdio: 'ignore' });

const volumeResult = spawnSync('ffmpeg', [
  '-hide_banner',
  '-i', MASTER,
  '-af', 'volumedetect',
  '-f', 'null',
  '-',
], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
const volumeMatch = String(volumeResult.stderr || '').match(/max_volume:\s*(-?[\d.]+) dB/);
const maxVolume = volumeMatch ? Number(volumeMatch[1]) : null;
if (maxVolume != null && maxVolume >= -3 && maxVolume <= -0.5) {
  add('PASS', `audio peak ${maxVolume.toFixed(1)} dB`);
} else {
  add('WARN', `audio peak ${maxVolume == null ? 'unknown' : `${maxVolume.toFixed(1)} dB`}`);
}

const report = {
  master: {
    path: MASTER,
    duration: runtime,
    sizeMb: Number(master.format.size) / 1024 / 1024,
    video: masterVideo,
    audio: masterAudio,
  },
  web: {
    path: WEB,
    sizeMb: webSizeMb,
    video: webVideo,
  },
  captions: { path: SRT, cues: captionCount },
  sampledFrames: {
    count: frames.length,
    minLuma: Math.min(...luma),
    maxLuma: Math.max(...luma),
    contactSheet: CONTACT_SHEET,
  },
  audio: { maxVolumeDb: maxVolume },
  checks,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));

for (const check of checks) {
  const symbol = check.level === 'PASS' ? '✓' : check.level === 'WARN' ? '⚠' : '✗';
  console.log(`${symbol} ${check.message}`);
}
console.log(`\ncontact sheet: ${CONTACT_SHEET}`);
console.log(`report: ${REPORT}`);

if (checks.some((check) => check.level === 'FAIL')) process.exit(1);
