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
 * Mirror of `leavePayFraction` (functions/src/timeleave.ts), because only the
 * engine's own rule tells you whether a stored policy actually pays.
 *
 * Two traps, both of which this script got wrong on its first run against
 * production — it named four healthy tenants as underpaying:
 *
 * 1. A MISSING slot is not a zero. `leavePayFraction` looks the policy up by
 *    its `id` FIELD, so a config written before a slot existed — or one holding
 *    only `daysPerYear` — is simply not found and falls through to the
 *    defaults, which pay annual/special/study in full.
 * 2. A percentage is not a payment. `if (configured.isPaid !== true) return 0`,
 *    so a stored 100% with isPaid false pays NOTHING. That is the real defect
 *    shape and the one worth hunting.
 */
const findConfigured = (policies, id) =>
  [
    policies.annualLeave,
    policies.sickLeave,
    policies.maternityLeave,
    policies.paternityLeave,
    policies.miscarriageLeave,
    policies.specialLeave,
    policies.unpaidLeave,
    policies.studyLeave,
    ...(Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : []),
  ].find((policy) => policy && policy.id === id);

/** null = not configured at all, so the engine's default applies and it is fine. */
const effectivePercent = (policies, id) => {
  const configured = findConfigured(policies, id);
  if (!configured) return null;
  if (configured.isPaid !== true) return 0;
  const pct = Number(configured.paidPercentage ?? 100);
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 100;
};

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

  // Art. 33(3) — pooled special leave is paid in full. `null` means the slot is
  // absent, so the engine's paid default applies: not a finding.
  const special = effectivePercent(policies, "special");
  if (special !== null && special !== 100) {
    findings.specialNotFullyPaid.push(`${label} — pays ${special}%`);
  }

  // Art. 76(3) — "sem perda da remuneração".
  const study = effectivePercent(policies, "study");
  if (study !== null && study !== 100) {
    findings.studyNotFullyPaid.push(`${label} — pays ${study}%`);
  }

  // Art. 33(4) — "mediante a apresentação de atestado médico".
  if (policies.sickLeave && policies.sickLeave.requiresCertificate === false) {
    findings.sickCertificateOff.push(label);
  }

  // The silent one: a policy the engine WILL find (it has an id) whose
  // percentage looks generous but pays nothing because isPaid is not true.
  for (const [slot, leave] of Object.entries(policies)) {
    if (!leave || typeof leave !== "object" || Array.isArray(leave)) continue;
    if (leave.id === undefined) continue; // not found by the engine; default applies
    if (Number(leave.paidPercentage ?? 0) > 0 && leave.isPaid !== true) {
      findings.paidPercentWithoutIsPaid.push(
        `${label} — ${slot}: ${leave.paidPercentage}% but isPaid=${JSON.stringify(leave.isPaid)}, so pays 0`,
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
  "\nNothing was written. A slot that is ABSENT is not counted: the engine " +
    "looks policies up by their `id` field, so an absent or partial slot falls " +
    "through to the defaults, which pay annual/special/study in full.\n",
);
process.exit(0);
