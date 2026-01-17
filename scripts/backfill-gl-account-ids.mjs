/**
 * Backfill General Ledger rows to use account document IDs instead of account codes.
 *
 * Usage:
 *   npm run backfill:gl-ids -- --dry-run     # Dry run against production
 *   npm run backfill:gl-ids                  # Apply updates to production
 *
 * Uses Firebase CLI credentials via firebase-tools Node.js API.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const PROJECT_ID = 'onit-hr-payroll';

async function getCredentials() {
  // Try to find a service account key in common locations
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

  // Fallback: use Google Cloud's ADC if available (via GOOGLE_APPLICATION_CREDENTIALS)
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
  console.log(`Starting backfill (dryRun=${dryRun}) for production Firestore...`);
  console.log('');
  console.log('Note: This script requires a service account key.');
  console.log('Download from: https://console.firebase.google.com/project/onit-hr-payroll/settings/serviceaccounts/adminsdk');
  console.log('');

  let credential;
  try {
    credential = await getCredentials();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  initializeApp({
    credential,
    projectId: PROJECT_ID,
  });

  const db = getFirestore();

  const accountsSnap = await db.collection('accounts').get();
  const codeToId = new Map();
  accountsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.code) codeToId.set(data.code, doc.id);
  });
  console.log(`Loaded ${codeToId.size} accounts`);

  const glSnap = await db.collection('generalLedger').get();
  console.log(`Scanning ${glSnap.size} generalLedger rows...`);

  let fixCount = 0;
  let missingCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of glSnap.docs) {
    const data = doc.data();
    const accountCode = data.accountCode;
    const accountId = data.accountId;

    if (!accountCode) {
      missingCount++;
      continue;
    }
    const desiredId = codeToId.get(accountCode);
    if (!desiredId) {
      missingCount++;
      continue;
    }

    if (accountId !== desiredId) {
      fixCount++;
      if (!dryRun) {
        batch.update(doc.ref, { accountId: desiredId });
        batchCount++;
        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log(
    `Done. ${dryRun ? 'Would fix' : 'Fixed'} ${fixCount} rows. Missing account match for ${missingCount} rows.`
  );
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
