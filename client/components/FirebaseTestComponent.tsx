import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db, auth, isFirebaseReady, isFirebaseBlocked, tryAuthentication } from '@/lib/firebase';
import { testFirebaseConnection, getFirebaseStatus } from '@/lib/firebaseManager';
import { isFirebaseIsolated, getFirebaseIsolationState, disableFirebaseIsolation } from '@/lib/firebaseIsolation';
import { enableFirebaseOfflineMode, isFirebaseOffline, getFirebaseOfflineState } from '@/lib/firebaseOfflineMode';
import { collection, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { candidateService } from '@/services/candidateService';

const FirebaseTestComponent: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testFirebaseConnectionSafe = async () => {
    setIsLoading(true);
    clearResults();

    try {
      // Test 1: Check Firebase initialization
      addResult(`✅ Firebase ready: ${isFirebaseReady()}`);
      addResult(`❌ Firebase blocked: ${isFirebaseBlocked()}`);
      addResult(`��� Database instance: ${db ? 'Available' : 'Not available'}`);
      addResult(`🔐 Auth instance: ${auth ? 'Available' : 'Not available'}`);

      // Test 2: Check offline mode status
      const offlineState = getFirebaseOfflineState();
      addResult(`📴 Offline mode: ${isFirebaseOffline() ? 'ENABLED' : 'Disabled'}`);
      addResult(`🌐 Network disabled: ${offlineState.networkDisabled ? 'Yes' : 'No'}`);
      addResult(`🔚 Firebase terminated: ${offlineState.terminated ? 'Yes' : 'No'}`);

      if (!db) {
        addResult('❌ Cannot proceed - database not initialized');
        return;
      }

      if (isFirebaseOffline()) {
        addResult('ℹ️ Firebase is in offline mode - some tests will be skipped');
      }

      // Test 2: Check isolation status
      const isolationState = getFirebaseIsolationState();
      addResult(`🚫 Firebase isolated: ${isFirebaseIsolated() ? 'Yes' : 'No'}`);
      if (isFirebaseIsolated()) {
        addResult(`📝 Isolation reason: ${isolationState.reason}`);
        addResult(`🕐 Isolated at: ${isolationState.isolatedAt.toLocaleTimeString()}`);
      }

      // Test 3: Check connection manager status
      const status = getFirebaseStatus();
      addResult(`📡 Connection status: ${status.isConnected ? 'Connected' : 'Disconnected'}`);
      addResult(`🔄 Is connecting: ${status.isConnecting ? 'Yes' : 'No'}`);
      if (status.error) {
        addResult(`⚠️ Manager error: ${status.error}`);
      }

      // Test 3: Safe connection test using manager
      try {
        addResult('🔗 Testing connection with safe manager...');
        const connectionResult = await testFirebaseConnection();
        addResult(`${connectionResult ? '✅' : '❌'} Connection manager test ${connectionResult ? 'successful' : 'failed'}`);
      } catch (connectionError: any) {
        addResult(`❌ Connection manager error: ${connectionError.message}`);
        if (connectionError.message?.includes('INTERNAL ASSERTION FAILED')) {
          addResult('🚨 Internal assertion error detected - this is a known Firebase SDK issue');
        } else if (connectionError.message?.includes('client has already been terminated')) {
          addResult('🔚 Firebase client has been terminated - this is expected in offline mode');
        }
      }

      // Test 4: Authentication
      try {
        addResult('🔐 Testing authentication...');
        const authResult = await tryAuthentication();
        addResult(`${authResult ? '✅' : '❌'} Authentication ${authResult ? 'successful' : 'failed'}`);
        if (auth && auth.currentUser) {
          addResult(`👤 Current user: ${auth.currentUser.email || 'Anonymous user'} (${auth.currentUser.uid.substring(0, 8)}...)`);
        }
      } catch (authError: any) {
        addResult(`❌ Authentication error: ${authError.message}`);
      }

      // Test 5: Simple read operation
      try {
        addResult('🔍 Testing read access to candidates collection...');
        const candidatesRef = collection(db, 'candidates');
        const snapshot = await getDocs(candidatesRef);
        addResult(`✅ Read test successful - found ${snapshot.docs.length} documents`);
      } catch (readError: any) {
        addResult(`❌ Read test failed: ${readError.message}`);
        if (readError.code === 'permission-denied') {
          addResult('💡 Permission denied - you may need to deploy updated Firestore rules');
          addResult('📝 Run: firebase deploy --only firestore:rules');
        } else if (readError.message?.includes('client has already been terminated')) {
          addResult('🔚 Read test skipped - Firebase client terminated (offline mode)');
        }
      }

      // Test 6: Simple write operation
      try {
        addResult('✍️ Testing write access...');
        const testRef = collection(db, 'test');
        await addDoc(testRef, {
          message: 'Firebase connectivity test',
          timestamp: new Date(),
          type: 'connectivity-test'
        });
        addResult('✅ Write test successful');
      } catch (writeError: any) {
        addResult(`❌ Write test failed: ${writeError.message}`);
        if (writeError.code === 'permission-denied') {
          addResult('💡 Permission denied - you may need to deploy updated Firestore rules');
          addResult('📝 Run: firebase deploy --only firestore:rules');
        } else if (writeError.message?.includes('INTERNAL ASSERTION FAILED')) {
          addResult('🚨 Firebase internal assertion error - this is a known SDK issue');
        } else if (writeError.message?.includes('client has already been terminated')) {
          addResult('🔚 Write test skipped - Firebase client terminated (offline mode)');
        }
      }

      // Test 7: Candidate Service
      try {
        addResult('👥 Testing candidate service...');
        const candidates = await candidateService.getAllCandidates();
        addResult(`✅ Candidate service test successful - found ${candidates.length} candidates`);
      } catch (candidateError: any) {
        addResult(`❌ Candidate service test failed: ${candidateError.message}`);
        if (candidateError.message?.includes('client has already been terminated')) {
          addResult('🔚 Candidate service using fallback data (Firebase client terminated)');
        }
      }

    } catch (error: any) {
      addResult(`❌ General error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔥 Firebase Connectivity Test
          <Badge variant={isFirebaseReady() ? 'default' : 'destructive'}>
            {isFirebaseReady() ? 'Ready' : 'Not Ready'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={testFirebaseConnectionSafe}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Testing...' : 'Run Safe Tests'}
          </Button>
          <Button
            onClick={async () => {
              addResult('📴 Enabling Firebase offline mode...');
              try {
                await enableFirebaseOfflineMode();
                addResult('✅ Offline mode enabled successfully');
              } catch (error: any) {
                addResult(`❌ Failed to enable offline mode: ${error.message}`);
              }
            }}
            variant="secondary"
            disabled={isLoading}
          >
            Enable Offline
          </Button>
          <Button
            onClick={() => {
              addResult('🔄 Disabling Firebase isolation...');
              try {
                disableFirebaseIsolation();
                addResult('✅ Firebase isolation disabled - operations re-enabled');
                addResult('⚠️ Warning: This may cause assertion errors to return');
              } catch (error: any) {
                addResult(`❌ Failed to disable isolation: ${error.message}`);
              }
            }}
            variant="outline"
            disabled={isLoading || !isFirebaseIsolated()}
          >
            Disable Isolation
          </Button>
          <Button
            onClick={clearResults}
            variant="outline"
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
            <h4 className="font-semibold mb-2">Test Results:</h4>
            <div className="space-y-1 font-mono text-sm">
              {testResults.map((result, index) => (
                <div key={index} className={`
                  ${result.includes('✅') ? 'text-green-600' : ''}
                  ${result.includes('❌') ? 'text-red-600' : ''}
                  ${result.includes('🔍') || result.includes('✍️') ? 'text-blue-600 font-semibold' : ''}
                `}>
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FirebaseTestComponent;
