/**
 * Xefe flagship video — 1080p master + lower-bandwidth 720p delivery.
 *
 * Uses the fresh recordings from capture.mjs and the voice clips generated
 * from vo-lines.txt. Product footage starts on frame one; chapter cards are
 * intentionally absent. Captions are delivered as an optional sidecar file.
 *
 * Usage (from presentation/):
 *   npm run render:flagship
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRESENTATION_DIR = path.resolve(HERE, '..');
const AUDIO_DIR = path.join(HERE, 'audio');
const RECORDINGS_DIR = path.join(HERE, 'recordings');
const TMP_DIR = path.join(HERE, 'tmp');
const FONT_REGULAR = path.join(PRESENTATION_DIR, 'fonts', 'Lato-Regular.ttf');
const FONT_BOLD = path.join(PRESENTATION_DIR, 'fonts', 'Lato-Bold.ttf');
const LOGO = path.join(PRESENTATION_DIR, 'assets', 'xefe-logo-light.webp');
const MUSIC = path.join(PRESENTATION_DIR, 'music', 'background.mp3');
const VO_FILE = path.join(HERE, 'vo-lines.txt');

const MASTER = path.join(PRESENTATION_DIR, 'presentation-xefe-flagship-en.mp4');
const WEB = path.join(PRESENTATION_DIR, 'presentation-xefe-flagship-en-web.mp4');
const SRT_FILE = path.join(PRESENTATION_DIR, 'presentation-xefe-flagship-en.srt');

const COLORS = {
  canvas: '#0A0A0B',
  panel: '#151517',
  gold: '#FBBF24',
  green: '#6A9C29',
  white: '#F7F5F8',
  muted: '#A1A1AA',
};

const args = process.argv.slice(2);
const sceneArg = args.find((arg) => arg.startsWith('--scene='))?.split('=')[1];
const selectedScenes = sceneArg
  ? new Set(sceneArg.split(',').map((value) => Number(value.trim())))
  : null;

const SCENES = [
  {
    num: 0,
    label: '',
    opening: true,
    clips: [{ shot: 'dashboard', weight: 1, crop: 'main', from: 0, to: 0.94 }],
    captions: [
      'This is Xefe — payroll, people, and accounts',
      'built for Timor-Leste.',
      'Open it, and the work that matters',
      'is already waiting for you.',
    ],
  },
  {
    num: 1,
    label: 'YOUR TEAM',
    clips: [
      { shot: 'attendance', weight: 0.4, crop: 'main' },
      { shot: 'team', weight: 0.3, crop: 'main', from: 0.31, to: 0.57 },
      { shot: 'team', weight: 0.3, crop: 'main', from: 0.78 },
    ],
    captions: [
      'Your team is in one place.',
      "Attendance, overtime, leave, and next week's shifts",
      'stay connected, so you are not copying',
      'the same names and hours between spreadsheets.',
      'You see what needs attention, and move on.',
    ],
  },
  {
    num: 2,
    label: 'PAYROLL IN MINUTES',
    clips: [{ shot: 'payroll', weight: 1, crop: 'main' }],
    captions: [
      'At payday, choose the period',
      'and Xefe does the careful work.',
      'It brings in hours, applies overtime and night-work rates,',
      'then calculates social security and withholding tax',
      'for every employee.',
      'Review the numbers, get a second approval,',
      'and each person receives a clear payslip.',
    ],
  },
  {
    num: 3,
    label: '',
    clips: [{ shot: 'engine', weight: 1 }],
    captions: [
      "That simple flow is backed by Timor-Leste's rules,",
      'written into the calculation engine.',
      'Every line can be traced from salary and hours',
      'to deductions and net pay —',
      'so the answer is not just fast; it is explainable.',
    ],
  },
  {
    num: 4,
    label: 'FILE & PAY',
    clips: [
      { shot: 'tax', weight: 0.48, crop: 'main', from: 0.08 },
      { shot: 'bank', weight: 0.52, crop: 'dialog', from: 0.08 },
    ],
    captions: [
      'Xefe then prepares the monthly tax and social-security forms,',
      'tracks the deadlines, and builds the bank pack',
      'in the format local banks expect.',
      'File, pay, and keep the evidence together —',
      'without rebuilding the month in Excel.',
    ],
  },
  {
    num: 5,
    label: 'ONE SET OF BOOKS',
    clips: [
      { shot: 'money', weight: 0.18, crop: 'main', to: 0.16 },
      { shot: 'money', weight: 0.18, crop: 'main', from: 0.42, to: 0.72 },
      { shot: 'accounting', weight: 0.24, crop: 'main', to: 0.18 },
      { shot: 'trial-balance', weight: 0.4, crop: 'main' },
    ],
    captions: [
      'Money coming in and going out stays connected too.',
      'Invoices, bills, expenses, payroll journals,',
      'and the trial balance all update one set of books,',
      'balanced to the cent.',
      'Export the detail when your accountant or donor needs it.',
    ],
  },
  {
    num: 6,
    label: 'ALWAYS WITHIN REACH',
    clips: [
      { shot: 'bot', weight: 0.36, crop: 'dialog', to: 0.27 },
      { shot: 'mobile', weight: 0.38, crop: 'mobile', from: 0.7 },
      { shot: 'languages', weight: 0.26, crop: 'right' },
    ],
    captions: [
      'Need an answer? Ask XefeBot in plain language.',
      'Managers can use Xefe from a phone,',
      'and staff carry payslips, leave, and shifts in Ekipa.',
      'The whole system switches between',
      'Tetun, English, and Portuguese.',
    ],
  },
  {
    num: 7,
    label: 'BUILT TO BE TRUSTED',
    clips: [
      { shot: 'payroll', weight: 0.5, crop: 'center', from: 0.62 },
      { shot: 'trial-balance', weight: 0.5, crop: 'main', from: 0.42 },
    ],
    captions: [
      'Two people approve payroll.',
      'Changes are logged.',
      'The books refuse to go out of balance.',
      'Xefe keeps the controls strong',
      'while the screen stays simple.',
    ],
  },
  {
    num: 8,
    label: '',
    card: true,
    captions: [
      'Xefe. Your back office, built for Timor-Leste.',
      'Free to set up and explore.',
      'Start today, at xefe dot T L.',
    ],
  },
];

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function duration(file) {
  return Number(output('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    file,
  ]));
}

function audioPath(num) {
  return path.join(AUDIO_DIR, `scene-${String(num).padStart(2, '0')}.mp3`);
}

function recordingPath(shot) {
  return path.join(RECORDINGS_DIR, shot, 'page.webm');
}

function tmpPath(name) {
  return path.join(TMP_DIR, name);
}

function scenePath(num) {
  return tmpPath(`scene-${String(num).padStart(2, '0')}.mp4`);
}

function standardCrop(kind) {
  switch (kind) {
    case 'main':
      return 'crop=1664:936:256:72,scale=1920:1080:flags=lanczos';
    case 'center':
      return 'crop=1440:810:320:135,scale=1920:1080:flags=lanczos';
    case 'dialog':
      return 'crop=1280:720:320:180,scale=1920:1080:flags=lanczos';
    case 'right':
      return 'crop=1280:720:600:70,scale=1920:1080:flags=lanczos';
    case 'soft':
      return 'crop=1760:990:80:45,scale=1920:1080:flags=lanczos';
    default:
      return 'scale=1920:1080:flags=lanczos';
  }
}

function normalizeStandardClip(source, destination, clip, allocatedDuration) {
  const sourceDuration = duration(source);
  const start = sourceDuration * (clip.from ?? 0);
  const end = sourceDuration * (clip.to ?? 1);
  const span = Math.max(0.5, end - start);
  const ratio = allocatedDuration / span;
  const filter = [
    standardCrop(clip.crop),
    `setpts=${ratio.toFixed(6)}*(PTS-STARTPTS)`,
    'fps=30',
    `tpad=stop_mode=clone:stop_duration=${allocatedDuration.toFixed(3)}`,
    `trim=duration=${allocatedDuration.toFixed(3)}`,
    'setsar=1',
    'format=yuv420p',
  ].join(',');

  run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-ss', start.toFixed(3),
    '-t', span.toFixed(3),
    '-i', source,
    '-vf', filter,
    '-an',
    '-t', allocatedDuration.toFixed(3),
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    destination,
  ]);
}

function normalizeMobileClip(source, destination, clip, allocatedDuration, backgroundImage) {
  const sourceDuration = duration(source);
  const start = sourceDuration * (clip.from ?? 0);
  const end = sourceDuration * (clip.to ?? 1);
  const span = Math.max(0.5, end - start);
  const ratio = allocatedDuration / span;
  const filter = [
    `[0:v]setpts=${ratio.toFixed(6)}*(PTS-STARTPTS),fps=30,`,
    'scale=-2:880:flags=lanczos,',
    'pad=iw+24:ih+24:12:12:color=0x27272A,',
    `tpad=stop_mode=clone:stop_duration=${allocatedDuration.toFixed(3)},`,
    `trim=duration=${allocatedDuration.toFixed(3)}[phone]`,
    `;[1:v]fps=30,trim=duration=${allocatedDuration.toFixed(3)},`,
    'setpts=PTS-STARTPTS[bg]',
    ';[bg][phone]overlay=x=1250:y=(H-h)/2:shortest=1,',
    'setsar=1,format=yuv420p[v]',
  ].join('');

  run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-ss', start.toFixed(3),
    '-t', span.toFixed(3),
    '-i', source,
    '-loop', '1',
    '-framerate', '30',
    '-i', backgroundImage,
    '-filter_complex', filter,
    '-map', '[v]',
    '-an',
    '-t', allocatedDuration.toFixed(3),
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    destination,
  ]);
}

function createOpeningOverlay() {
  const outputFile = tmpPath('opening-overlay.png');
  run('magick', [
    '-size', '1920x1080', 'xc:none',
    '-fill', `${COLORS.canvas}E6`,
    '-draw', 'roundrectangle 78,72 950,382 30,30',
    '(', LOGO, '-resize', 'x112', ')',
    '-geometry', '+122+108',
    '-composite',
    '-font', FONT_BOLD,
    '-pointsize', '27',
    '-fill', COLORS.gold,
    '-gravity', 'NorthWest',
    '-annotate', '+126+240', 'BUILT FOR TIMOR-LESTE',
    '-pointsize', '62',
    '-fill', COLORS.white,
    '-annotate', '+122+286', 'Payroll, done properly.',
    outputFile,
  ]);
  return outputFile;
}

function createMobileBackground() {
  const outputFile = tmpPath('mobile-background.png');
  run('magick', [
    '-size', '1920x1080', `xc:${COLORS.canvas}`,
    '-gravity', 'NorthWest',
    '-font', FONT_BOLD,
    '-pointsize', '27',
    '-fill', COLORS.gold,
    '-annotate', '+150+340', 'BUILT FOR REAL WORK',
    '-pointsize', '78',
    '-fill', COLORS.white,
    '-annotate', '+150+410', 'Everything fits',
    '-annotate', '+150+500', 'on a real phone.',
    '-font', FONT_REGULAR,
    '-pointsize', '34',
    '-fill', COLORS.muted,
    '-annotate', '+155+620', 'Fast to read. Simple to act on.',
    outputFile,
  ]);
  return outputFile;
}

function createSceneLabel(scene) {
  if (!scene.label) return null;
  const outputFile = tmpPath(`scene-${String(scene.num).padStart(2, '0')}-label.png`);
  run('magick', [
    '-size', '1920x1080', 'xc:none',
    '-gravity', 'NorthWest',
    '-fill', `${COLORS.canvas}BD`,
    '-draw', 'roundrectangle 60,48 620,106 14,14',
    '-font', FONT_BOLD,
    '-pointsize', '25',
    '-fill', COLORS.gold,
    '-annotate', '+86+64', scene.label,
    outputFile,
  ]);
  return outputFile;
}

function createCloseCard() {
  const outputFile = tmpPath('close-card.png');
  run('magick', [
    '-size', '1920x1080', `xc:${COLORS.canvas}`,
    '(', LOGO, '-resize', 'x178', ')',
    '-gravity', 'North',
    '-geometry', '+0+170',
    '-composite',
    '-font', FONT_BOLD,
    '-gravity', 'Center',
    '-pointsize', '62',
    '-fill', COLORS.white,
    '-annotate', '+0-35', 'Your back office, built for Timor-Leste.',
    '-pointsize', '76',
    '-fill', COLORS.gold,
    '-annotate', '+0+95', 'Start free at xefe.tl',
    '-font', FONT_REGULAR,
    '-pointsize', '31',
    '-fill', COLORS.muted,
    '-annotate', '+0+175', 'US$4 per employee · only when real payroll runs',
    '-pointsize', '26',
    '-fill', COLORS.muted,
    '-annotate', '+0+250', 'TETUN  ·  ENGLISH  ·  PORTUGUÊS',
    outputFile,
  ]);
  return outputFile;
}

function localCaptionCues(scene, audioDuration) {
  const weights = scene.captions.map((line) => Math.max(1, line.split(/\s+/).length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const cues = [];
  let cursor = 0.08;
  scene.captions.forEach((line, index) => {
    const proportional = (audioDuration - 0.16) * (weights[index] / totalWeight);
    const start = cursor;
    const end = Math.min(audioDuration - 0.04, cursor + proportional - 0.04);
    cues.push({ start, end, lines: wrapCaption(line) });
    cursor += proportional;
  });
  return cues;
}

function renderRecordingScene(scene, audio, audioDuration, openingOverlay, mobileBackground) {
  const tail = 0.45;
  const totalDuration = audioDuration + tail;
  const weightTotal = scene.clips.reduce((sum, clip) => sum + clip.weight, 0);
  const normalized = [];

  scene.clips.forEach((clip, index) => {
    const source = recordingPath(clip.shot);
    if (!existsSync(source)) throw new Error(`Missing flagship recording: ${source}`);
    const allocated = totalDuration * (clip.weight / weightTotal);
    const destination = tmpPath(`scene-${String(scene.num).padStart(2, '0')}-clip-${index}.mp4`);
    if (clip.crop === 'mobile') {
      normalizeMobileClip(source, destination, clip, allocated, mobileBackground);
    } else {
      normalizeStandardClip(source, destination, clip, allocated);
    }
    normalized.push(destination);
  });

  const inputs = [];
  for (const file of normalized) inputs.push('-i', file);
  let nextInputIndex = normalized.length;
  const audioIndex = nextInputIndex++;
  inputs.push('-i', audio);
  const labelImage = createSceneLabel(scene);
  let labelIndex = null;
  if (labelImage) {
    labelIndex = nextInputIndex++;
    inputs.push('-loop', '1', '-framerate', '30', '-i', labelImage);
  }
  let overlayIndex = null;
  if (scene.opening) {
    overlayIndex = nextInputIndex++;
    inputs.push('-loop', '1', '-framerate', '30', '-i', openingOverlay);
  }

  const filters = [];
  const labels = normalized.map((_, index) => {
    filters.push(`[${index}:v]setpts=PTS-STARTPTS[n${index}]`);
    return `[n${index}]`;
  });
  if (labels.length === 1) {
    filters.push(`${labels[0]}null[base]`);
  } else {
    filters.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0[base]`);
  }

  let videoLabel = 'base';
  if (labelIndex != null) {
    filters.push(`[${labelIndex}:v]format=rgba[label]`);
    filters.push(`[${videoLabel}][label]overlay=0:0:shortest=1[labeled]`);
    videoLabel = 'labeled';
  }

  if (scene.opening) {
    filters.push(
      `[${overlayIndex}:v]format=rgba,` +
      'fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=3.6:d=0.7:alpha=1[opening]',
    );
    filters.push(`[${videoLabel}][opening]overlay=0:0:enable='lt(t,4.3)'[opened]`);
    videoLabel = 'opened';
  }
  filters.push(`[${videoLabel}]format=yuv420p[vout]`);
  filters.push(
    `[${audioIndex}:a]apad=pad_dur=${tail},atrim=duration=${totalDuration.toFixed(3)}[aout]`,
  );

  run('ffmpeg', [
    '-y', '-loglevel', 'error', ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-t', totalDuration.toFixed(3),
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    scenePath(scene.num),
  ]);
}

function renderCardScene(scene, audio, audioDuration, cardImage) {
  const tail = 0.9;
  const totalDuration = audioDuration + tail;
  const inputs = [
    '-loop', '1',
    '-framerate', '30',
    '-i', cardImage,
    '-i', audio,
  ];
  const filters = ['[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[v]'];
  filters.push(`[1:a]apad=pad_dur=${tail},atrim=duration=${totalDuration.toFixed(3)}[a]`);
  run('ffmpeg', [
    '-y', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[v]',
    '-map', '[a]',
    '-t', totalDuration.toFixed(3),
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    scenePath(scene.num),
  ]);
}

function parseVoiceover() {
  const raw = readFileSync(VO_FILE, 'utf8');
  const blocks = new Map();
  const regex = /SCENE\s+(\d+)\s+—[^\n]*\n+([\s\S]*?)(?=\n+SCENE\s+\d+\s+—|$)/g;
  for (const match of raw.matchAll(regex)) {
    const text = match[2]
      .split('\n')
      .filter((line) => !/^[─═]+$/.test(line.trim()))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    blocks.set(Number(match[1]), text);
  }
  return blocks;
}

function secondsToSrt(totalSeconds) {
  const ms = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function wrapCaption(text, limit = 46) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function writeCaptions(sceneDurations, sceneStarts) {
  const voiceover = parseVoiceover();
  const srt = [];
  let index = 1;

  for (const scene of SCENES) {
    const spoken = voiceover.get(scene.num);
    if (!spoken) throw new Error(`Voiceover text missing for scene ${scene.num}`);
    const clipDuration = duration(audioPath(scene.num));
    const sceneStart = sceneStarts.get(scene.num);
    for (const cue of localCaptionCues(scene, clipDuration)) {
      const start = sceneStart + cue.start;
      const end = sceneStart + cue.end;
      srt.push(
        String(index++),
        `${secondsToSrt(start)} --> ${secondsToSrt(end)}`,
        cue.lines.join('\n'),
        '',
      );
    }

    if (sceneDurations.get(scene.num) < clipDuration) {
      throw new Error(`Scene ${scene.num} is shorter than its narration`);
    }
  }

  writeFileSync(SRT_FILE, `${srt.join('\n').trim()}\n`);
}

for (const required of [FONT_REGULAR, FONT_BOLD, LOGO, MUSIC, VO_FILE]) {
  if (!existsSync(required)) throw new Error(`Missing render dependency: ${required}`);
}
for (const scene of SCENES) {
  if (!existsSync(audioPath(scene.num))) throw new Error(`Missing narration: ${audioPath(scene.num)}`);
}

if (!selectedScenes && existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const openingOverlay = createOpeningOverlay();
const mobileBackground = createMobileBackground();
const closeCard = createCloseCard();
const sceneDurations = new Map();

for (const scene of SCENES) {
  if (selectedScenes && !selectedScenes.has(scene.num)) {
    if (!existsSync(scenePath(scene.num))) {
      throw new Error(`Cannot reuse missing scene ${scene.num}; run a full render first`);
    }
    sceneDurations.set(scene.num, duration(scenePath(scene.num)));
    continue;
  }
  const audio = audioPath(scene.num);
  const audioDuration = duration(audio);
  console.log(`▶ Scene ${scene.num}  ${audioDuration.toFixed(1)}s`);
  if (scene.card) {
    renderCardScene(scene, audio, audioDuration, closeCard);
  } else {
    renderRecordingScene(scene, audio, audioDuration, openingOverlay, mobileBackground);
  }
  sceneDurations.set(scene.num, duration(scenePath(scene.num)));
}

const segments = SCENES.map((scene) => scenePath(scene.num));
const XFADE = 0.28;
const inputs = [];
for (const segment of segments) inputs.push('-i', segment);

const filters = [];
let videoLabel = '0:v';
let audioLabel = '0:a';
let offset = 0;
const sceneStarts = new Map([[SCENES[0].num, 0]]);
for (let index = 1; index < segments.length; index++) {
  offset += sceneDurations.get(SCENES[index - 1].num) - XFADE;
  sceneStarts.set(SCENES[index].num, offset);
  filters.push(
    `[${videoLabel}][${index}:v]xfade=transition=fade:duration=${XFADE}:` +
    `offset=${offset.toFixed(3)}[v${index}]`,
  );
  filters.push(
    `[${audioLabel}][${index}:a]acrossfade=d=${XFADE}:c1=tri:c2=tri[a${index}]`,
  );
  videoLabel = `v${index}`;
  audioLabel = `a${index}`;
}

const noMusic = tmpPath('no-music.mp4');
run('ffmpeg', [
  '-y', '-loglevel', 'error', ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', `[${videoLabel}]`,
  '-map', `[${audioLabel}]`,
  '-c:v', 'libx264',
  '-crf', '18',
  '-preset', 'medium',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  noMusic,
]);

const finalMix = tmpPath('final-mix.mp4');
const totalDuration = duration(noMusic);
const fadeOutAt = Math.max(0, totalDuration - 3.0);
run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-i', noMusic,
  '-stream_loop', '-1',
  '-i', MUSIC,
  '-filter_complex',
  `[1:a]volume=0.08,afade=t=in:st=0:d=1.5,` +
    `afade=t=out:st=${fadeOutAt.toFixed(3)}:d=3,atrim=0:${totalDuration.toFixed(3)}[music];` +
    '[0:a][music]amix=inputs=2:duration=first:normalize=0,' +
    'loudnorm=I=-16:TP=-1.5:LRA=10[a]',
  '-map', '0:v',
  '-map', '[a]',
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-movflags', '+faststart',
  finalMix,
]);

writeCaptions(sceneDurations, sceneStarts);
run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-i', finalMix,
  '-c', 'copy',
  '-movflags', '+faststart',
  MASTER,
]);

run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-i', MASTER,
  '-vf', 'scale=1280:720:flags=lanczos',
  '-c:v', 'libx264',
  '-crf', '25',
  '-preset', 'medium',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '96k',
  '-movflags', '+faststart',
  WEB,
]);

const masterDuration = duration(MASTER);
const masterSize = Number(output('stat', ['-f', '%z', MASTER])) / 1024 / 1024;
const webSize = Number(output('stat', ['-f', '%z', WEB])) / 1024 / 1024;
console.log(`\n✓ ${MASTER}  ${masterDuration.toFixed(1)}s · ${masterSize.toFixed(1)} MB`);
console.log(`✓ ${WEB}  ${webSize.toFixed(1)} MB`);
console.log(`✓ ${SRT_FILE}`);
