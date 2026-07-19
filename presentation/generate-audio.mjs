/**
 * Hotel Esplanada presentation — automated VO generation.
 *
 * Parses vo-lines.txt into per-scene blocks, calls ElevenLabs with the
 * "Alice" British-female narration voice (same voice as the Timor-Leste
 * tourism video's English cut), writes one MP3 per scene to ./audio/.
 *
 * Env (falls back to the media-monitor .env.local a couple of dirs up):
 *   ELEVENLABS_API_KEY          required
 *   ELEVENLABS_MODEL            optional, default eleven_multilingual_v2
 *
 * Usage:
 *   npm run audio                 # all scenes
 *   node generate-audio.mjs --only=3,5   # specific scenes
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

// ── 1. Load env (prefer process env, fall back to media-monitor's .env.local) ──
function loadEnv() {
  let key = process.env.ELEVENLABS_API_KEY;
  let model = process.env.ELEVENLABS_MODEL;

  if (!key) {
    // This script lives in timorleste.tl/presentation/esplanada/, so the
    // media-monitor env is three dirs up (…/Sites/timor-media-monitor/web).
    const candidates = [
      '../../../timor-media-monitor/web/.env.local',
      '../../timor-media-monitor/web/.env.local',
      '../../../../timor-media-monitor/web/.env.local',
    ].map((p) => path.resolve(p));
    const sibling = candidates.find((p) => existsSync(p));
    if (sibling) {
      for (const line of readFileSync(sibling, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (!m) continue;
        const [, k, v] = m;
        const val = v.replace(/^["']|["']$/g, '');
        if (k === 'ELEVENLABS_API_KEY' && !key) key = val;
        if (k === 'ELEVENLABS_MODEL' && !model) model = val;
      }
    }
  }
  if (!key) throw new Error('ELEVENLABS_API_KEY not set (and not found in ../../../timor-media-monitor/web/.env.local)');
  return { key, model: model || 'eleven_multilingual_v2' };
}

const { key: API_KEY, model: MODEL } = loadEnv();

// ── 2. Parse vo-lines.txt into scenes ─────────────────────────────────────
const VO_FILE = path.resolve('./vo-lines.txt');
const OUT_DIR = path.resolve('./audio');

// Narration voice — "Alice" (British female), the same voice used for the
// Timor-Leste tourism video's English cut. Neutral, clear, engaging.
const NARRATION_VOICE = 'Xb7hH8MSUJpSbSDYk0k2';

function parseScenes(raw) {
  const lines = raw.split('\n');
  const scenes = [];
  let current = null;
  for (const line of lines) {
    const header = line.match(/SCENE\s+(\d+)\s+—\s+([^()]+?)\s*\(target\s+(\d+)s\)/i);
    if (header) {
      if (current) scenes.push(current);
      current = { num: Number(header[1]), title: header[2].trim(), target: Number(header[3]), text: [] };
      continue;
    }
    if (!current) continue;
    if (/^[─═]+$/.test(line.trim())) continue;   // horizontal rules
    if (/^\[.*\]$/.test(line.trim())) continue;   // [stage directions]
    if (/^\s*#/.test(line)) continue;             // # comments
    current.text.push(line);
  }
  if (current) scenes.push(current);
  return scenes.map((s) => ({ ...s, text: s.text.join('\n').trim() })).filter((s) => s.text.length);
}

// ── 3. Pronunciation overrides (extend as needed after a listen) ──────────
// Alice reads Dili / Esplanada / Tetun acceptably. Override only if a specific
// mispronunciation is heard on playback.
const PRONUNCIATION_OVERRIDES = [
  [/\bOniT\b/g, 'Onit'],       // company name — one word "On-it", not spelled out
  [/\bXefe\b/gi, 'Sheffy'],    // brand spoken "SHEF-ee" (like "chef" + ee); on-screen text stays "Xefe"
  [/\bBNCTL\b/g, 'B-N-C-T-L'], // bank acronyms — spelled out
  [/\bBNU\b/g, 'B-N-U'],
  [/\bEkipa\b/g, 'eh-KEE-pah'],
];

function applyOverrides(text) {
  let out = text;
  for (const [re, sub] of PRONUNCIATION_OVERRIDES) out = out.replace(re, sub);
  return out;
}

// ── 4. Render one scene to MP3 ────────────────────────────────────────────
async function renderScene(scene) {
  const ttsText = applyOverrides(scene.text);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${NARRATION_VOICE}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: ttsText,
      model_id: MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.85,
        style: 0.25,
        use_speaker_boost: true,
        speed: 0.9,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status} on scene ${scene.num}: ${body.slice(0, 500)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── 5. Run ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const onlyNums = onlyArg ? new Set(onlyArg.split(',').map((n) => Number(n.trim()))) : null;

const raw = await readFile(VO_FILE, 'utf8');
const scenes = parseScenes(raw);
console.log(`Parsed ${scenes.length} scenes from vo-lines.txt`);
console.log(`Voice: Alice (EN narration)   Model: ${MODEL}\n`);

await mkdir(OUT_DIR, { recursive: true });

for (const scene of scenes) {
  if (onlyNums && !onlyNums.has(scene.num)) continue;
  const file = path.join(OUT_DIR, `scene-${String(scene.num).padStart(2, '0')}.mp3`);
  process.stdout.write(`▶ Scene ${scene.num} — ${scene.title}  (${scene.target}s target) ... `);
  try {
    const mp3 = await renderScene(scene);
    await writeFile(file, mp3);
    const sec = Math.round(mp3.length / 16000); // 128kbps ≈ 16 KB/sec
    console.log(`✓ ~${sec}s, ${(mp3.length / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.log(`✗`);
    console.error(`  ${err.message}`);
  }
}

console.log(`\n✓ Done. MP3s in ${OUT_DIR}`);
console.log('  Compare each clip duration to the "target" in vo-lines.txt.');
