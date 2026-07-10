/**
 * Split legacy invoice journals into net revenue + sales tax payable.
 *
 * Before Jul 2026, createFromInvoice credited the FULL invoice total to
 * Service Revenue (4100). New postings credit net revenue to 4100 and the tax
 * portion to Sales Tax Payable (2310). Without this backfill, GL-based P&L
 * revenue is overstated by the tax amount for old invoices, and the 2310
 * liability is missing.
 *
 * For every posted journal with source == 'invoice' whose invoice has
 * taxAmount > 0 and no 2310 line yet, this script:
 *   1. reduces the 4100 credit line by taxAmount,
 *   2. adds a 2310 credit line for taxAmount (journal totals are unchanged),
 *   3. applies the same change to the entry's generalLedger rows,
 *   4. deletes the tenant's balanceSnapshots cache (it is rebuilt on demand).
 *
 * Entries in closed/locked fiscal periods are reported and left untouched.
 * Tenants without a 2310 account are reported and skipped (seed it first).
 *
 * Usage:
 *   node scripts/backfill-invoice-tax-split.mjs                 # dry run (default)
 *   node scripts/backfill-invoice-tax-split.mjs --apply         # write changes
 *   node scripts/backfill-invoice-tax-split.mjs --tenant=<tid>  # one tenant only
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const tenantFilter = args.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length) || null;
const PROJECT_ID = 'onit-hr-payroll';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function getCredentials() {
  const possiblePaths = [
    join(process.cwd(), 'service-account.json'),
    join(process.cwd(), 'serviceAccountKey.json'),
    join(homedir(), '.config', 'firebase', `${PROJECT_ID}-firebase-adminsdk.json`),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      console.log(`Using service account from: ${p}`);
      return cert(JSON.parse(readFileSync(p, 'utf8')));
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`Using GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    return cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')));
  }
  throw new Error(
    'No credentials found. Download a service account key from Firebase Console > '
    + 'Project Settings > Service Accounts and save it as service-account.json, '
    + 'or set GOOGLE_APPLICATION_CREDENTIALS.',
  );
}

async function processTenant(db, tenantId, totals) {
  const accountsSnap = await db.collection(`tenants/${tenantId}/accounts`).get();
  if (accountsSnap.empty) return; // no chart of accounts, nothing posted

  let taxAccount = null;
  accountsSnap.forEach((accountDoc) => {
    if (accountDoc.data().code === '2310') {
      taxAccount = { id: accountDoc.id, name: accountDoc.data().name || 'Sales Tax Payable' };
    }
  });

  const entriesSnap = await db
    .collection(`tenants/${tenantId}/journalEntries`)
    .where('source', '==', 'invoice')
    .where('status', '==', 'posted')
    .get();
  if (entriesSnap.empty) return;

  const periodsSnap = await db.collection(`tenants/${tenantId}/fiscalPeriods`).get();
  const periodStatus = new Map();
  periodsSnap.forEach((periodDoc) => {
    const period = periodDoc.data();
    periodStatus.set(`${period.year}-${period.period}`, period.status);
  });

  let tenantChanged = false;

  for (const entryDoc of entriesSnap.docs) {
    const entry = entryDoc.data();
    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    if (lines.some((line) => line.accountCode === '2310')) continue; // already split

    const invoiceSnap = await db.doc(`tenants/${tenantId}/invoices/${entry.sourceId}`).get();
    if (!invoiceSnap.exists) {
      console.warn(`  SKIP ${entryDoc.id}: source invoice ${entry.sourceId} not found`);
      totals.skipped += 1;
      continue;
    }
    const invoice = invoiceSnap.data();
    const taxAmount = round2(Number(invoice.taxAmount) || 0);
    if (taxAmount <= 0) continue; // untaxed invoice, gross == net

    const revenueIdx = lines.findIndex((line) => line.accountCode === '4100' && (line.credit || 0) > 0);
    if (revenueIdx < 0) {
      console.warn(`  SKIP ${entry.entryNumber}: no 4100 credit line`);
      totals.skipped += 1;
      continue;
    }
    const oldCredit = round2(lines[revenueIdx].credit);
    const total = round2(Number(invoice.total) || 0);
    if (Math.abs(oldCredit - total) > 0.005) {
      // Revenue already differs from the gross total — do not guess.
      console.warn(`  SKIP ${entry.entryNumber}: 4100 credit ${oldCredit} != invoice total ${total}`);
      totals.skipped += 1;
      continue;
    }

    const status = periodStatus.get(`${entry.fiscalYear}-${entry.fiscalPeriod}`);
    if (status && status !== 'open') {
      console.warn(`  SKIP ${entry.entryNumber}: fiscal period ${entry.fiscalYear}-${entry.fiscalPeriod} is ${status}`);
      totals.closedPeriod += 1;
      continue;
    }

    if (!taxAccount) {
      console.warn(`  SKIP ${entry.entryNumber}: tenant ${tenantId} has no 2310 account — seed it first`);
      totals.missingTaxAccount += 1;
      continue;
    }

    const netRevenue = round2(total - taxAmount);
    const newLines = lines.map((line, idx) => (
      idx === revenueIdx ? { ...line, credit: netRevenue } : line
    ));
    newLines.push({
      lineNumber: newLines.length + 1,
      accountId: taxAccount.id,
      accountCode: '2310',
      accountName: taxAccount.name,
      debit: 0,
      credit: taxAmount,
      description: `Sales tax payable - ${invoice.invoiceNumber || entry.sourceId}`,
    });

    const glSnap = await db
      .collection(`tenants/${tenantId}/generalLedger`)
      .where('journalEntryId', '==', entryDoc.id)
      .get();
    const revenueGlDoc = glSnap.docs.find((glDoc) => {
      const gl = glDoc.data();
      return gl.accountCode === '4100'
        && !String(gl.entryNumber || '').endsWith('-VOID')
        && Math.abs(round2(gl.credit) - oldCredit) <= 0.005;
    });
    if (!revenueGlDoc) {
      console.warn(`  SKIP ${entry.entryNumber}: matching 4100 GL row not found`);
      totals.skipped += 1;
      continue;
    }

    console.log(
      `  ${apply ? 'FIX ' : 'would fix'} ${tenantId}/${entry.entryNumber}: `
      + `4100 ${oldCredit} -> ${netRevenue}, +2310 ${taxAmount}`,
    );
    totals.fixed += 1;

    if (apply) {
      const batch = db.batch();
      batch.update(entryDoc.ref, { lines: newLines });
      batch.update(revenueGlDoc.ref, { credit: netRevenue });
      batch.set(db.collection(`tenants/${tenantId}/generalLedger`).doc(), {
        accountId: taxAccount.id,
        accountCode: '2310',
        accountName: taxAccount.name,
        journalEntryId: entryDoc.id,
        entryNumber: entry.entryNumber,
        entryDate: entry.date,
        description: `Sales tax payable - ${invoice.invoiceNumber || entry.sourceId}`,
        debit: 0,
        credit: taxAmount,
        balance: 0,
        fiscalYear: entry.fiscalYear,
        fiscalPeriod: entry.fiscalPeriod,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      tenantChanged = true;
    }
  }

  if (apply && tenantChanged) {
    // Cached cumulative balances are now stale; they rebuild on next report.
    const snapshotsSnap = await db.collection(`tenants/${tenantId}/balanceSnapshots`).get();
    for (const snapshotDoc of snapshotsSnap.docs) {
      await snapshotDoc.ref.delete();
    }
    if (!snapshotsSnap.empty) {
      console.log(`  cleared ${snapshotsSnap.size} stale balance snapshot(s) for ${tenantId}`);
    }
  }
}

async function main() {
  console.log(`Invoice tax-split backfill — ${apply ? 'APPLY' : 'DRY RUN (pass --apply to write)'}`);

  initializeApp({ credential: getCredentials(), projectId: PROJECT_ID });
  const db = getFirestore();

  const tenantIds = tenantFilter
    ? [tenantFilter]
    : (await db.collection('tenants').get()).docs.map((tenantDoc) => tenantDoc.id);

  const totals = { fixed: 0, skipped: 0, closedPeriod: 0, missingTaxAccount: 0 };
  for (const tenantId of tenantIds) {
    await processTenant(db, tenantId, totals);
  }

  console.log('');
  console.log(`Done. ${apply ? 'Fixed' : 'Would fix'}: ${totals.fixed}, skipped: ${totals.skipped}, `
    + `closed-period: ${totals.closedPeriod}, missing 2310: ${totals.missingTaxAccount}`);
  if (!apply && totals.fixed > 0) {
    console.log('Re-run with --apply to write these changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
