/**
 * READ-ONLY audit: tenants carrying leave-policy values the UI no longer lets
 * them set.
 *
 * Three settings became read-only or statutory on 2026-08-07 (PRs #35, #39),
 * each with a one-tap repair in Settings — but the repair only reaches a tenant
 * who opens that row. This says how many are affected, so the choice between
 * "leave the repair buttons to do their job" and "migrate" is made on numbers.
 *
 * WRITES NOTHING. Run it before deciding anything:
 *
 *   node scripts/audit-leave-policy-drift.mjs            # summary
 *   node scripts/audit-leave-policy-drift.mjs --verbose  # name every tenant
 *
 * Needs the same Admin credentials as the other scripts here
 * (GOOGLE_APPLICATION_CREDENTIALS, or a serviceAccountKey.json beside them).
 */
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const verbose = process.argv.includes("--verbose");

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

/**
 * What payroll will actually pay for a leave type.
 *
 * `leavePayFraction` (functions/src/timeleave.ts) requires `isPaid === true`,
 * so a stored 100% with isPaid false pays NOTHING. Auditing the percentage
 * alone would miss that, and it is the worse of the two states.
 */
const effectivePercent = (leave) =>
  leave && leave.isPaid ? Number(leave.paidPercentage ?? 0) : 0;

const findings = {
  specialNotFullyPaid: [],
  studyNotFullyPaid: [],
  sickCertificateOff: [],
  paidPercentWithoutIsPaid: [],
};

const tenants = await db.collection("tenants").get();
let checked = 0;

for (const tenant of tenants.docs) {
  const config = await db
    .collection("tenants")
    .doc(tenant.id)
    .collection("settings")
    .doc("config")
    .get();
  if (!config.exists) continue;

  const policies = config.data()?.timeOffPolicies;
  if (!policies) continue;
  checked += 1;

  const name = tenant.data()?.name || tenant.id;
  const label = `${name} (${tenant.id})`;

  // Art. 33(3) — pooled special leave is paid in full.
  if (effectivePercent(policies.specialLeave) !== 100) {
    findings.specialNotFullyPaid.push(
      `${label} — effective ${effectivePercent(policies.specialLeave)}%`,
    );
  }

  // Art. 76(3) — "sem perda da remuneração".
  if (effectivePercent(policies.studyLeave) !== 100) {
    findings.studyNotFullyPaid.push(
      `${label} — effective ${effectivePercent(policies.studyLeave)}%`,
    );
  }

  // Art. 33(4) — "mediante a apresentação de atestado médico".
  if (policies.sickLeave && policies.sickLeave.requiresCertificate === false) {
    findings.sickCertificateOff.push(label);
  }

  // The silent one: a positive percentage that pays nothing.
  for (const [slot, leave] of Object.entries(policies)) {
    if (!leave || typeof leave !== "object") continue;
    if (Number(leave.paidPercentage ?? 0) > 0 && leave.isPaid === false) {
      findings.paidPercentWithoutIsPaid.push(
        `${label} — ${slot}: ${leave.paidPercentage}% but isPaid:false, so pays 0`,
      );
    }
  }
}

const report = [
  ["Special leave not paid in full (Art. 33(3))", "specialNotFullyPaid"],
  ["Study leave not paid in full (Art. 76(3))", "studyNotFullyPaid"],
  ["Sick certificate turned off (Art. 33(4))", "sickCertificateOff"],
  ["Percentage > 0 with isPaid:false — PAYS NOTHING", "paidPercentWithoutIsPaid"],
];

console.log(`\nTenants with a timeOffPolicies config: ${checked}\n`);
for (const [title, key] of report) {
  const rows = findings[key];
  console.log(`${title}: ${rows.length}`);
  if (verbose) rows.forEach((row) => console.log(`   ${row}`));
}
console.log(
  "\nNothing was written. If these counts are small, the in-app repair " +
    "buttons are enough; if they are not, they justify a migration.\n",
);
process.exit(0);
