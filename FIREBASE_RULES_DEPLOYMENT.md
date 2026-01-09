# Firebase Rules Deployment Guide

## The Issue
You're experiencing "Missing or insufficient permissions" errors because the Firestore security rules need to be deployed to your Firebase project.

## Solution Steps

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Deploy the Updated Rules
The Firestore rules have been updated in `firestore.rules` to allow development access. Deploy them:

```bash
firebase deploy --only firestore:rules
```

Or use the provided script:
```bash
./deploy-firestore-rules.sh
```

### 4. Verify Deployment
After deployment, test the Firebase connection using the test component on the Dashboard page.

## What Changed

The Firestore rules were updated to:
- Allow anonymous authentication
- Provide broader access during development
- Include connectivity test collection access
- Handle permission errors gracefully

## For Production

When moving to production, you should:
1. Restrict the rules to authenticated users only
2. Implement proper tenant-based access control
3. Remove the broad `allow read, write: if true;` rules

## Current Rules Features

- **Development Mode**: Allows all read/write operations for testing
- **Anonymous Authentication**: Supports anonymous users for development
- **Test Collection**: Dedicated collection for connectivity testing
- **Comprehensive Access**: Covers all main collections (employees, candidates, jobs, etc.)

## Troubleshooting

If you still see permission errors after deployment:
1. Check that you're logged into the correct Firebase project
2. Verify the rules deployed successfully in the Firebase Console
3. Try refreshing the application
4. Check the browser console for specific error messages

## Alternative: Manual Deployment via Console

If CLI deployment fails, you can also:
1. Go to Firebase Console → Firestore Database → Rules
2. Copy the contents of `firestore.rules`
3. Paste and publish the rules manually
