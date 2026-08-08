/**
 * Extraction accuracy harness — runs the PRODUCTION extractor
 * (server/xefe-api/extract.js) over the stratified corpus of real TL supplier
 * invoices and receipts, and records what it returned for each document.
 *
 * Calls extractDocumentFields() directly, bypassing HTTP/auth, so this measures
 * the extractor itself. The upload gate (client canExtractFile + route mime
 * allow-list) is applied here in code so documents the UI would reject are
 * recorded as gate failures instead of being silently scored as successes.
 *
 * Run from server/xefe-api (its .env holds CLAUDE_CODE_OAUTH_TOKEN):
 *   node run_extract_audit.js --corpus <dir> --out <results.json> [--limit N] [--concurrency 4]
 */
const fs = require('fs');
const path = require('path');

// This harness lives outside server/xefe-api, so Node would not resolve that
// package's modules from here — point every require at it explicitly.
// Resolved from this script's own location so the harness runs from any checkout.
const API_DIR = process.env.XEFE_API_DIR
  || path.resolve(__dirname, '..', '..', 'server', 'xefe-api');

require(path.join(API_DIR, 'node_modules', 'dotenv'))
  .config({ path: path.join(API_DIR, '.env') });

const { extractDocumentFields } = require(path.join(API_DIR, 'extract'));

// Mirrors client/lib/aiExtract.ts EXTRACT_MIME_TYPES + the route's allow-list.
const UPLOAD_ALLOWED_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
]);
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

// Receipt strata go through the Expenses form ('expense'); the rest are bills.
const EXPENSE_STRATA = new Set(['receipt_pdf', 'receipt_docx']);

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    corpus: get('--corpus'),
    out: get('--out'),
    limit: Number(get('--limit', '0')) || 0,
    concurrency: Number(get('--concurrency', '4')),
    only: get('--only'),
  };
}

async function runOne(entry, corpus) {
  const filePath = path.join(corpus, entry.file);
  const stat = fs.statSync(filePath);
  const record = {
    file: entry.file,
    stratum: entry.stratum,
    original_name: entry.original_name,
    content_type: entry.content_type,
    bytes: stat.size,
    from_domain: entry.from_domain,
    received: entry.received,
    subject: entry.subject,
    kind: EXPENSE_STRATA.has(entry.stratum) ? 'expense' : 'bill',
  };

  // The UI would never reach the extractor for these — record why.
  if (!UPLOAD_ALLOWED_MIME.has(entry.content_type)) {
    record.gate = 'rejected_mime';
    return record;
  }
  if (stat.size > UPLOAD_MAX_BYTES) {
    record.gate = 'rejected_size';
    return record;
  }
  record.gate = 'accepted';

  const started = Date.now();
  try {
    record.fields = await extractDocumentFields(filePath, record.kind);
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
  }
  record.duration_ms = Date.now() - started;
  return record;
}

async function main() {
  const { corpus, out, limit, concurrency, only } = parseArgs();
  if (!corpus || !out) {
    console.error('usage: node run_extract_audit.js --corpus <dir> --out <file.json>');
    process.exit(2);
  }

  let manifest = JSON.parse(fs.readFileSync(path.join(corpus, 'manifest.json'), 'utf8'));
  if (only) manifest = manifest.filter((e) => e.stratum === only);
  if (limit) manifest = manifest.slice(0, limit);

  // Resume support: keep results already recorded for this corpus.
  const results = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  const done = new Set(results.map((r) => r.file));
  const queue = manifest.filter((e) => !done.has(e.file));
  console.log(`${manifest.length} documents; ${done.size} already done; running ${queue.length} at concurrency ${concurrency}`);

  let next = 0;
  let finished = 0;
  const flush = () => fs.writeFileSync(out, JSON.stringify(results, null, 2));

  async function worker(id) {
    while (true) {
      const index = next++;
      if (index >= queue.length) return;
      const entry = queue[index];
      const record = await runOne(entry, corpus);
      results.push(record);
      finished += 1;
      flush();
      const verdict = record.gate !== 'accepted'
        ? record.gate
        : record.error
          ? `ERROR ${record.error.slice(0, 60)}`
          : `${record.fields.documentType} conf=${record.fields.confidence} amount=${record.fields.amount} cur=${record.fields.currency ?? '-'}`;
      console.log(`[${finished}/${queue.length}] w${id} ${entry.stratum}/${entry.file.split('/').pop().slice(0, 45)} → ${verdict}`);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, (_, i) => worker(i + 1)));
  flush();
  console.log(`\nwrote ${results.length} records → ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
