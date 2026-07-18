// Auth-only screens import firebase-core directly so Firestore is not part of
// the guest/login critical path. Data routes use this compatibility module.
export {
  app,
  auth,
  ensureAppCheckInitialized,
  getFunctionsLazy,
  getStorageLazy,
} from "@/lib/firebase-core";
export { db } from "@/lib/firebase-firestore";
