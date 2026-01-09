import React from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  firebaseIsolation, 
  isFirebaseIsolated, 
  enableFirebaseIsolation, 
  disableFirebaseIsolation,
  getFirebaseIsolationState 
} from '../lib/firebaseIsolation';

export const FirebaseIsolationControl: React.FC = () => {
  const [isolationState, setIsolationState] = React.useState(getFirebaseIsolationState());

  const handleToggleIsolation = () => {
    if (isolationState.isIsolated) {
      disableFirebaseIsolation();
      console.log('🔓 Firebase isolation disabled - database operations enabled');
    } else {
      enableFirebaseIsolation('Manually enabled via control panel');
      console.log('🔒 Firebase isolation enabled - database operations blocked');
    }
    setIsolationState(getFirebaseIsolationState());
  };

  const getStatusColor = () => {
    return isolationState.isIsolated ? 'destructive' : 'default';
  };

  const getStatusText = () => {
    return isolationState.isIsolated ? 'ISOLATED' : 'CONNECTED';
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Firebase Database Control</h3>
          <p className="text-sm text-muted-foreground">
            Toggle Firebase database connectivity
          </p>
        </div>
        <Badge variant={getStatusColor()}>
          {getStatusText()}
        </Badge>
      </div>

      <Alert>
        <AlertDescription>
          {isolationState.isIsolated ? (
            <>
              <strong>Database Isolated:</strong> All Firebase operations are blocked. 
              The app is running with mock data. No changes will be saved to your Firebase database.
            </>
          ) : (
            <>
              <strong>Database Connected:</strong> Firebase operations are enabled. 
              Changes will be saved to your Firebase database and data will be loaded from Firestore.
            </>
          )}
        </AlertDescription>
      </Alert>

      {isolationState.isIsolated && (
        <Alert>
          <AlertDescription>
            <strong>Isolation Reason:</strong> {isolationState.reason}
            <br />
            <strong>Isolated Since:</strong> {isolationState.isolatedAt.toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button 
          onClick={handleToggleIsolation}
          variant={isolationState.isIsolated ? "default" : "destructive"}
        >
          {isolationState.isIsolated ? "Enable Database" : "Disable Database"}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <strong>Note:</strong> If you experience Firebase SDK errors after enabling the database, 
        use the "Disable Database" button to restore stability.
      </div>
    </div>
  );
};
