import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Shield, Upload, Check, AlertTriangle } from "lucide-react";

export const FirestoreRulesDeploy: React.FC = () => {
  const [message, setMessage] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const handleShowDeployInstructions = () => {
    setMessage(`
📋 To deploy Firestore rules and fix permissions:

1. Open your terminal
2. Run: firebase deploy --only firestore:rules
3. This will deploy the development rules that allow all access

OR manually in Firebase Console:
1. Go to https://console.firebase.google.com
2. Select your project: onit-payroll
3. Go to Firestore Database → Rules
4. Replace all rules with this:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

5. Click Publish
    `);
  };

  const handleTestPermissions = async () => {
    setIsDeploying(true);
    setMessage("🔍 Testing Firestore permissions...");

    try {
      // Try a simple Firestore operation
      const { db } = await import("../lib/firebase");
      const { collection, addDoc } = await import("firebase/firestore");

      if (db) {
        const testRef = collection(db, "permission-test");
        await addDoc(testRef, {
          test: true,
          timestamp: new Date(),
          message: "Permission test successful",
        });
        setMessage(
          "✅ SUCCESS! Firestore permissions are working. You can now save data.",
        );
      } else {
        setMessage("❌ Firebase database not initialized");
      }
    } catch (error: any) {
      console.error("Permission test failed:", error);

      if (error.code === "permission-denied") {
        setMessage(`❌ PERMISSION DENIED: Firestore rules need to be deployed.
        
The error means your Firestore rules are blocking access. You need to:
1. Deploy the development rules with: firebase deploy --only firestore:rules
2. OR manually update rules in Firebase Console to allow access`);
      } else if (error.message?.includes("Failed to fetch")) {
        setMessage("❌ Network error: Try the Emergency Fix button first");
      } else {
        setMessage(`❌ Test failed: ${error.message}`);
      }
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Card className="mb-4 border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <Shield className="h-5 w-5" />
          Firestore Permissions Issue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription>
            <strong>Permission Denied:</strong> Your Firestore rules are
            blocking database access. You need to deploy development rules to
            allow data operations.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleTestPermissions}
            disabled={isDeploying}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            {isDeploying ? "Testing..." : "Test Permissions"}
          </Button>
          <Button
            onClick={handleShowDeployInstructions}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Show Deploy Instructions
          </Button>
          <Button
            onClick={() =>
              window.open("https://console.firebase.google.com", "_blank")
            }
            variant="secondary"
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Open Firebase Console
          </Button>
        </div>

        {message && (
          <Alert
            className={
              message.includes("✅")
                ? "border-green-200 bg-green-50"
                : "border-yellow-200 bg-yellow-50"
            }
          >
            <AlertDescription
              className={
                message.includes("✅") ? "text-green-700" : "text-yellow-700"
              }
            >
              <pre className="whitespace-pre-wrap text-xs">{message}</pre>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-600">
          <strong>Quick Fix:</strong> Run{" "}
          <code>firebase deploy --only firestore:rules</code> in your terminal
        </div>
      </CardContent>
    </Card>
  );
};
