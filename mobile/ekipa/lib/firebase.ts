/**
 * Firebase configuration for Ekipa — bootstrapped by the shared
 * @xefe/mobile init (same onit-hr-payroll project as Meza web and Kaixa;
 * AsyncStorage auth persistence, memory-only Firestore cache).
 */
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { initXefeFirebase } from '@xefe/mobile';

const { app, auth, db } = initXefeFirebase();

export { auth, db };
export const functions = getFunctions(app);

// Storage for attendance photos
export const storage: FirebaseStorage = getStorage(app);

export default app;
