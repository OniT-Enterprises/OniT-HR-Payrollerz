/**
 * Meza UI Illustration Generator
 * Uses GPT Image API via the HariiSuku API module.
 *
 * Usage: OPENAI_API_KEY=sk-... node scripts/generate-illustrations.js [--force]
 */

const { generateImage } = require('/Users/tonyfranklin/Sites/gamby/TimorFunClub2/municipality-visual-system/lib/api.js');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'illustrations');
const API_KEY = process.env.OPENAI_API_KEY;
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 3;

// Consistent style block for all illustrations
const STYLE = `Style: flat vector illustration with clean lines, soft shadows, and subtle gradients. Limited color palette using dark teal (#0d9488), warm amber (#f59e0b), coral red (#ef4444), soft emerald (#34d399), and cool zinc grays (#27272a, #3f3f46, #71717a) on a transparent background. Modern SaaS aesthetic — friendly, warm, approachable but professional. No text or words in the image. The illustration must work well on a dark background (#09090b). PNG with transparency.`;

const MEZA_CHAR = `a friendly cartoon desk/table character ("Meza") with short legs and a warm smile`;

const images = [
  // === LANDING PAGE ===
  {
    name: 'hero-dashboard',
    size: '1536x1024',
    quality: 'high',
    prompt: `A wide cinematic illustration showing a modern HR command center / dashboard concept. In the center, ${MEZA_CHAR} stands confidently behind a large glowing holographic display showing abstract charts, employee cards, and payroll data. Around it are floating UI elements: pie charts, bar graphs, calendar widgets, and document icons — all rendered as elegant translucent panels with teal and amber glows. The scene has a tropical backdrop with subtle palm tree silhouettes and a warm Timor-Leste sunset gradient in the far background. Spacious composition with room for text overlay on the left side. ${STYLE}`,
  },
  {
    name: 'pain-paper',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A small spot illustration showing a chaotic pile of paper documents, folders, and crumpled forms overflowing from a traditional wooden desk. Papers are flying and scattered. A stressed pencil character sits on top looking overwhelmed. The mess conveys "paper-based HR chaos". Compact square composition, centered subject with breathing room. ${STYLE}`,
  },
  {
    name: 'pain-excel',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A small spot illustration of a laptop screen showing a broken, glitching spreadsheet with red error cells, mismatched columns, and formula errors (#REF!, #N/A). The laptop looks stressed with sweat drops. Tiny numbers and cells are spilling out of the screen. Conveys "spreadsheet payroll nightmares". Compact square composition, centered subject. ${STYLE}`,
  },
  {
    name: 'pain-foreign',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A small spot illustration of a globe/world with a confused face, wearing a headset, trying to read a document labeled with unfamiliar symbols. Around it float disconnected puzzle pieces representing different countries' flags and tax rules that don't fit together. Conveys "foreign software doesn't understand local rules". Compact square composition. ${STYLE}`,
  },
  {
    name: 'pain-solution',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A small spot illustration showing ${MEZA_CHAR} looking confident and organized, with a glowing checkmark above its head. Around it, neatly organized floating panels show a clean payslip, a happy employee icon, a calculator with correct math, and the Timor-Leste flag. Everything is tidy, connected, and harmonious. Conveys "the right solution, built for here". Compact square composition. ${STYLE}`,
  },
  {
    name: 'persona-maria',
    size: '1024x1024',
    quality: 'high',
    prompt: `A warm character portrait illustration of Maria, a friendly middle-aged Timorese woman who owns a small kiosk/toko. She has dark hair tied back, a warm confident smile, and wears a simple colorful blouse. She's standing behind her small shop counter with shelves of goods behind her, holding a phone showing a simple money tracking app. Southeast Asian features, warm brown skin. Circular or bust composition. ${STYLE}`,
  },
  {
    name: 'persona-ana',
    size: '1024x1024',
    quality: 'high',
    prompt: `A warm character portrait illustration of Ana, a young energetic Timorese woman in her late 20s who runs a small café. She has dark wavy hair, a bright smile, and wears a casual apron. She's holding a coffee cup in one hand and a tablet/phone in the other, standing in front of her café with a chalkboard menu visible. Southeast Asian features, warm brown skin. Circular or bust composition. ${STYLE}`,
  },
  {
    name: 'persona-tomas',
    size: '1024x1024',
    quality: 'high',
    prompt: `A warm character portrait illustration of Tomas, a sturdy Timorese man in his 40s who is a market vendor. He has short dark hair, a friendly weathered face, and wears a simple collared shirt with rolled sleeves. He's standing at his market stall with tropical fruits and vegetables displayed, holding a notebook that's being replaced by a phone. Southeast Asian features, warm brown skin. Circular or bust composition. ${STYLE}`,
  },

  // === EMPTY STATES ===
  {
    name: 'empty-employees',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A friendly illustration for an "empty state" when no employees have been added yet. ${MEZA_CHAR} stands in a clean, spacious office with empty desks and chairs, holding a clipboard and waving welcomingly as if inviting people in. A door is open with warm light coming through. The mood is optimistic — "your team starts here". Compact centered composition. ${STYLE}`,
  },
  {
    name: 'empty-invoices',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A friendly illustration for an "empty state" when no invoices exist yet. ${MEZA_CHAR} sits at a clean desk with a blank document in front of it, holding a pen ready to write the first invoice. A gentle sparkle suggests "first one is special". A small stack of coins and a calculator sit nearby. Optimistic, encouraging mood. Compact centered composition. ${STYLE}`,
  },
  {
    name: 'empty-payroll',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A friendly illustration for an "empty state" when no payroll has been run yet. ${MEZA_CHAR} stands next to a large friendly calendar with a payday circled, holding a neat payslip document. Small coin and banknote icons float gently around. The mood is "payday is coming, let's set it up". Compact centered composition. ${STYLE}`,
  },
  {
    name: 'empty-accounting',
    size: '1024x1024',
    quality: 'medium',
    prompt: `A friendly illustration for an "empty state" when the chart of accounts hasn't been set up. ${MEZA_CHAR} stands next to a large open ledger book with blank pages, holding a pencil. A balanced scale (representing double-entry accounting) sits nearby in equilibrium. Small floating icons of a plus and minus sign. The mood is "let's get the books ready". Compact centered composition. ${STYLE}`,
  },

  // === ERROR & CELEBRATION ===
  {
    name: 'error-boundary',
    size: '1024x1024',
    quality: 'medium',
    prompt: `An illustration for a "something went wrong" error screen. ${MEZA_CHAR} looks apologetic and sheepish, with a small lightning bolt or disconnected cable nearby. Some gears or cogs are scattered on the floor as if something fell apart. The mood is "oops, we're fixing it" — not scary, just a friendly "sorry about that". A small wrench sits nearby suggesting repair is underway. Compact centered composition. ${STYLE}`,
  },
  {
    name: 'setup-complete',
    size: '1024x1024',
    quality: 'high',
    prompt: `A celebratory illustration for a "setup complete / all done!" success screen. ${MEZA_CHAR} is jumping with joy, arms raised, with confetti, streamers, and small star particles floating around. A large golden checkmark or trophy glows behind it. The mood is pure celebration — "you did it! Your company is ready!". Vibrant but still clean and professional. Compact centered composition. ${STYLE}`,
  },
];

async function main() {
  if (!API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Filter what needs generating
  const queue = images.filter(img => {
    const outPath = path.join(OUT_DIR, `${img.name}.png`);
    if (!FORCE && fs.existsSync(outPath)) {
      console.log(`  ✓ ${img.name}.png exists (skip)`);
      return false;
    }
    return true;
  });

  if (queue.length === 0) {
    console.log('\nAll images already exist. Use --force to regenerate.');
    return;
  }

  const costPerImage = { high: 0.04, medium: 0.02, low: 0.01 };
  const totalCost = queue.reduce((sum, img) => sum + (costPerImage[img.quality] || 0.02), 0);
  console.log(`\nGenerating ${queue.length} images (~$${totalCost.toFixed(2)} estimated)\n`);

  // Process in batches
  let completed = 0;
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (img) => {
      const outPath = path.join(OUT_DIR, `${img.name}.png`);
      const start = Date.now();
      try {
        process.stdout.write(`  ⟳ ${img.name} (${img.size}, ${img.quality})...\n`);
        const buf = await generateImage(img.prompt, {
          apiKey: API_KEY,
          model: 'gpt-image-1',
          quality: img.quality,
          size: img.size,
        });
        fs.writeFileSync(outPath, buf);
        completed++;
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`  ✓ ${img.name}.png — ${(buf.length / 1024).toFixed(0)}KB (${elapsed}s) [${completed}/${queue.length}]`);
      } catch (err) {
        console.error(`  ✗ ${img.name} FAILED: ${err.message}`);
      }
    }));
  }

  console.log(`\nDone! ${completed}/${queue.length} images saved to ${OUT_DIR}`);
}

main();
