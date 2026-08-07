/**
 * Backfill `setupProgress.companyDetails` for tenants whose company details are
 * already complete.
 *
 * WHY THIS EXISTS
 * ---------------
 * `setupProgress.companyDetails` is only ever written as a SIDE EFFECT of
 * saving the Company Details form (settingsService.updateCompanyDetails). It is
 * never recomputed from the record's actual contents. So a tenant created any
 * other way — by a superadmin (functions/src/tenant.ts), by adminService, or by
 * the demo seed — ends up with a fully populated `companyDetails` and the flag
 * still false.
 *
 * That is not cosmetic. client/services/billService.ts reads the flag into
 * `companyDetailsComplete`, and client/lib/tax/bill-withholding.ts throws
 * `IncompleteTLWithholdingSetupError` when it is false. Those tenants therefore
 * cannot use supplier withholding at all, with an error message telling them to
 * complete details they have already completed.
 *
 * WHAT IT DOES
 * ------------
 * Sets `setupProgress.companyDetails = true` ONLY where the record genuinely
 * satisfies what the withholding code needs: a non-empty legalName AND a
 * specific businessType (not blank, not "Other" — bill-withholding rejects
 * "Other" separately and deliberately, so we must not paper over it).
 *
 * It never clears a flag, never touches any other setupProgress key, and never
 * writes to a tenant whose details are actually incomplete.
 *
 * Usage:
 *   node scripts/backfill-setup-progress.mjs --dry-run     # report only (DEFAULT-SAFE)
 *   node scripts/backfill-setup-progress.mjs --apply       # actually write
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
// Writing is opt-IN. A bare invocation reports and changes nothing.
const apply = args.includes('--apply');
const PROJECT_ID = 'onit-hr-payroll';

/** Mirrors the guard in client/lib/tax/bill-withholding.ts. */
const VALID_BUSINESS_TYPES = new Set([
  'SA',
  'Lda',
  'Unipessoal',
  'ENIN',
  'NGO',
  'Government',
]);

function detailsAreComplete(companyDetails) {
  const legalName = String(companyDetails?.legalName || '').trim();
  const businessType = String(companyDetails?.businessType || '').trim();
  // "Other" is intentionally excluded: bill-withholding refuses it separately
  // because it cannot determine who must withhold. Flipping the flag would
  // swap a clear message for a confusing one.
  return Boolean(legalName) && VALID_BUSINESS_TYPES.has(businessType);
}

async function getCredentials() {
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
    'No credentials found. Download a service account key from Firebase Console > ' +
    'Project Settings > Service Accounts, or set GOOGLE_APPLICATION_CREDENTIALS.',
  );
}

async function main() {
  console.log(
    apply
      ? '*** APPLY MODE — this will WRITE to Firestore ***'
      : 'Dry run (default). Pass --apply to write.',
  );

  initializeApp({ credential: await getCredentials(), projectId: PROJECT_ID });
  const db = getFirestore();

  const tenants = await db.collection('tenants').get();
  console.log(`Scanning ${tenants.size} tenants...`);

  let alreadyTrue = 0;
  let wouldFix = 0;
  let skippedIncomplete = 0;
  let noSettings = 0;
  const fixes = [];

  for (const tenantDoc of tenants.docs) {
    const settingsRef = db
      .collection('tenants')
      .doc(tenantDoc.id)
      .collection('settings')
      .doc('config');
    const snap = await settingsRef.get();

    if (!snap.exists) {
      noSettings += 1;
      continue;
    }

    const data = snap.data() || {};
    if (data.setupProgress?.companyDetails === true) {
      alreadyTrue += 1;
      continue;
    }

    if (!detailsAreComplete(data.companyDetails)) {
      skippedIncomplete += 1;
      console.log(
        `  SKIP  ${tenantDoc.id} — details incomplete ` +
        `(legalName=${JSON.stringify(data.companyDetails?.legalName || '')}, ` +
        `businessType=${JSON.stringify(data.companyDetails?.businessType || '')})`,
      );
      continue;
    }

    wouldFix += 1;
    fixes.push({ tenantId: tenantDoc.id, ref: settingsRef });
    console.log(`  FIX   ${tenantDoc.id} — "${data.companyDetails.legalName}"`);
  }

  if (apply && fixes.length > 0) {
    // Merge a single nested key so no other setupProgress flag is disturbed.
    let batch = db.batch();
    let inBatch = 0;
    for (const { ref } of fixes) {
      batch.set(ref, { setupProgress: { companyDetails: true } }, { merge: true });
      inBatch += 1;
      if (inBatch === 400) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    if (inBatch > 0) await batch.commit();
    console.log(`\nWrote ${fixes.length} tenant(s).`);
  }

  console.log('\n--- summary ---');
  console.log(`already correct   : ${alreadyTrue}`);
  console.log(`${apply ? 'fixed' : 'would fix'}         : ${wouldFix}`);
  console.log(`skipped incomplete: ${skippedIncomplete}`);
  console.log(`no settings doc   : ${noSettings}`);
  if (!apply && wouldFix > 0) {
    console.log('\nRe-run with --apply to write these changes.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
