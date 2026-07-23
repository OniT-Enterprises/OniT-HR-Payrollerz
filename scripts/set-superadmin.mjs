/**
 * Grant (or revoke) superadmin for a user by email.
 *
 * Sets `isSuperAdmin` on the users/{uid} Firestore doc — which the deployed
 * `syncSuperadminClaims` function mirrors into the `superadmin` custom claim
 * and writes to the admin audit log — and ALSO sets the custom claim directly
 * so it takes effect immediately (no wait on the trigger).
 *
 * Usage:
 *   node scripts/set-superadmin.mjs <email>            # grant
 *   node scripts/set-superadmin.mjs <email> --revoke   # revoke
 *   node scripts/set-superadmin.mjs <email> --project=<projectId>
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { existsSync, readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const args = process.argv.slice(2);
const readArgValue = (flag) => {
  const entry = args.find((a) => a.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1).trim() || null : null;
};

const email = args.find((a) => !a.startsWith("--"));
const revoke = args.includes("--revoke");
const projectId = readArgValue("--project") || "onit-hr-payroll";
const target = !revoke;

if (!email) {
  console.error("Usage: node scripts/set-superadmin.mjs <email> [--revoke]");
  process.exit(1);
}

async function getCredentials() {
  const possiblePaths = [
    join(process.cwd(), "service-account.json"),
    join(process.cwd(), "serviceAccountKey.json"),
    join(process.cwd(), "server", "xefe-api", "serviceAccountKey.json"),
    join(homedir(), ".config", "firebase", `${projectId}-firebase-adminsdk.json`),
  ];
  try {
    const key = readdirSync(process.cwd()).find(
      (n) => n.startsWith(`${projectId}-firebase-adminsdk-`) && n.endsWith(".json"),
    );
    if (key) possiblePaths.unshift(join(process.cwd(), key));
  } catch {
    /* ignore */
  }
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      console.log(`Using service account from: ${p}`);
      return cert(JSON.parse(readFileSync(p, "utf8")));
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")));
  }
  throw new Error("No service-account credentials found.");
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: await getCredentials(), projectId });
  }
  const auth = getAuth();
  const db = getFirestore();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === "auth/user-not-found") {
      console.error(
        `\n✗ No account exists for ${email}.\n` +
          `  They must sign in at least once first (then re-run this), or be invited.\n`,
      );
      process.exit(2);
    }
    throw err;
  }

  console.log(
    `\nFound user:\n  uid:        ${user.uid}\n  email:      ${user.email}\n  name:       ${user.displayName || "(none)"}\n  providers:  ${user.providerData.map((p) => p.providerId).join(", ") || "(none)"}\n  current superadmin claim: ${user.customClaims?.superadmin === true}\n`,
  );

  // 1) Firestore field — primary mechanism (triggers sync fn + audit log).
  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();
  await userRef.set(
    {
      uid: user.uid,
      email: user.email,
      isSuperAdmin: target,
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { displayName: user.displayName || null, createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  console.log(`✓ users/${user.uid}.isSuperAdmin = ${target}`);

  // 2) Custom claim directly — immediate effect (preserve other claims).
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    superadmin: target,
  });
  console.log(`✓ custom claim superadmin = ${target}`);

  // 3) On grant, mark the system bootstrapped so bootstrapFirstAdmin (the
  //    self-serve superadmin path) can never run — this script IS the
  //    provisioning path, so the sentinel must exist once a superadmin does.
  if (target) {
    const bootstrapRef = db.doc("_bootstrap/initialized");
    if (!(await bootstrapRef.get()).exists) {
      await bootstrapRef.set({
        initializedAt: FieldValue.serverTimestamp(),
        initializedBy: user.uid,
        initializedEmail: user.email,
        source: "set-superadmin.mjs",
      });
      console.log("✓ _bootstrap/initialized created (bootstrapFirstAdmin now disabled)");
    }
  }

  console.log(
    `\n${target ? "Granted" : "Revoked"} superadmin for ${user.email}.\n` +
      `They must sign out and back in (or refresh their token) for the claim to apply.\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
