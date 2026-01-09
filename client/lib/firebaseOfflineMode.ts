/**
 * Firebase Offline Mode Manager
 * Completely disables Firebase real-time operations to prevent internal assertion errors
 */

import { db, auth } from './firebase';
import { disableNetwork, terminate } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface OfflineState {
  isOfflineMode: boolean;
  wasOnline: boolean;
  authListenerActive: boolean;
  networkDisabled: boolean;
  terminated: boolean;
}

class FirebaseOfflineManager {
  private state: OfflineState = {
    isOfflineMode: false,
    wasOnline: false,
    authListenerActive: false,
    networkDisabled: false,
    terminated: false,
  };

  private authUnsubscribe: (() => void) | null = null;
  private cleanupCallbacks: Set<() => void> = new Set();

  /**
   * Enable complete offline mode to prevent watch stream errors
   */
  public async enableOfflineMode(): Promise<void> {
    if (this.state.isOfflineMode) {
      console.log('�� Already in offline mode');
      return;
    }

    console.log('📴 Enabling Firebase offline mode to prevent assertion errors...');

    try {
      // Step 1: Disable authentication state listener if active
      if (this.authUnsubscribe) {
        console.log('🔐 Stopping auth state listener...');
        this.authUnsubscribe();
        this.authUnsubscribe = null;
        this.state.authListenerActive = false;
      }

      // Step 2: Sign out to prevent auth-related watch streams
      if (auth && auth.currentUser) {
        try {
          console.log('👋 Signing out current user...');
          await signOut(auth);
        } catch (signOutError) {
          console.warn('⚠️ Sign out failed (non-critical):', signOutError);
        }
      }

      // Step 3: Disable Firestore network to stop all watch streams
      if (db && !this.state.networkDisabled) {
        try {
          console.log('🌐 Disabling Firestore network...');
          await this.safeDisableNetwork();
          this.state.networkDisabled = true;
        } catch (networkError) {
          console.warn('⚠️ Network disable failed:', networkError);
        }
      }

      // Step 4: Mark as terminated but don't actually terminate to avoid conflicts
      // Terminating the client causes "client already terminated" errors
      // when other parts of the app try to use Firebase
      if (!this.state.terminated) {
        console.log('📴 Marking Firebase as offline (without terminating client)...');
        this.state.terminated = true; // Logical termination only
      }

      this.state.isOfflineMode = true;
      console.log('✅ Firebase offline mode enabled successfully');

    } catch (error) {
      console.error('❌ Failed to enable offline mode:', error);
      throw error;
    }
  }

  /**
   * Safely disable network with error handling
   */
  private async safeDisableNetwork(): Promise<void> {
    try {
      // Use a timeout to prevent hanging
      await Promise.race([
        disableNetwork(db),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network disable timeout')), 5000)
        ),
      ]);
    } catch (error: any) {
      // Ignore assertion errors during shutdown
      if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
        console.warn('🚨 Ignoring assertion error during network disable');
        return;
      }
      throw error;
    }
  }

  /**
   * Check if in offline mode
   */
  public isOffline(): boolean {
    return this.state.isOfflineMode;
  }

  /**
   * Get current offline state
   */
  public getState(): OfflineState {
    return { ...this.state };
  }

  /**
   * Force offline mode without cleanup (emergency)
   */
  public forceOfflineMode(): void {
    console.log('🚨 Force enabling offline mode (emergency)');
    this.state.isOfflineMode = true;
    this.state.networkDisabled = true;
    this.state.terminated = true;
  }

  /**
   * Add cleanup callback for components
   */
  public addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Remove cleanup callback
   */
  public removeCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Execute all cleanup callbacks
   */
  private executeCleanupCallbacks(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Cleanup callback failed:', error);
      }
    });
  }

  /**
   * Complete cleanup and shutdown
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Firebase offline manager...');
    
    try {
      // Execute component cleanup callbacks
      this.executeCleanupCallbacks();
      
      // Enable offline mode if not already
      if (!this.state.isOfflineMode) {
        await this.enableOfflineMode();
      }
      
      // Clear callbacks
      this.cleanupCallbacks.clear();
      
      console.log('✅ Firebase offline manager cleanup complete');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// Create singleton instance
export const firebaseOfflineManager = new FirebaseOfflineManager();

// Convenient export functions
export const enableFirebaseOfflineMode = () => firebaseOfflineManager.enableOfflineMode();
export const isFirebaseOffline = () => firebaseOfflineManager.isOffline();
export const getFirebaseOfflineState = () => firebaseOfflineManager.getState();
export const forceFirebaseOffline = () => firebaseOfflineManager.forceOfflineMode();

// Auto-enable offline mode if assertion errors are detected (disabled by default)
let assertionErrorCount = 0;
const AUTO_OFFLINE_ENABLED = false; // Disabled to prevent conflicts with multi-tenant system

if (AUTO_OFFLINE_ENABLED) {
  const originalConsoleError = console.error;

  console.error = function(...args: any[]) {
    const message = args.join(' ');

    // Detect Firebase internal assertion errors
    if (message.includes('INTERNAL ASSERTION FAILED')) {
      assertionErrorCount++;
      console.warn(`🚨 Detected Firebase assertion error #${assertionErrorCount}`);

      // Auto-enable offline mode after 5 assertion errors (increased threshold)
      if (assertionErrorCount >= 5 && !firebaseOfflineManager.isOffline()) {
        console.warn('🚨 Multiple assertion errors detected - enabling offline mode automatically');
        firebaseOfflineManager.enableOfflineMode().catch(error => {
          console.error('Failed to auto-enable offline mode:', error);
        });
      }
    }

    // Call original console.error
    originalConsoleError.apply(console, args);
  };
}

export default firebaseOfflineManager;
