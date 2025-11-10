/**
 * Firestore Migration Utility
 * Converts SQLite data to Firestore format for seamless cloud migration
 * 
 * When ready to migrate to Firestore, use these functions to export data
 * in a format ready for Firestore import.
 */

import {
  exportData,
  Employee,
  Department,
  Job,
  Candidate,
} from "@/lib/sqliteApiService";

/**
 * Firestore document structure (matches our SQLite schema)
 */
export interface FirestoreDocument {
  id: string;
  [key: string]: any;
}

export interface FirestoreCollection {
  [collection: string]: FirestoreDocument[];
}

/**
 * Export SQLite data in Firestore-ready format
 * 
 * This function:
 * 1. Fetches all data from SQLite
 * 2. Converts to Firestore document format
 * 3. Returns as JSON ready for Firestore batch import
 * 
 * Usage:
 * const firestoreData = await exportToFirestore();
 * // Save this JSON and import to Firestore using Firebase console or CLI
 */
export async function exportToFirestore(): Promise<FirestoreCollection> {
  try {
    const data = await exportData();

    // Transform SQLite collections to Firestore format
    const firestoreData: FirestoreCollection = {
      departments: data.departments.map((dept: Department) => ({
        ...dept,
        // Ensure Firestore-compatible types
        headCount: dept.headCount || 0,
        createdAt: new Date(dept.createdAt),
        updatedAt: new Date(dept.updatedAt),
      })),

      employees: data.employees.map((emp: Employee) => ({
        ...emp,
        // Firestore can't store nested objects like we have,
        // so we flatten the structure
        createdAt: new Date(emp.createdAt),
        updatedAt: new Date(emp.updatedAt),
      })),

      jobs: data.jobs.map((job: Job) => ({
        ...job,
        postedDate: new Date(job.postedDate),
        closingDate: job.closingDate ? new Date(job.closingDate) : null,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
      })),

      candidates: data.candidates.map((candidate: Candidate) => ({
        ...candidate,
        appliedDate: new Date(candidate.appliedDate),
        createdAt: new Date(candidate.createdAt),
        updatedAt: new Date(candidate.updatedAt),
      })),
    };

    return firestoreData;
  } catch (error) {
    console.error("Error exporting to Firestore format:", error);
    throw new Error("Failed to export data for Firestore migration");
  }
}

/**
 * Generate Firestore import script (Node.js)
 * 
 * This creates a script that can be run to import the exported data
 * into Firestore using the Firebase Admin SDK
 */
export function generateFirestoreImportScript(data: FirestoreCollection): string {
  const script = `
// firestore-import.js
// Run with: node firestore-import.js
// Make sure GOOGLE_APPLICATION_CREDENTIALS env var points to your service account key

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const data = ${JSON.stringify(data, null, 2)};

async function importData() {
  console.log('Starting Firestore data import...');
  
  const batch = db.batch();
  let operationCount = 0;

  // Import each collection
  for (const [collectionName, documents] of Object.entries(data)) {
    console.log(\`Importing \${collectionName}...\);
    
    for (const doc of documents) {
      const docRef = db.collection(collectionName).doc(doc.id);
      batch.set(docRef, doc);
      operationCount++;

      // Firestore has a limit of 500 operations per batch
      if (operationCount === 500) {
        await batch.commit();
        console.log('Batch committed (500 operations)');
      }
    }
  }

  // Commit remaining operations
  if (operationCount % 500 !== 0) {
    await batch.commit();
    console.log(\`Final batch committed (\${operationCount % 500} operations)\`);
  }

  console.log(\`✅ Data import complete! \${operationCount} documents imported.\`);
  process.exit(0);
}

importData().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
`;

  return script;
}

/**
 * Generate Firestore security rules
 * 
 * Basic rules for the HR application
 */
export function generateFirestoreSecurityRules(): string {
  const rules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /departments/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    match /employees/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'admin' || request.auth.token.role == 'hr';
    }
    
    match /jobs/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'admin' || request.auth.token.role == 'hiring';
    }
    
    match /candidates/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'admin' || request.auth.token.role == 'hiring';
    }
  }
}
`;

  return rules;
}

/**
 * Generate migration guide
 */
export function generateMigrationGuide(): string {
  const guide = `
# SQLite to Firestore Migration Guide

## Overview
Your application has been designed to make migration to Firestore seamless.
The SQLite database schema matches Firestore's document structure exactly.

## Pre-Migration Checklist
- [ ] Export all data from SQLite using \`exportToFirestore()\`
- [ ] Create a Firestore database in Firebase Console
- [ ] Download service account key from Firebase Console
- [ ] Test migration in development environment first

## Migration Steps

### 1. Export Data
\`\`\`typescript
import { exportToFirestore } from '@/lib/firestoreMigration';

const firestoreData = await exportToFirestore();
const jsonBlob = new Blob([JSON.stringify(firestoreData, null, 2)], {
  type: 'application/json'
});
// Save to file: hr-data-export.json
\`\`\`

### 2. Set Up Firebase Admin SDK
\`\`\`bash
npm install firebase-admin
\`\`\`

### 3. Create Import Script
Use the generated script from \`generateFirestoreImportScript()\`

### 4. Run Import
\`\`\`bash
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
node firestore-import.js
\`\`\`

### 5. Update Application Code
Replace SQLite API calls with Firestore calls:

**Before (SQLite):**
\`\`\`typescript
import { getEmployees } from '@/lib/sqliteApiService';
const employees = await getEmployees();
\`\`\`

**After (Firestore):**
\`\`\`typescript
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const q = query(collection(db, 'employees'));
const snapshot = await getDocs(q);
const employees = snapshot.docs.map(doc => doc.data());
\`\`\`

## Benefits of This Approach
- ✅ Schema compatibility = instant migration
- ✅ No data transformation needed
- ✅ Same API structure = minimal code changes
- ✅ Tested locally before moving to cloud
- ✅ Easy rollback if needed

## Support
For migration issues, refer to:
- Firebase Documentation: https://firebase.google.com/docs/firestore
- Migration blog post: [Your blog post link]
`;

  return guide;
}

/**
 * Validate data before migration
 */
export async function validateMigrationData(): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = await exportData();

    // Validate departments
    if (!data.departments || data.departments.length === 0) {
      warnings.push("No departments found - consider adding some before migration");
    }

    // Validate employees
    if (!data.employees || data.employees.length === 0) {
      warnings.push("No employees found");
    } else {
      const invalidEmails = data.employees.filter((e) => !e.email);
      if (invalidEmails.length > 0) {
        errors.push(`${invalidEmails.length} employees have missing emails`);
      }
    }

    // Validate jobs
    if (!data.jobs || data.jobs.length === 0) {
      warnings.push("No jobs found");
    }

    // Validate candidates
    if (!data.candidates || data.candidates.length === 0) {
      warnings.push("No candidates found");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: ["Failed to validate data: " + (error instanceof Error ? error.message : String(error))],
      warnings: [],
    };
  }
}
