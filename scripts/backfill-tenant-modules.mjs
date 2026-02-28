/**
 * Backfill tenant member modules for finance access.
 *
 * Adds missing `money` + `accounting` modules for owner and hr-admin members.
 * If owner/hr-admin has no modules (missing/empty/invalid), assigns full defaults.
 *
 * Usage:
 *   npm run backfill:tenant-modules -- --dry-run
 *   npm run backfill:tenant-modules -- --tenant=<tenantId>
 *   npm run backfill:tenant-modules -- --project=<projectId>
 *   npm run backfill:tenant-modules
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);

const readArgValue = (flag) => {
  const entry = args.find((arg) => arg.startsWith(`${flag}=`));
  if (!entry) return null;
  const value = entry.slice(flag.length + 1).trim();
  return value || null;
};

const dryRun = args.includes('--dry-run');
const tenantIdFilter = readArgValue('--tenant');
const projectId = readArgValue('--project') || 'onit-hr-payroll';

const REQUIRED_FINANCE_MODULES = ['money', 'accounting'];
const TARGET_ROLES = new Set(['owner', 'hr-admin']);
const DEFAULT_MODULES_BY_ROLE = {
  owner: ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'],
  'hr-admin': ['hiring', 'staff', 'timeleave', 'performance', 'payroll', 'money', 'accounting', 'reports'],
};

function normalizeModules(rawModules) {
  if (!Array.isArray(rawModules)) {
    return [];
  }

  const normalized = [];
  for (const moduleName of rawModules) {
    if (typeof moduleName !== 'string') {
      continue;
    }
    const trimmed = moduleName.trim();
    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }
    normalized.push(trimmed);
  }

  return normalized;
}

function sameStringArray(rawModules, targetModules) {
  if (!Array.isArray(rawModules) || rawModules.length !== targetModules.length) {
    return false;
  }

  return rawModules.every(
    (moduleName, index) => typeof moduleName === 'string' && moduleName === targetModules[index],
  );
}

function buildTargetModules(role, currentModules) {
  if (!TARGET_ROLES.has(role)) {
    return currentModules;
  }

  if (currentModules.length === 0) {
    return [...DEFAULT_MODULES_BY_ROLE[role]];
  }

  const nextModules = [...currentModules];
  for (const requiredModule of REQUIRED_FINANCE_MODULES) {
    if (!nextModules.includes(requiredModule)) {
      nextModules.push(requiredModule);
    }
  }

  return nextModules;
}

async function getCredentials() {
  const possiblePaths = [
    join(process.cwd(), 'service-account.json'),
    join(process.cwd(), 'serviceAccountKey.json'),
    join(homedir(), '.config', 'firebase', `${projectId}-firebase-adminsdk.json`),
  ];

  try {
    const cwdFiles = readdirSync(process.cwd());
    const firebaseSdkKey = cwdFiles.find(
      (name) => name.startsWith(`${projectId}-firebase-adminsdk-`) && name.endsWith('.json'),
    );
    if (firebaseSdkKey) {
      possiblePaths.unshift(join(process.cwd(), firebaseSdkKey));
    }
  } catch (_error) {
    // Ignore and continue with default lookup paths.
  }

  for (const filePath of possiblePaths) {
    if (existsSync(filePath)) {
      console.log(`Using service account from: ${filePath}`);
      return cert(JSON.parse(readFileSync(filePath, 'utf8')));
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (existsSync(credentialsPath)) {
      console.log(`Using GOOGLE_APPLICATION_CREDENTIALS: ${credentialsPath}`);
      return cert(JSON.parse(readFileSync(credentialsPath, 'utf8')));
    }
  }

  throw new Error(
    'No credentials found. Provide service-account JSON in project root or set GOOGLE_APPLICATION_CREDENTIALS.',
  );
}

async function main() {
  console.log(`Starting tenant module backfill (dryRun=${dryRun})`);
  console.log(`Project: ${projectId}`);
  if (tenantIdFilter) {
    console.log(`Tenant filter: ${tenantIdFilter}`);
  }
  console.log('');

  const credential = await getCredentials();

  if (!getApps().length) {
    initializeApp({
      credential,
      projectId,
    });
  }

  const db = getFirestore();

  const tenantDocs = [];
  if (tenantIdFilter) {
    const tenantDoc = await db.collection('tenants').doc(tenantIdFilter).get();
    if (!tenantDoc.exists) {
      throw new Error(`Tenant not found: ${tenantIdFilter}`);
    }
    tenantDocs.push(tenantDoc);
  } else {
    const tenantsSnapshot = await db.collection('tenants').get();
    tenantDocs.push(...tenantsSnapshot.docs);
  }

  console.log(`Scanning ${tenantDocs.length} tenant(s)...`);

  let scannedMembers = 0;
  let updatedMembers = 0;
  let untouchedMembers = 0;
  let skippedNonTargetRole = 0;
  let defaultedMissingModules = 0;

  const sampleUpdates = [];
  const sampleLimit = 20;

  const BATCH_LIMIT = 400;
  let batch = db.batch();
  let batchCount = 0;
  let committedWrites = 0;

  const commitBatch = async () => {
    if (batchCount === 0 || dryRun) {
      return;
    }
    await batch.commit();
    committedWrites += batchCount;
    batch = db.batch();
    batchCount = 0;
  };

  for (const tenantDoc of tenantDocs) {
    const tenantId = tenantDoc.id;
    const membersSnapshot = await tenantDoc.ref.collection('members').get();

    for (const memberDoc of membersSnapshot.docs) {
      scannedMembers++;

      const member = memberDoc.data();
      const role = typeof member.role === 'string' ? member.role : '';
      if (!TARGET_ROLES.has(role)) {
        skippedNonTargetRole++;
        continue;
      }

      const currentModules = normalizeModules(member.modules);
      const nextModules = buildTargetModules(role, currentModules);
      const shouldUseDefaults = currentModules.length === 0;
      const needsUpdate = !sameStringArray(member.modules, nextModules);

      if (!needsUpdate) {
        untouchedMembers++;
        continue;
      }

      if (shouldUseDefaults) {
        defaultedMissingModules++;
      }

      updatedMembers++;

      if (sampleUpdates.length < sampleLimit) {
        sampleUpdates.push({
          path: memberDoc.ref.path,
          role,
          before: currentModules,
          after: nextModules,
        });
      }

      if (!dryRun) {
        batch.set(
          memberDoc.ref,
          {
            modules: nextModules,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        batchCount++;

        if (batchCount >= BATCH_LIMIT) {
          await commitBatch();
        }
      }
    }

    console.log(`- ${tenantId}: scanned ${membersSnapshot.size} member(s)`);
  }

  await commitBatch();

  console.log('');
  console.log('Summary');
  console.log('-------');
  console.log(`Members scanned: ${scannedMembers}`);
  console.log(`Members updated: ${updatedMembers}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Members unchanged: ${untouchedMembers}`);
  console.log(`Members skipped (non owner/hr-admin): ${skippedNonTargetRole}`);
  console.log(`Updated by defaulting empty/missing modules: ${defaultedMissingModules}`);
  if (!dryRun) {
    console.log(`Writes committed: ${committedWrites}`);
  }

  if (sampleUpdates.length > 0) {
    console.log('');
    console.log(`Sample updates (first ${sampleUpdates.length})`);
    console.log('--------------------------------');
    for (const sample of sampleUpdates) {
      console.log(`${sample.path}`);
      console.log(`  role:   ${sample.role}`);
      console.log(`  before: [${sample.before.join(', ')}]`);
      console.log(`  after:  [${sample.after.join(', ')}]`);
    }
  }

  if (dryRun) {
    console.log('');
    console.log('Dry run complete. Re-run without --dry-run to apply changes.');
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error.message || error);
  process.exit(1);
});
