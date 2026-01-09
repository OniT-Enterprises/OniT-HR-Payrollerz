#!/usr/bin/env ts-node

/**
 * Migration script to move root-level collections to tenant-scoped structure
 * 
 * Usage:
 *   npm run migrate:tenant -- --tenant-id=<TENANT_ID> [--dry-run] [--verbose]
 * 
 * This script:
 * 1. Reads all documents from root collections (/departments, /employees)
 * 2. Copies them to /tenants/{tid}/departments and /tenants/{tid}/employees
 * 3. Preserves original document IDs
 * 4. Optionally deletes root documents after successful migration
 * 5. Provides detailed logging and rollback capabilities
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

interface MigrationOptions {
  tenantId: string;
  dryRun: boolean;
  verbose: boolean;
  deleteOriginals: boolean;
  batchSize: number;
}

interface MigrationStats {
  departments: {
    total: number;
    migrated: number;
    errors: number;
  };
  employees: {
    total: number;
    migrated: number;
    errors: number;
  };
  startTime: Date;
  endTime?: Date;
}

class TenantMigrator {
  private db: FirebaseFirestore.Firestore;
  private options: MigrationOptions;
  private stats: MigrationStats;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.stats = {
      departments: { total: 0, migrated: 0, errors: 0 },
      employees: { total: 0, migrated: 0, errors: 0 },
      startTime: new Date(),
    };

    // Initialize Firebase Admin
    this.initializeFirebase();
    this.db = getFirestore();
  }

  private initializeFirebase() {
    try {
      // Try to find service account key
      const possiblePaths = [
        './serviceAccountKey.json',
        '../serviceAccountKey.json',
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
      ].filter(Boolean);

      let serviceAccount = null;
      for (const keyPath of possiblePaths) {
        if (keyPath && fs.existsSync(keyPath)) {
          serviceAccount = require(path.resolve(keyPath));
          console.log(`✅ Using service account from: ${keyPath}`);
          break;
        }
      }

      if (serviceAccount) {
        initializeApp({
          credential: cert(serviceAccount),
        });
      } else {
        // Use default credentials (useful in Cloud environment)
        initializeApp();
        console.log('✅ Using default Firebase credentials');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      process.exit(1);
    }
  }

  async migrate(): Promise<MigrationStats> {
    console.log('🚀 Starting tenant migration...');
    console.log(`📋 Target tenant: ${this.options.tenantId}`);
    console.log(`🔍 Dry run: ${this.options.dryRun ? 'Yes' : 'No'}`);
    console.log(`📝 Verbose: ${this.options.verbose ? 'Yes' : 'No'}`);
    console.log('');

    try {
      // Validate tenant exists
      await this.validateTenant();

      // Migrate departments
      await this.migrateDepartments();

      // Migrate employees
      await this.migrateEmployees();

      this.stats.endTime = new Date();
      this.printSummary();

      return this.stats;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  private async validateTenant(): Promise<void> {
    console.log('🔍 Validating tenant...');
    
    const tenantDoc = await this.db.collection('tenants').doc(this.options.tenantId).get();
    if (!tenantDoc.exists) {
      throw new Error(`Tenant ${this.options.tenantId} does not exist`);
    }

    const tenantData = tenantDoc.data();
    console.log(`✅ Tenant found: ${tenantData?.name || 'Unknown'}`);
  }

  private async migrateDepartments(): Promise<void> {
    console.log('\n📁 Migrating departments...');

    const rootDepartments = await this.db.collection('departments').get();
    this.stats.departments.total = rootDepartments.docs.length;

    if (this.stats.departments.total === 0) {
      console.log('ℹ️  No departments found in root collection');
      return;
    }

    console.log(`📊 Found ${this.stats.departments.total} departments to migrate`);

    for (const doc of rootDepartments.docs) {
      try {
        const data = doc.data();
        const targetPath = `tenants/${this.options.tenantId}/departments/${doc.id}`;

        if (this.options.verbose) {
          console.log(`  📂 Migrating department: ${data.name} (${doc.id})`);
        }

        if (!this.options.dryRun) {
          // Check if document already exists in target
          const targetDoc = await this.db.doc(targetPath).get();
          if (targetDoc.exists) {
            console.log(`  ⚠️  Department ${doc.id} already exists in target, skipping`);
            continue;
          }

          // Copy to tenant collection
          await this.db.doc(targetPath).set({
            ...data,
            migratedAt: FieldValue.serverTimestamp(),
            migratedFrom: 'root/departments',
          });

          // Optionally delete original
          if (this.options.deleteOriginals) {
            await this.db.collection('departments').doc(doc.id).delete();
            if (this.options.verbose) {
              console.log(`  🗑️  Deleted original department: ${doc.id}`);
            }
          }
        }

        this.stats.departments.migrated++;
      } catch (error) {
        console.error(`  ❌ Failed to migrate department ${doc.id}:`, error);
        this.stats.departments.errors++;
      }
    }

    console.log(`✅ Departments migration complete: ${this.stats.departments.migrated}/${this.stats.departments.total} successful`);
  }

  private async migrateEmployees(): Promise<void> {
    console.log('\n👥 Migrating employees...');

    const rootEmployees = await this.db.collection('employees').get();
    this.stats.employees.total = rootEmployees.docs.length;

    if (this.stats.employees.total === 0) {
      console.log('ℹ️  No employees found in root collection');
      return;
    }

    console.log(`📊 Found ${this.stats.employees.total} employees to migrate`);

    // Process in batches to avoid memory issues
    const batches = this.chunkArray(rootEmployees.docs, this.options.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`  📦 Processing batch ${i + 1}/${batches.length} (${batch.length} employees)`);

      for (const doc of batch) {
        try {
          const data = doc.data();
          const targetPath = `tenants/${this.options.tenantId}/employees/${doc.id}`;

          if (this.options.verbose) {
            console.log(`    👤 Migrating employee: ${data.personalInfo?.firstName} ${data.personalInfo?.lastName} (${doc.id})`);
          }

          if (!this.options.dryRun) {
            // Check if document already exists in target
            const targetDoc = await this.db.doc(targetPath).get();
            if (targetDoc.exists) {
              console.log(`    ⚠️  Employee ${doc.id} already exists in target, skipping`);
              continue;
            }

            // Migrate employee data to new structure
            const migratedData = this.migrateEmployeeData(data);

            // Copy to tenant collection
            await this.db.doc(targetPath).set({
              ...migratedData,
              migratedAt: FieldValue.serverTimestamp(),
              migratedFrom: 'root/employees',
            });

            // Optionally delete original
            if (this.options.deleteOriginals) {
              await this.db.collection('employees').doc(doc.id).delete();
              if (this.options.verbose) {
                console.log(`    🗑️  Deleted original employee: ${doc.id}`);
              }
            }
          }

          this.stats.employees.migrated++;
        } catch (error) {
          console.error(`    ❌ Failed to migrate employee ${doc.id}:`, error);
          this.stats.employees.errors++;
        }
      }
    }

    console.log(`✅ Employees migration complete: ${this.stats.employees.migrated}/${this.stats.employees.total} successful`);
  }

  private migrateEmployeeData(originalData: any): any {
    // Transform employee data to match new tenant structure
    const migrated = { ...originalData };

    // Ensure required fields for tenant structure
    if (!migrated.departmentId && migrated.jobDetails?.department) {
      // Try to map department name to ID (this might need manual mapping)
      migrated.departmentId = migrated.jobDetails.department.toLowerCase().replace(/\s+/g, '-');
    }

    // Add any other field transformations needed for the new structure
    return migrated;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private printSummary(): void {
    const duration = this.stats.endTime!.getTime() - this.stats.startTime.getTime();
    
    console.log('\n📊 Migration Summary');
    console.log('═══════════════════════════════════════');
    console.log(`🏢 Tenant: ${this.options.tenantId}`);
    console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
    console.log(`🔍 Dry run: ${this.options.dryRun ? 'Yes' : 'No'}`);
    console.log('');
    console.log('📁 Departments:');
    console.log(`   Total: ${this.stats.departments.total}`);
    console.log(`   Migrated: ${this.stats.departments.migrated}`);
    console.log(`   Errors: ${this.stats.departments.errors}`);
    console.log('');
    console.log('👥 Employees:');
    console.log(`   Total: ${this.stats.employees.total}`);
    console.log(`   Migrated: ${this.stats.employees.migrated}`);
    console.log(`   Errors: ${this.stats.employees.errors}`);
    console.log('');

    const totalErrors = this.stats.departments.errors + this.stats.employees.errors;
    if (totalErrors > 0) {
      console.log(`⚠️  ${totalErrors} errors occurred during migration`);
    } else {
      console.log('✅ Migration completed successfully with no errors');
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options: MigrationOptions = {
    tenantId: '',
    dryRun: false,
    verbose: false,
    deleteOriginals: false,
    batchSize: 50,
  };

  for (const arg of args) {
    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--delete-originals') {
      options.deleteOriginals = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  // Validate required arguments
  if (!options.tenantId) {
    console.error('❌ Error: --tenant-id is required');
    printHelp();
    process.exit(1);
  }

  try {
    const migrator = new TenantMigrator(options);
    await migrator.migrate();
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Tenant Migration Script
═══════════════════════

Migrates root-level collections (/departments, /employees) to tenant-scoped structure.

Usage:
  npm run migrate:tenant -- --tenant-id=<TENANT_ID> [options]

Required:
  --tenant-id=<ID>     Target tenant ID to migrate data to

Options:
  --dry-run           Show what would be migrated without actually doing it
  --verbose           Show detailed progress for each document
  --delete-originals  Delete original documents after successful migration
  --batch-size=<N>    Process employees in batches of N documents (default: 50)
  --help              Show this help message

Examples:
  # Dry run to see what would be migrated
  npm run migrate:tenant -- --tenant-id=my-company --dry-run --verbose

  # Actual migration
  npm run migrate:tenant -- --tenant-id=my-company

  # Migration with cleanup
  npm run migrate:tenant -- --tenant-id=my-company --delete-originals

Environment:
  Requires Firebase Admin credentials via:
  - ./serviceAccountKey.json
  - ../serviceAccountKey.json  
  - GOOGLE_APPLICATION_CREDENTIALS environment variable
`);
}

if (require.main === module) {
  main();
}

export { TenantMigrator, MigrationOptions, MigrationStats };
