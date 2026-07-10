/**
 * Deploy firestore.rules and storage.rules to production via the Firebase Admin SDK.
 *
 * Used by CI (and works locally). The firebase-tools CLI path needs
 * serviceusage + firebaserules IAM roles the hosting service account lacks;
 * the Admin SDK securityRules API works with the firebase-adminsdk SA.
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS=<path to SA json>, or pass the
 * JSON itself in FIREBASE_ADMINSDK_JSON (as in CI secrets).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const credential = process.env.FIREBASE_ADMINSDK_JSON
  ? admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMINSDK_JSON))
  : admin.credential.applicationDefault();

admin.initializeApp({ credential });

const firestoreSource = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "onit-hr-payroll.firebasestorage.app";

let failed = false;

try {
  const ruleset = await admin.securityRules().releaseFirestoreRulesetFromSource(firestoreSource);
  console.log(`Firestore rules deployed — ruleset ${ruleset.name} (${ruleset.createTime})`);
} catch (err) {
  console.error("Firestore rules deploy FAILED:", err.message);
  failed = true;
}

try {
  const ruleset = await admin
    .securityRules()
    .releaseStorageRulesetFromSource(storageSource, storageBucket);
  console.log(`Storage rules deployed to ${storageBucket} — ruleset ${ruleset.name} (${ruleset.createTime})`);
} catch (err) {
  console.error("Storage rules deploy FAILED:", err.message);
  failed = true;
}

if (failed) {
  process.exit(1);
}
