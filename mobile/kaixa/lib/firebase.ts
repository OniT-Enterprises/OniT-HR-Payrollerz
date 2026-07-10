/**
 * Firebase configuration for Kaixa — bootstrapped by the shared
 * @xefe/mobile init (same onit-hr-payroll project as Meza web and Ekipa;
 * AsyncStorage auth persistence, memory-only Firestore cache).
 */
import { getFunctions } from 'firebase/functions';
import { initXefeFirebase } from '@xefe/mobile';

const { app, auth, db } = initXefeFirebase();

export { auth, db };
export const functions = getFunctions(app);
export default app;
