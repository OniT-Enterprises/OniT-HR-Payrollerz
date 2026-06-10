/**
 * Deploy firestore.rules to production via the Firebase Admin SDK.
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

const source = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

try {
  const ruleset = await admin.securityRules().releaseFirestoreRulesetFromSource(source);
  console.log(`Firestore rules deployed — ruleset ${ruleset.name} (${ruleset.createTime})`);
} catch (err) {
  console.error("Firestore rules deploy FAILED:", err.message);
  process.exit(1);
}
