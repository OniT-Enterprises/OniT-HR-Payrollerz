/**
 * Before/after on the same 151 real documents.
 *
 * The baseline was measured BEFORE the prompt changed (date-swap rule, payslip
 * rule, payment_proof, vendorTaxId). The question this answers is not "is the new
 * run good" but "did anything get WORSE" — a prompt edit that fixes two documents
 * and quietly breaks ten is a bad trade, and only a same-corpus comparison shows it.
 */
const fs = require('fs');

const before = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const after = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

const byFile = (rows) => new Map(rows.map((r) => [r.file, r]));
const A = byFile(before);
const B = byFile(after);

const usable = (r) => !!r?.fields && r.fields.documentType !== 'other' && r.fields.confidence >= 0.3;
const sent = (r) => r?.gate === 'accepted';

const shared = [...A.keys()].filter((f) => B.has(f));
console.log(`baseline ${before.length} docs | rerun ${after.length} docs | comparable ${shared.length}\n`);

const count = (rows, fn) => rows.filter(fn).length;
const beforeSent = shared.map((f) => A.get(f)).filter(sent);
const afterSent = shared.map((f) => B.get(f)).filter(sent);

const row = (label, b, a) => {
  const delta = a - b;
  const mark = delta === 0 ? '' : delta > 0 ? `  (+${delta})` : `  (${delta})`;
  console.log(`${label.padEnd(30)} ${String(b).padStart(4)} -> ${String(a).padStart(4)}${mark}`);
};

console.log('=== headline ===');
row('usable reads', count(beforeSent, usable), count(afterSent, usable));
row('errors', count(beforeSent, (r) => !!r.error), count(afterSent, (r) => !!r.error));
row('amount present (usable)',
  count(beforeSent.filter(usable), (r) => r.fields.amount != null),
  count(afterSent.filter(usable), (r) => r.fields.amount != null));
row('vendorName present (usable)',
  count(beforeSent.filter(usable), (r) => !!r.fields.vendorName),
  count(afterSent.filter(usable), (r) => !!r.fields.vendorName));
row('vendorTaxId present (new)',
  count(beforeSent, (r) => !!r.fields?.vendorTaxId),
  count(afterSent, (r) => !!r.fields?.vendorTaxId));

console.log('\n=== documentType distribution ===');
const types = ['bill', 'receipt', 'payment_proof', 'other'];
for (const type of types) {
  row(type, count(beforeSent, (r) => r.fields?.documentType === type),
    count(afterSent, (r) => r.fields?.documentType === type));
}

console.log('\n=== date sanity vs the email that carried the document ===');
const dateFlag = (r) => {
  if (!r?.fields?.billDate || !r.received) return null;
  const days = (new Date(r.received) - new Date(`${r.fields.billDate}T00:00:00Z`)) / 86_400_000;
  return days < -2 ? 'after_email' : null;
};
row('dated AFTER its own email', count(beforeSent, (r) => dateFlag(r) === 'after_email'),
  count(afterSent, (r) => dateFlag(r) === 'after_email'));
row('billDate missing (usable)',
  count(beforeSent.filter(usable), (r) => !r.fields.billDate),
  count(afterSent.filter(usable), (r) => !r.fields.billDate));

console.log('\n=== currency ===');
const foreign = (r) => !!r?.fields?.currency && !/^(usd|us\$|\$)$/i.test(r.fields.currency.trim());
row('non-USD detected', count(beforeSent, foreign), count(afterSent, foreign));

console.log('\n=== REGRESSIONS: was usable, now is not ===');
let regressions = 0;
for (const file of shared) {
  const b = A.get(file);
  const a = B.get(file);
  if (usable(b) && !usable(a)) {
    regressions += 1;
    console.log(`  ${file.split('/').pop().slice(0, 52).padEnd(54)} ` +
      `${b.fields.documentType}/${b.fields.confidence} -> ${a.fields?.documentType ?? 'ERR'}/${a.fields?.confidence ?? '-'}` +
      `${a.error ? ` (${a.error.slice(0, 40)})` : ''}`);
  }
}
if (!regressions) console.log('  none');

console.log('\n=== IMPROVEMENTS: was not usable, now is ===');
let gains = 0;
for (const file of shared) {
  if (!usable(A.get(file)) && usable(B.get(file))) {
    gains += 1;
    const a = B.get(file);
    console.log(`  ${file.split('/').pop().slice(0, 52).padEnd(54)} -> ${a.fields.documentType}/${a.fields.confidence}`);
  }
}
if (!gains) console.log('  none');

console.log('\n=== amount CHANGED on a document usable in both runs ===');
let moved = 0;
for (const file of shared) {
  const b = A.get(file);
  const a = B.get(file);
  if (usable(b) && usable(a) && b.fields.amount !== a.fields.amount) {
    moved += 1;
    console.log(`  ${file.split('/').pop().slice(0, 52).padEnd(54)} ${b.fields.amount} -> ${a.fields.amount}`);
  }
}
if (!moved) console.log('  none — the money read the same both times');

console.log('\n=== billDate CHANGED ===');
let dates = 0;
for (const file of shared) {
  const b = A.get(file);
  const a = B.get(file);
  if (usable(b) && usable(a) && b.fields.billDate !== a.fields.billDate) {
    dates += 1;
    console.log(`  ${file.split('/').pop().slice(0, 52).padEnd(54)} ${b.fields.billDate} -> ${a.fields.billDate}`);
  }
}
if (!dates) console.log('  none');
