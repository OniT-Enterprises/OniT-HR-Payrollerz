/**
 * Test setup for Firestore emulator tests
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
  
  // Set environment variables for Firebase emulator
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9100';
  
  console.log('✅ Test environment ready');
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
});
