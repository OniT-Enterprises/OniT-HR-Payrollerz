/**
 * Backfill employee compliance snapshots used by dashboard aggregate queries.
 *
 * Usage:
 *   npm run backfill:employee-compliance -- --dry-run
 *   npm run backfill:employee-compliance
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const PROJECT_ID = 'onit-hr-payroll';

function buildEmployeeComplianceSnapshot(employee) {
  const hasValue = (value) => Boolean(String(value || '').trim());
  const missingInss = !hasValue(employee?.documents?.socialSecurityNumber?.number);
  const missingContract = !hasValue(employee?.documents?.workContract?.fileUrl);
  const missingDepartment = !hasValue(employee?.jobDetails?.department);
  const blockingIssueCount = Number(missingInss) + Number(missingContract);
  const issueCount = blockingIssueCount + Number(missingDepartment);

  return {
    missingInss,
    missingContract,
    missingDepartment,
    issueCount,
    blockingIssueCount,
    hasIssues: issueCount > 0,
    hasBlockingIssue: blockingIssueCount > 0,
  };
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
  console.log(`Starting employee compliance backfill (dryRun=${dryRun})...`);
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
  const snapshot = await db.collectionGroup('employees').get();

  console.log(`Scanning ${snapshot.size} employee documents...`);

  let scanned = 0;
  let changed = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    const nextCompliance = buildEmployeeComplianceSnapshot(data);
    const currentCompliance = data.compliance || {};

    const hasChanged = JSON.stringify(currentCompliance) !== JSON.stringify(nextCompliance);
    if (!hasChanged) {
      continue;
    }

    changed += 1;

    if (!dryRun) {
      batch.update(doc.ref, { compliance: nextCompliance });
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

  console.log(`Done. Scanned ${scanned} employees. ${dryRun ? 'Would update' : 'Updated'} ${changed} compliance snapshots.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
