/**
 * Firebase offline mode utilities
 * Note: Auto-initialization disabled to prevent conflicts with multi-tenant system
 */

import { enableFirebaseOfflineMode } from './firebaseOfflineMode';

console.log('🔧 Firebase offline mode utilities loaded (auto-init disabled)');

// Auto-initialization disabled - the multi-tenant system needs Firebase to work
// for authentication and data operations. Offline mode can be enabled manually
// if needed through the test component or when assertion errors are detected.

// Export for explicit imports if needed
export { enableFirebaseOfflineMode };
