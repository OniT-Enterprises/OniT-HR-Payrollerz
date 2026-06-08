/**
 * Normalize employee.jobDetails.employmentType to the canonical values used by
 * the Add Employee form and the Employee report: "Full-time" | "Part-time" | "Contractor".
 *
 * Fixes legacy/seed inconsistencies ("full-time", "Full-time", "full_time", "Permanent")
 * that caused the same employment type to appear as duplicate rows in reports.
 * Non-destructive: only rewrites the single field, only when it actually differs,
 * and skips employees that have no employmentType set.
 *
 * Usage:
 *   npm run backfill:employment-type -- --dry-run
 *   npm run backfill:employment-type
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const PROJECT_ID = 'onit-hr-payroll';

// Mirror of AddEmployee's normalizeEmploymentType (separator/case-insensitive),
// plus "permanent" (written by the "convert to permanent" action) -> Full-time.
function canonicalEmploymentType(raw) {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const map = {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    contractor: 'Contractor',
    contract: 'Contractor',
    permanent: 'Full-time',
  };
  return map[key] || 'Full-time';
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
    'No credentials found. Please either:\n' +
    '1. Download a service account key from Firebase Console > Project Settings > Service Accounts\n' +
    '2. Save it as service-account.json in this directory\n' +
    '3. Or set GOOGLE_APPLICATION_CREDENTIALS environment variable'
  );
}

async function main() {
  console.log(`Starting employmentType normalization backfill (dryRun=${dryRun})...`);
  console.log('');

  let credential;
  try {
    credential = await getCredentials();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  initializeApp({ credential, projectId: PROJECT_ID });
  const db = getFirestore();
  const snapshot = await db.collectionGroup('employees').get();
  console.log(`Scanning ${snapshot.size} employee documents...`);
  console.log('');

  let scanned = 0;
  let changed = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;
  const distribution = {};

  for (const doc of snapshot.docs) {
    scanned += 1;
    const raw = doc.data()?.jobDetails?.employmentType;

    if (raw == null || String(raw).trim() === '') {
      skipped += 1;
      continue;
    }

    const next = canonicalEmploymentType(raw);
    distribution[next] = (distribution[next] || 0) + 1;

    if (next === raw) continue;

    changed += 1;
    console.log(`  ${doc.ref.path}: "${raw}" -> "${next}"`);

    if (!dryRun) {
      batch.update(doc.ref, { 'jobDetails.employmentType': next });
      batchCount += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log('');
  console.log(`Scanned: ${scanned} · Normalized: ${changed} · Skipped (no value): ${skipped}`);
  console.log('Resulting distribution:', distribution);
  if (dryRun) {
    console.log('');
    console.log('Dry run — no writes performed. Re-run without --dry-run to apply.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
