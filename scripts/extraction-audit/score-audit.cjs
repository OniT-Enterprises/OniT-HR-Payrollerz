/**
 * Score the extraction audit WITHOUT hand-labelling all 151 documents, using
 * signals that are checkable from evidence already on hand:
 *
 *  - upload gate      : would the UI even accept this file?
 *  - read success     : documentType !== 'other' and confidence >= 0.3 (below
 *                       that the forms show "couldn't read this file")
 *  - amount present   : a bill/expense is useless without a total
 *  - billNumber       : many filenames embed the real invoice number
 *                       ("Invoice_5797…", "Factura nº 127") — an independent
 *                       ground truth for that field
 *  - date sanity      : an invoice cannot be issued after it was emailed, and
 *                       is rarely emailed a year+ later. Catches DD/MM↔MM/DD
 *                       swaps and hallucinated years.
 *  - currency         : how often the foreign-currency guard would now fire
 *
 * Everything flagged here is a CANDIDATE defect to confirm by opening the file.
 */
const fs = require('fs');

const results = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

/** Pull candidate document numbers out of a filename. */
function numbersInFilename(name) {
  const stem = name.replace(/\.[a-z0-9]+$/i, '');
  return (stem.match(/\d{2,}/g) || []).filter((n) => n.length >= 3);
}

function digitsOf(value) {
  return String(value ?? '').replace(/\D/g, '');
}

const rows = [];
for (const r of results) {
  const row = { file: r.file, stratum: r.stratum, gate: r.gate };
  if (r.gate !== 'accepted') { rows.push(row); continue; }
  if (r.error) { row.outcome = 'error'; row.detail = r.error.slice(0, 80); rows.push(row); continue; }

  const f = r.fields;
  row.type = f.documentType;
  row.conf = f.confidence;
  row.amount = f.amount;
  row.currency = f.currency;
  row.billNumber = f.billNumber;
  row.vendorName = f.vendorName;
  row.billDate = f.billDate;
  row.ms = r.duration_ms;

  // What the UI would do with this result.
  row.uiRejects = f.documentType === 'other' || f.confidence < 0.3;
  row.noAmount = f.amount == null;

  // billNumber vs the filename's own numbers.
  const fileNums = numbersInFilename(r.original_name);
  const extracted = digitsOf(f.billNumber);
  if (fileNums.length && extracted) {
    row.numberMatch = fileNums.some((n) => extracted.includes(n) || n.includes(extracted));
  } else if (fileNums.length && !extracted) {
    row.numberMatch = 'missed'; // filename showed a number, extraction returned none
  } else {
    row.numberMatch = 'n/a';
  }

  // Date sanity against when the document was emailed.
  if (f.billDate && r.received) {
    const doc = new Date(`${f.billDate}T00:00:00Z`).getTime();
    const mail = new Date(r.received).getTime();
    const days = (mail - doc) / 86_400_000;
    row.daysBeforeEmail = Math.round(days);
    // 2 days of slack absorbs timezone/next-day sending.
    if (days < -2) row.dateFlag = 'after_email';
    else if (days > 400) row.dateFlag = 'over_year_old';
  } else if (!f.billDate) {
    row.dateFlag = 'missing';
  }

  row.foreign = !!(f.currency && !/^(usd|us\$|\$)$/i.test(f.currency.trim()));
  rows.push(row);
}

const accepted = rows.filter((r) => r.gate === 'accepted');
const read = accepted.filter((r) => r.outcome !== 'error' && !r.uiRejects);

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const count = (fn, set = accepted) => set.filter(fn).length;

console.log('=== corpus ===');
console.log(`documents fetched         : ${rows.length}`);
console.log(`rejected by upload gate   : ${count((r) => r.gate === 'rejected_mime', rows)} (mime) `
  + `${count((r) => r.gate === 'rejected_size', rows)} (size)`);
console.log(`sent to the extractor     : ${accepted.length}`);
console.log(`extractor errors          : ${count((r) => r.outcome === 'error')}`);
console.log(`UI would show "can't read": ${count((r) => r.uiRejects)} (${pct(count((r) => r.uiRejects), accepted.length)})`);
console.log(`usable reads              : ${read.length} (${pct(read.length, accepted.length)})`);

console.log('\n=== field quality on usable reads ===');
console.log(`amount missing            : ${count((r) => r.noAmount, read)} (${pct(count((r) => r.noAmount, read), read.length)})`);
console.log(`billDate missing          : ${count((r) => r.dateFlag === 'missing', read)}`);
console.log(`billDate after the email  : ${count((r) => r.dateFlag === 'after_email', read)}`);
console.log(`billDate >400d before mail: ${count((r) => r.dateFlag === 'over_year_old', read)}`);
const numChecked = read.filter((r) => r.numberMatch === true || r.numberMatch === false || r.numberMatch === 'missed');
console.log(`billNumber vs filename    : ${count((r) => r.numberMatch === true, read)} match, `
  + `${count((r) => r.numberMatch === false, read)} mismatch, `
  + `${count((r) => r.numberMatch === 'missed', read)} missed (of ${numChecked.length} checkable)`);
console.log(`foreign currency detected : ${count((r) => r.foreign, read)}`);
console.log(`vendorName missing        : ${count((r) => !r.vendorName && r.type !== undefined, read)}`);

console.log('\n=== by stratum (usable reads / sent) ===');
const strata = [...new Set(rows.map((r) => r.stratum))];
for (const s of strata) {
  const sent = accepted.filter((r) => r.stratum === s);
  const ok = read.filter((r) => r.stratum === s);
  const med = sent.length
    ? Math.round(sent.map((r) => r.ms || 0).sort((a, b) => a - b)[Math.floor(sent.length / 2)] / 1000)
    : 0;
  console.log(`${s.padEnd(18)} ${String(ok.length).padStart(3)}/${String(sent.length).padEnd(3)} `
    + `median ${med}s  no-amount ${count((r) => r.noAmount, ok)}  foreign ${count((r) => r.foreign, ok)}`);
}

console.log('\n=== flagged documents (open these to confirm) ===');
for (const r of rows) {
  const flags = [];
  if (r.gate !== 'accepted') flags.push(r.gate);
  if (r.outcome === 'error') flags.push(`error:${r.detail}`);
  if (r.uiRejects) flags.push(`ui_rejects(type=${r.type},conf=${r.conf})`);
  if (r.noAmount && !r.uiRejects) flags.push('no_amount');
  if (r.dateFlag && r.dateFlag !== 'missing' && !r.uiRejects) flags.push(`${r.dateFlag}(${r.billDate},d=${r.daysBeforeEmail})`);
  if (r.numberMatch === false) flags.push(`number_mismatch(${r.billNumber})`);
  if (r.foreign) flags.push(`currency=${r.currency}`);
  if (flags.length) console.log(`  ${r.stratum.padEnd(18)} ${r.file.split('/').pop().slice(0, 52).padEnd(54)} ${flags.join(' ')}`);
}
