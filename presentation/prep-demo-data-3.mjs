/**
 * Presentation prep, phase 4 — make the demo tenant COMPLIANT and BANKABLE:
 *   · every employee gets an INSS number + work-contract file (clears the
 *     "2 issues" flags and the wizard's compliance gate)
 *   · every employee gets BNU bank details, and the company gets a payroll
 *     bank account (the Bank Files dialog stops warning and counts employees)
 * Admin SDK, demo tenant only, idempotent.
 *
 *   node prep-demo-data-3.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const T = 'demo-kafe-aroma';

async function run() {
  console.log(`\nPhase-4 prep for ${T}…\n`);

  // 1. Employee compliance + bank details
  const employees = await db.collection(`tenants/${T}/employees`).get();
  let i = 0;
  for (const doc of employees.docs) {
    i++;
    const acct = `28${String(6400 + i * 7)}.10.00${i}`;
    await doc.ref.set({
      documents: {
        socialSecurityNumber: {
          number: `9000123${String(40 + i)}`,
          expiryDate: '',
          required: true,
        },
        workContract: {
          fileUrl: 'https://xefe.tl/demo/kontratu-servisu.pdf',
          uploadDate: '2026-01-15',
        },
      },
      bankName: 'BNU (Banco Nacional Ultramarino)',
      bankAccountNumber: acct,
      bankDetails: {
        accountNumber: acct,
        bankName: 'BNU (Banco Nacional Ultramarino)',
        branch: 'Dili',
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log(`  ✓ ${i} employees: INSS number + contract + BNU account`);

  // 2. Company payroll bank account
  await db.doc(`tenants/${T}/settings/config`).set({
    paymentStructure: {
      bankAccounts: [
        {
          id: 'acct-payroll-bnu',
          purpose: 'payroll',
          bankName: 'BNU (Banco Nacional Ultramarino)',
          accountName: 'Kafé Aroma Dili, Lda',
          accountNumber: '286123.10.001',
          branchCode: 'Dili',
          isActive: true,
        },
      ],
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ company payroll bank account (BNU)');

  console.log('\n✅ Phase-4 demo data ready.\n');
  process.exit(0);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
