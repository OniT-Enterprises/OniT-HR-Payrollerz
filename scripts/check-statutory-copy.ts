/**
 * Guards the two error classes that a 2026-08-08 statutory sweep found most
 * often across otherwise unrelated files. Both are invisible to typecheck,
 * lint and every existing test, because both produce text that is perfectly
 * well-formed and simply untrue.
 *
 * ── GUARD 1: floor vs ceiling ────────────────────────────────────────────
 *
 * Lei 4/2012 Art. 1(2) makes the ENTIRE Labour Code a floor, displaceable
 * only upward. Nothing in this codebase encoded that, and the result was
 * eleven separate instances of a statutory MINIMUM presented as the amount
 * owed: annual leave "12 days" (Art. 32(2) says "não pode ser inferior a"),
 * the annual subsidy (Art. 44 "não inferior a 1 salário mensal"), Art. 56
 * service compensation, resignation notice (Art. 49(8) "antecedência
 * mínima"), and more. Every one of them ran the same direction: the employer
 * pays less than they may owe.
 *
 * So: a customer-facing string that cites an article AND states a number must
 * also say which way the number can move. That is a low bar and it is meant
 * to be — it forces the author to decide, which is the whole point.
 *
 * ── GUARD 2: dead article pins ───────────────────────────────────────────
 *
 * A wrong article number is worse than no citation. It survives exactly until
 * an accountant opens the statute, and then it discredits every correct
 * number beside it. This checks cited Lei 4/2012 articles against the article
 * list parsed from the statute itself, and rejects a lettered sub-paragraph
 * (`Art. 2(y)`) on an article that has no lettered paragraphs — the exact
 * shape of a defect that shipped.
 *
 * Run: pnpm check:statutory
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/**
 * Customer-facing statutory copy only. Deliberately NOT the whole tree:
 * engine comments are for engineers, who can read the statute next to them.
 * These are the surfaces a Timor-Leste business owner actually reads.
 */
const SCANNED = [
  "client/lib/help",
  "client/i18n/locales",
  // The PUBLIC site. Added 2026-08-08 after this guard shipped scanning only
  // the two directories above and consequently missed both defects a marketing
  // fact-check found within minutes: `client/content/docs/time-and-leave.ts`
  // cited Art. 34 (occupational safety) for SICK LEAVE, and the same table
  // stated every statutory minimum as a fixed figure.
  //
  // A public page is the WORSE place for either error — it is indexed,
  // quotable, and read by people deciding whether to trust us at all.
  "client/content/docs",
];

/**
 * Marketing page components. Scanned as individual files rather than by
 * directory: client/pages holds ~111 files and almost all are app screens,
 * whose statutory strings live in the locales already covered above.
 */
const SCANNED_FILES = [
  "client/pages/Landing.tsx",
  "client/pages/ProductDetails.tsx",
  "client/pages/XefeEngine.tsx",
  "client/pages/Pricing.tsx",
  "client/pages/AccountantPartners.tsx",
  "client/pages/SecurityPage.tsx",
  "client/pages/DocsIndex.tsx",
  "client/pages/DocsMoneyChain.tsx",
  "client/pages/DocsArticle.tsx",
];

const LAW_TEXT = join(
  ROOT,
  "..",
  "m365-mail-export",
  "laws",
  "lei_4_2012_clean.txt",
);

/** Cites a Labour Law / Tax Act / decree article. */
const CITES_ARTICLE =
  /\b(?:Art(?:igo|\.)?|Arts?\.)\s*\d+|\bLabour Law\b|\bLei 4\/2012\b|\bLei 8\/2008\b|\bDL \d+\/\d{4}\b/i;

/** States a quantity a reader could act on. */
/**
 * States a quantity a reader could act on.
 *
 * TWO orders, not one. English and Portuguese put the number first ("12 dias"),
 * Tetun puts it last ("loron 12", "loron servisu 5"). The first version of this
 * pattern only matched number-then-unit, so it was systematically blind to
 * Tetun — it passed the whole Tetun leave table while flagging the identical
 * English and Portuguese rows. A guard that cannot see one of the three
 * languages we publish in is worse than no guard, because it reports green.
 * Indonesian was added on 2026-08-18 for the same reason: it puts the number
 * first like English ("12 hari", "44 jam"), but none of its units — hari,
 * minggu, bulan, tahun, jam — were in this list, so every Indonesian leave and
 * hours figure would have passed unchecked.
 */
const STATES_A_NUMBER = new RegExp(
  [
    // number then unit: "12 days", "12 dias", "44 horas", "12 hari", "44 jam"
    String.raw`\b\d+(?:[.,]\d+)?\s*(?:days?|dias?|loron|hari|weeks?|semanas?|semana|minggu|months?|meses|fulan|bulan|years?|anos?|tahun|hours?|horas?|oras|jam|%|percent|por cento|persen)\b`,
    // unit then number, the Tetun order: "loron 12", "semana 4", "fulan 6"
    String.raw`\b(?:loron|semana|fulan|oras)(?:\s+\w+)?\s+\d+\b`,
    // bare money
    String.raw`\$\s?\d`,
  ].join("|"),
  "i",
);

/**
 * Words that tell a reader which way the number can move. Generous on
 * purpose — three languages, and the goal is to force a decision, not to
 * dictate phrasing.
 */
const DIRECTION_WORDS = [
  // English
  "at least", "minimum", "no less than", "not less than", "at minimum",
  "up to", "at most", "no more than", "maximum", "floor", "cap", "caps",
  "capped", "ceiling", "more than", "above", "below", "exceed", "exceeds",
  "or less", "or fewer", "limit", "within",
  // Portuguese
  "pelo menos", "mínimo", "mínima", "não inferior", "no mínimo",
  "até", "máximo", "máxima", "não superior", "acima", "abaixo",
  "limite", "teto", "ou inferior", "no prazo", "exceder", "máx", "mín",
  // Tetun. Both spellings of maximum/minimum: the app's Tetun is mixed
  // orthography (see .tulunrc), so "maksimu" and "máximu" both occur in
  // shipped strings and a guard that knows only one silently passes the other.
  "pelu menus", "menus", "to'o", "liu", "limite",
  "maksimu", "máximu", "maksimun", "mínimu", "minimu",
  // Indonesian. "sekurang-kurangnya" and "paling sedikit" are the statutory
  // floor phrasings; "maksimal"/"paling banyak" the ceiling ones. "melebihi"
  // and "atau kurang" cover the comparative forms the app actually uses.
  "sekurang-kurangnya", "sekurangnya", "paling sedikit", "minimal", "minimum",
  "tidak kurang dari", "paling banyak", "paling lama", "maksimal", "maksimum",
  "tidak lebih dari", "tidak boleh melebihi", "melebihi", "melampaui",
  "hingga", "sampai", "di atas", "di bawah", "lebih dari", "kurang dari",
  "atau kurang", "atau lebih", "batas", "dibatasi", "dalam waktu",
  "paling lambat", "selambat-lambatnya", "paling cepat",
];

/**
 * Strings that cite an article and a number but genuinely need no direction
 * word. Each needs a REASON — an allowlist without reasons becomes a dumping
 * ground within a month.
 */
const ALLOWED: Array<{ match: string; reason: string }> = [
  {
    match: "6 são remunerados por inteiro",
    reason: "Verbatim Art. 33(4) quote — statute text is never edited to suit a lint rule.",
  },
  {
    match: "1 mês de salário por cada período de 5 anos",
    reason: "Verbatim Art. 56 quote.",
  },
  {
    match: "seis meses civis",
    reason: "Verbatim DL 18/2017 Art. 15(1) quote.",
  },
  {
    match: "24 horas consecutivas",
    reason: "Verbatim Art. 30(1) quote.",
  },
  {
    match: "4% employee",
    reason: "INSS contribution rates are exact, not a floor — DL 20/2017 Art. 10 fixes both sides.",
  },
  {
    match: "Two limbs of DL 20/2017 Art. 8(2) pull it into the contribution base",
    reason:
      "Attendance-premium entry: an in-or-out classification question (Art. 8 base vs Art. 9 exclusion), and the 4%/6% rates in its worked example are exact — there is no floor or ceiling to state.",
  },
  {
    match: "4% withheld from each worker",
    reason: "As above — an exact rate, not a range.",
  },
  {
    match: "4% retidos",
    reason: "As above (pt).",
  },
  {
    match: "4% ne'ebé retein",
    reason: "As above (tet).",
  },
  {
    match: "6 months of contributions in the last 12",
    reason:
      "DL 18/2017 Art. 15(1) qualifying period — an exact eligibility test, not an amount that can be improved on.",
  },
  {
    match: "6 meses de contribuições nos últimos 12",
    reason: "As above (pt).",
  },
  {
    match: "kontribuisaun fulan 6 iha fulan 12",
    reason: "As above (tet).",
  },
  {
    match: "two 1-hour paid",
    reason:
      "Art. 62(3) fixes two daily periods of one hour each. Stated exactly; the surrounding copy already says the child-age limit.",
  },
  {
    match: "duas pausas diárias pagas de 1 hora",
    reason: "As above (pt).",
  },
  {
    match: "pausa 2 kada loron",
    reason: "As above (tet).",
  },
  // ── Public leave table: rows whose figure is EXACT in the statute ──
  // Art. 1(2) still makes each an improvable floor, but the row itself is not
  // misquoting anything, and the table now carries one Art. 1(2) note beneath
  // it rather than repeating "at least" in every cell. Cell-by-cell hedging
  // would make a reference table unreadable, which is its own kind of harm.
  {
    match: "Art. 60",
    reason:
      "Paternity. Art. 60(1) states an exact figure — 'licença remunerada de 5 dias úteis' — not a floor formula. Covered by the table's Art. 1(2) note.",
  },
  {
    match: "Art. 33(3)",
    reason:
      "Family events. Art. 33(3) states 'pode faltar justificadamente 3 dias por ano' — exact. Covered by the table's Art. 1(2) note.",
  },
  {
    match: "Art. 33.º(3)",
    reason: "As above (pt).",
  },
  {
    match: "Art. 59(4)",
    reason:
      "Pregnancy loss. Art. 59(4) states 'licença com a duração de 4 semanas' — exact. Covered by the table's Art. 1(2) note.",
  },
  {
    match: "Art. 59.º(4)",
    reason: "As above (pt).",
  },
];

// ── Article inventory, parsed from the statute itself ────────────────────

interface ArticleFacts {
  hasLetteredParagraphs: boolean;
}

function loadArticles(): Map<number, ArticleFacts> | null {
  let text: string;
  try {
    text = readFileSync(LAW_TEXT, "utf8");
  } catch {
    return null; // Statute not present (CI without the corpus) — guard 2 skips.
  }

  const lines = text.split("\n");
  const starts: Array<{ n: number; line: number }> = [];
  lines.forEach((line, i) => {
    const m = /^\s*Artigo\s+(\d+)\.º/.exec(line);
    if (m) starts.push({ n: Number(m[1]), line: i });
  });

  const out = new Map<number, ArticleFacts>();
  starts.forEach((s, idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1].line : lines.length;
    const body = lines.slice(s.line, end).join("\n");
    // A lettered paragraph looks like "y) Trabalho extraordinário, …" at the
    // start of a line. Art. 2 has none; Art. 5 has the definitions.
    const hasLettered = /^\s*[a-z]\)\s/m.test(body);
    // An article number can repeat across the PT/Tetun columns; keep the
    // richer reading rather than letting a stub overwrite it.
    const prior = out.get(s.n);
    out.set(s.n, {
      hasLetteredParagraphs: (prior?.hasLetteredParagraphs ?? false) || hasLettered,
    });
  });
  return out;
}

// ── Scan ─────────────────────────────────────────────────────────────────

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) yield full;
  }
}

/** Quoted string literals, with their line numbers. */
function stringLiterals(source: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = [];
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    // Skip comment lines: engine notes are for engineers, who can read the
    // statute sitting next to them.
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      if (m[1].length > 25) out.push({ text: m[1], line: i + 1 });
    }
  });

  // TABLE ROWS. The public docs render statutory tables as arrays of short
  // cells, so the number and its citation land in SEPARATE literals:
  //
  //     ["Sick leave", "12 days a year, …", "First 6 days full pay…", "Art. 34"]
  //
  // Scanning literal-by-literal sees a duration with no citation and a
  // citation with no duration, and clears both — which is exactly how a
  // wrong article number and four unqualified statutory minimums sat on the
  // public site while this guard reported green. Join each bracketed row into
  // one pseudo-literal so a row is judged as the reader reads it: whole.
  const joined = lines.join("\n");
  for (const m of joined.matchAll(/\[\s*"(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")+\s*,?\s*\]/g)) {
    const cells = [...m[0].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((c) => c[1]);
    if (cells.length < 2) continue;
    const line = joined.slice(0, m.index ?? 0).split("\n").length;
    out.push({ text: cells.join(" · "), line });
  }

  return out;
}

const problems: string[] = [];
const articles = loadArticles();

/** Every file to scan: the walked directories, plus the named page files. */
function filesToScan(): string[] {
  const out: string[] = [];
  for (const dir of SCANNED) {
    try {
      out.push(...walk(join(ROOT, dir)));
    } catch {
      // Directory absent in this checkout — skip rather than fail the build.
    }
  }
  for (const file of SCANNED_FILES) {
    const abs = join(ROOT, file);
    try {
      statSync(abs);
      out.push(abs);
    } catch {
      // A page that has been renamed or removed. Not this guard's business.
    }
  }
  return out;
}

{
  const entries = filesToScan();

  for (const file of entries) {
    const rel = relative(ROOT, file);
    const source = readFileSync(file, "utf8");

    for (const { text, line } of stringLiterals(source)) {
      // ── Guard 2: article pins ──
      //
      // ONLY for Lei 4/2012. A citation like "DL 20/2017 Art. 9(c)" is to a
      // different instrument with its own article numbering, and checking it
      // against the Labour Law's inventory produces a confident false
      // positive — which is precisely the failure this script exists to
      // prevent, so it must not commit it itself. Skip any string that names
      // another instrument.
      const namesAnotherInstrument =
        /\bDL\s*\d+\/\d{4}|\bDecreto-Lei|\bLei\s*8\/2008|\bLei\s*12\/2016|Taxes and Duties|Tributária/i.test(
          text,
        );
      if (articles && !namesAnotherInstrument) {
        for (const m of text.matchAll(/Art(?:igo|s?)?\.?\s*(\d+)\s*\(\s*([a-z])\s*\)/gi)) {
          const n = Number(m[1]);
          const facts = articles.get(n);
          if (!facts) {
            problems.push(
              `${rel}:${line}  cites Art. ${n}, which does not exist in Lei 4/2012.\n    ${text.slice(0, 110)}`,
            );
          } else if (!facts.hasLetteredParagraphs) {
            problems.push(
              `${rel}:${line}  cites Art. ${n}(${m[2]}), but Art. ${n} has NO lettered paragraphs.\n    This is the Art. 2(y)-for-Art. 5(y) defect. Check the article number.\n    ${text.slice(0, 110)}`,
            );
          }
        }
      }

      // ── Guard 1: floor vs ceiling ──
      if (!CITES_ARTICLE.test(text) || !STATES_A_NUMBER.test(text)) continue;
      const lower = text.toLowerCase();
      if (DIRECTION_WORDS.some((w) => lower.includes(w))) continue;
      if (ALLOWED.some((a) => text.includes(a.match))) continue;

      problems.push(
        `${rel}:${line}  cites an article and states a number, but never says whether it is a floor or a ceiling.\n    Lei 4/2012 Art. 1(2) makes the Code a MINIMUM throughout — a contract may promise more.\n    Add "at least"/"up to"/"mínimo"/"máximo" (or allowlist it with a reason in this script).\n    ${text.slice(0, 140)}`,
      );
    }
  }
}

if (!articles) {
  console.log(
    "note: lei_4_2012_clean.txt not found — article-pin checking skipped (floor/ceiling still ran).",
  );
}

if (problems.length > 0) {
  console.error(
    `\ncheck-statutory-copy: ${problems.length} problem(s) in customer-facing statutory copy\n`,
  );
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}

console.log("check-statutory-copy: statutory copy states floors and ceilings, and every article pin resolves.");
