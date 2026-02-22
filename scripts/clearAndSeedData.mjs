/**
 * Clear and Seed Production Data Script
 *
 * This script:
 * 1. Clears all tenant-scoped data from the production Firestore
 * 2. Seeds fresh realistic data for testing
 *
 * Usage: node scripts/clearAndSeedData.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

// Load service account
const serviceAccount = JSON.parse(
  readFileSync(new URL('../service-account.json', import.meta.url), 'utf8')
);

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// ===========================================
// CONFIGURATION
// ===========================================

const TENANT_ID = 'onit-enterprises'; // Main tenant
const NOW = new Date();
const TODAY = NOW.toISOString().split('T')[0];

// Helper functions
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
};

const subtractDays = (date, days) => addDays(date, -days);

const randomDate = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()))
    .toISOString().split('T')[0];
};

// ===========================================
// COLLECTIONS TO CLEAR (tenant-scoped)
// ===========================================

const TENANT_COLLECTIONS = [
  'departments',
  'employees',
  'positions',
  'jobs',
  'candidates',
  'interviews',
  'offers',
  'contracts',
  'employmentSnapshots',
  'timesheets',
  'leavePolicies',
  'leaveRequests',
  'leaveBalances',
  'goals',
  'reviews',
  'trainings',
  'discipline',
  'auditLogs',
  'archives',
  'qbExportLogs',
  'accounts',
  'journalEntries',
  'generalLedger',
  'fiscalYears',
  'fiscalPeriods',
  'customers',
  'invoices',
  'recurring_invoices',
  'payments_received',
  'vendors',
  'bills',
  'bill_payments',
  'expenses',
  'holidays',
  'members',
  'analytics',
];

// Root-level collections to clear (be careful with these)
const ROOT_COLLECTIONS = [
  'payrollRuns',
  'payrollRecords',
  'benefitEnrollments',
  'recurringDeductions',
  'taxReports',
  'bankTransfers',
  'attendance',
  'attendanceImports',
  'leave_requests',
  'leave_balances',
  'taxFilings',
];

// ===========================================
// CLEAR FUNCTIONS
// ===========================================

async function deleteCollection(collectionRef, batchSize = 100) {
  const query = collectionRef.limit(batchSize);
  let deleted = 0;

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleted++;
    });
    await batch.commit();
  }

  return deleted;
}

async function clearTenantData(tenantId) {
  console.log(`\n🧹 Clearing data for tenant: ${tenantId}`);

  for (const collName of TENANT_COLLECTIONS) {
    const collRef = db.collection(`tenants/${tenantId}/${collName}`);
    const count = await deleteCollection(collRef);
    if (count > 0) {
      console.log(`   ✓ Deleted ${count} documents from ${collName}`);
    }
  }

  // Clear settings subcollection
  const settingsRef = db.collection(`tenants/${tenantId}/settings`);
  const settingsCount = await deleteCollection(settingsRef);
  if (settingsCount > 0) {
    console.log(`   ✓ Deleted ${settingsCount} documents from settings`);
  }
}

async function clearRootCollections() {
  console.log(`\n🧹 Clearing root-level collections with tenantId filter`);

  for (const collName of ROOT_COLLECTIONS) {
    const collRef = db.collection(collName);
    const query = collRef.where('tenantId', '==', TENANT_ID);
    const snapshot = await query.get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`   ✓ Deleted ${snapshot.size} documents from ${collName}`);
    }
  }
}

// ===========================================
// SEED DATA
// ===========================================

const SEED_DATA = {
  // ============ DEPARTMENTS ============
  departments: [
    { id: 'dept-operations', name: 'Operasaun', description: 'Jere operasaun loron-loron', budget: 50000 },
    { id: 'dept-finance', name: 'Finansas', description: 'Kontabilidade no jestaun finanseira', budget: 30000 },
    { id: 'dept-hr', name: 'Rekursu Umanu', description: 'Jestaun empregadu no rekrutamentu', budget: 25000 },
    { id: 'dept-it', name: 'Teknolojia Informasaun', description: 'Suporta teknolojia no sistema', budget: 40000 },
    { id: 'dept-sales', name: 'Vendas', description: 'Dezenvolvimentu negosiu no vendas', budget: 35000 },
    { id: 'dept-admin', name: 'Administrasaun', description: 'Suporta administrativa jerál', budget: 20000 },
  ],

  // ============ EMPLOYEES ============
  employees: [
    {
      id: 'emp-001',
      personalInfo: {
        firstName: 'Domingos',
        lastName: 'Ximenes',
        email: 'domingos.ximenes@onit.tl',
        phone: '+670 7723 4567',
        phoneApp: 'whatsapp',
        appEligible: true,
        address: 'Aldeia Lahane Ocidental, Suku Lahane Ocidental, Dili',
        dateOfBirth: '1982-08-20',
        socialSecurityNumber: 'TL-2024-001234',
        emergencyContactName: 'Filomena Ximenes',
        emergencyContactPhone: '+670 7723 8901',
      },
      jobDetails: {
        employeeId: 'EMP001',
        department: 'Operasaun',
        position: 'Diretor Jerál',
        hireDate: '2020-03-01',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: '',
      },
      compensation: {
        monthlySalary: 2000,
        annualLeaveDays: 22,
        benefitsPackage: 'executive',
      },
      documents: {
        employeeIdCard: { number: 'EID-001', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-001234', expiryDate: '', required: true },
        electoralCard: { number: 'EC-001234', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-123456', expiryDate: '2028-08-20', required: true },
        passport: { number: 'C0012345', expiryDate: '2029-05-15', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-operations',
      isForeignWorker: false,
    },
    {
      id: 'emp-002',
      personalInfo: {
        firstName: 'Maria',
        lastName: 'Soares',
        email: 'maria.soares@onit.tl',
        phone: '+670 7712 3456',
        phoneApp: 'telegram',
        appEligible: true,
        address: 'Aldeia Bidau Santana, Suku Bidau Santana, Dili',
        dateOfBirth: '1988-11-15',
        socialSecurityNumber: 'TL-2024-002345',
        emergencyContactName: 'Antonio Soares',
        emergencyContactPhone: '+670 7712 7890',
      },
      jobDetails: {
        employeeId: 'EMP002',
        department: 'Finansas',
        position: 'Xefe Finansas',
        hireDate: '2021-01-15',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP001',
      },
      compensation: {
        monthlySalary: 1600,
        annualLeaveDays: 20,
        benefitsPackage: 'standard',
      },
      documents: {
        employeeIdCard: { number: 'EID-002', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-002345', expiryDate: '', required: true },
        electoralCard: { number: 'EC-002345', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-234567', expiryDate: '2028-11-15', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-finance',
      isForeignWorker: false,
    },
    {
      id: 'emp-003',
      personalInfo: {
        firstName: 'Agustinho',
        lastName: 'da Costa Belo',
        email: 'agustinho.belo@onit.tl',
        phone: '+670 7734 5678',
        phoneApp: 'whatsapp',
        appEligible: true,
        address: 'Aldeia Kuluhun, Suku Kuluhun, Dili',
        dateOfBirth: '1991-04-22',
        socialSecurityNumber: 'TL-2024-003456',
        emergencyContactName: 'Rosa da Costa',
        emergencyContactPhone: '+670 7734 1234',
      },
      jobDetails: {
        employeeId: 'EMP003',
        department: 'Rekursu Umanu',
        position: 'Ofisiál RH',
        hireDate: '2022-06-01',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP001',
      },
      compensation: {
        monthlySalary: 950,
        annualLeaveDays: 18,
        benefitsPackage: 'standard',
      },
      documents: {
        employeeIdCard: { number: 'EID-003', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-003456', expiryDate: '', required: true },
        electoralCard: { number: 'EC-003456', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-345678', expiryDate: '2028-04-22', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-hr',
      isForeignWorker: false,
    },
    {
      id: 'emp-004',
      personalInfo: {
        firstName: 'Natalino',
        lastName: 'Guterres',
        email: 'natalino.guterres@onit.tl',
        phone: '+670 7745 6789',
        phoneApp: 'whatsapp',
        appEligible: true,
        address: 'Aldeia Bairo Pite, Suku Bairo Pite, Dili',
        dateOfBirth: '1993-12-05',
        socialSecurityNumber: 'TL-2024-004567',
        emergencyContactName: 'Jacinta Guterres',
        emergencyContactPhone: '+670 7745 2345',
      },
      jobDetails: {
        employeeId: 'EMP004',
        department: 'Teknolojia Informasaun',
        position: 'Tekniku TI',
        hireDate: '2023-02-15',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP001',
      },
      compensation: {
        monthlySalary: 1100,
        annualLeaveDays: 18,
        benefitsPackage: 'standard',
      },
      documents: {
        employeeIdCard: { number: 'EID-004', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-004567', expiryDate: '', required: true },
        electoralCard: { number: 'EC-004567', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-456789', expiryDate: '2028-12-05', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-it',
      isForeignWorker: false,
    },
    {
      id: 'emp-005',
      personalInfo: {
        firstName: 'Celestina',
        lastName: 'Amaral',
        email: 'celestina.amaral@onit.tl',
        phone: '+670 7756 7890',
        phoneApp: 'telegram',
        appEligible: true,
        address: 'Aldeia Farol, Suku Farol, Dili',
        dateOfBirth: '1996-07-18',
        socialSecurityNumber: 'TL-2024-005678',
        emergencyContactName: 'Manuel Amaral',
        emergencyContactPhone: '+670 7756 3456',
      },
      jobDetails: {
        employeeId: 'EMP005',
        department: 'Vendas',
        position: 'Reprezentante Vendas',
        hireDate: '2024-01-08',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP001',
      },
      compensation: {
        monthlySalary: 700,
        annualLeaveDays: 15,
        benefitsPackage: 'basic',
      },
      documents: {
        employeeIdCard: { number: 'EID-005', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-005678', expiryDate: '', required: true },
        electoralCard: { number: 'EC-005678', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-567890', expiryDate: '2028-07-18', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-sales',
      isForeignWorker: false,
    },
    {
      id: 'emp-006',
      personalInfo: {
        firstName: 'Fernando',
        lastName: 'Tilman',
        email: 'fernando.tilman@onit.tl',
        phone: '+670 7767 8901',
        phoneApp: 'whatsapp',
        appEligible: true,
        address: 'Aldeia Comoro, Suku Comoro, Dili',
        dateOfBirth: '1985-02-28',
        socialSecurityNumber: 'TL-2024-006789',
        emergencyContactName: 'Beatriz Tilman',
        emergencyContactPhone: '+670 7767 4567',
      },
      jobDetails: {
        employeeId: 'EMP006',
        department: 'Administrasaun',
        position: 'Asistente Administrativu',
        hireDate: '2023-09-01',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP001',
      },
      compensation: {
        monthlySalary: 550,
        annualLeaveDays: 15,
        benefitsPackage: 'basic',
      },
      documents: {
        employeeIdCard: { number: 'EID-006', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-006789', expiryDate: '', required: true },
        electoralCard: { number: 'EC-006789', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-678901', expiryDate: '2028-02-28', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-admin',
      isForeignWorker: false,
    },
    {
      id: 'emp-007',
      personalInfo: {
        firstName: 'Lourenco',
        lastName: 'Hornay',
        email: 'lourenco.hornay@onit.tl',
        phone: '+670 7778 9012',
        phoneApp: 'whatsapp',
        appEligible: true,
        address: 'Aldeia Becora, Suku Becora, Dili',
        dateOfBirth: '1990-10-12',
        socialSecurityNumber: 'TL-2024-007890',
        emergencyContactName: 'Angelina Hornay',
        emergencyContactPhone: '+670 7778 5678',
      },
      jobDetails: {
        employeeId: 'EMP007',
        department: 'Finansas',
        position: 'Kontabilista',
        hireDate: '2022-11-01',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP002',
      },
      compensation: {
        monthlySalary: 850,
        annualLeaveDays: 18,
        benefitsPackage: 'standard',
      },
      documents: {
        employeeIdCard: { number: 'EID-007', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-007890', expiryDate: '', required: true },
        electoralCard: { number: 'EC-007890', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-789012', expiryDate: '2028-10-12', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-finance',
      isForeignWorker: false,
    },
    {
      id: 'emp-008',
      personalInfo: {
        firstName: 'Veronica',
        lastName: 'Lay',
        email: 'veronica.lay@onit.tl',
        phone: '+670 7789 0123',
        phoneApp: 'telegram',
        appEligible: true,
        address: 'Aldeia Caicoli, Suku Caicoli, Dili',
        dateOfBirth: '1994-06-30',
        socialSecurityNumber: 'TL-2024-008901',
        emergencyContactName: 'Jose Lay',
        emergencyContactPhone: '+670 7789 6789',
      },
      jobDetails: {
        employeeId: 'EMP008',
        department: 'Vendas',
        position: 'Koordinador Marketing',
        hireDate: '2024-03-15',
        employmentType: 'full-time',
        workLocation: 'Escritoriu Dili',
        manager: 'EMP001',
      },
      compensation: {
        monthlySalary: 800,
        annualLeaveDays: 18,
        benefitsPackage: 'standard',
      },
      documents: {
        employeeIdCard: { number: 'EID-008', expiryDate: '2027-12-31', required: true },
        socialSecurityNumber: { number: 'TL-2024-008901', expiryDate: '', required: true },
        electoralCard: { number: 'EC-008901', expiryDate: '2028-06-30', required: false },
        idCard: { number: 'BI-890123', expiryDate: '2028-06-30', required: true },
        passport: { number: '', expiryDate: '', required: false },
        workContract: { fileUrl: '', uploadDate: '' },
        nationality: 'Timorese',
        workingVisaResidency: { number: '', expiryDate: '', fileUrl: '' },
      },
      status: 'active',
      departmentId: 'dept-sales',
      isForeignWorker: false,
    },
  ],

  // ============ CUSTOMERS ============
  customers: [
    {
      id: 'cust-001',
      name: 'Hotel Timor',
      type: 'business',
      email: 'kontabilidade@hoteltimor.tl',
      phone: '+670 3321 2233',
      address: 'Avenida Presidente Nicolau Lobato, Lahane',
      city: 'Dili',
      tin: 'TL-101234567',
      notes: 'Kliente premium - kontratu mensal ba servisu RH',
      isActive: true,
    },
    {
      id: 'cust-002',
      name: 'Kmanek Trading',
      type: 'business',
      email: 'finansas@kmanektrading.tl',
      phone: '+670 3322 4455',
      address: 'Rua de Caicoli, Vera Cruz',
      city: 'Dili',
      tin: 'TL-102345678',
      notes: 'Importador no distribuidor prinsipal',
      isActive: true,
    },
    {
      id: 'cust-003',
      name: 'Loja Lita',
      type: 'business',
      email: 'lojalita@gmail.com',
      phone: '+670 7712 9876',
      address: 'Toko Baru, Taibessi',
      city: 'Dili',
      tin: 'TL-103456789',
      notes: 'Negosiu retail ki\'ik',
      isActive: true,
    },
    {
      id: 'cust-004',
      name: 'Mateus Boavida',
      type: 'individual',
      email: 'mateus.boavida@gmail.com',
      phone: '+670 7723 4567',
      address: 'Aldeia Mascarenhas, Suku Cristo Rei',
      city: 'Dili',
      tin: '',
      notes: 'Konsultante individuál - legal',
      isActive: true,
    },
    {
      id: 'cust-005',
      name: 'Haksolok Konstrusaun Lda',
      type: 'business',
      email: 'fatura@haksolok.tl',
      phone: '+670 3323 6677',
      address: 'Zona Industrial Hera',
      city: 'Dili',
      tin: 'TL-104567890',
      notes: 'Konstrusaun no infraestrutura',
      isActive: true,
    },
    {
      id: 'cust-006',
      name: 'Cooperativa Café Timor',
      type: 'business',
      email: 'admin@cafetimorcoop.tl',
      phone: '+670 3324 7788',
      address: 'Estrada de Aileu, Dare',
      city: 'Dili',
      tin: 'TL-105678901',
      notes: 'Kooperativa kafé - exportasaun',
      isActive: true,
    },
    {
      id: 'cust-007',
      name: 'Restaurante Dilicious',
      type: 'business',
      email: 'info@dilicious.tl',
      phone: '+670 7734 8899',
      address: 'Rua de Kolmera, Colmera',
      city: 'Dili',
      tin: 'TL-106789012',
      notes: 'Restaurante no katering',
      isActive: true,
    },
    {
      id: 'cust-008',
      name: 'Naroman Printing',
      type: 'business',
      email: 'orders@naromanprint.tl',
      phone: '+670 3325 9900',
      address: 'Rua de Lecidere, Bairo Pite',
      city: 'Dili',
      tin: 'TL-107890123',
      notes: 'Servisu impresaun no grafika',
      isActive: true,
    },
  ],

  // ============ VENDORS ============
  vendors: [
    {
      id: 'vend-001',
      name: 'Dili Stationary & Office Supplies',
      type: 'business',
      email: 'orders@dilistationary.tl',
      phone: '+670 3324 1234',
      address: 'Rua de Kolmera, Colmera',
      city: 'Dili',
      tin: 'TL-201234567',
      notes: 'Fornecedor prinsipal materiais escritoriu',
      isActive: true,
    },
    {
      id: 'vend-002',
      name: 'EDTL (Electricidade de Timor-Leste)',
      type: 'business',
      email: 'atendimento@edtl.tl',
      phone: '+670 3310 0000',
      address: 'Avenida de Portugal, Mandarin',
      city: 'Dili',
      tin: 'TL-GOV-EDTL',
      notes: 'Fornecedor eletrisidade estatal',
      isActive: true,
    },
    {
      id: 'vend-003',
      name: 'Timor Telecom',
      type: 'business',
      email: 'negosiu@timortelecom.tl',
      phone: '+670 3312 1212',
      address: 'Rua de Comoro, Comoro',
      city: 'Dili',
      tin: 'TL-202345678',
      notes: 'Internet no telefone',
      isActive: true,
    },
    {
      id: 'vend-004',
      name: 'Telemor',
      type: 'business',
      email: 'bisnis@telemor.tl',
      phone: '+670 3313 1313',
      address: 'Farol, Dili',
      city: 'Dili',
      tin: 'TL-203456789',
      notes: 'Servisu telekomunikasaun',
      isActive: true,
    },
    {
      id: 'vend-005',
      name: 'Loja Cristal',
      type: 'business',
      email: 'vendas@lojacristal.tl',
      phone: '+670 7745 6789',
      address: 'Mercado Tais, Taibessi',
      city: 'Dili',
      tin: 'TL-204567890',
      notes: 'Ekipamentu escritoriu no eletroniku',
      isActive: true,
    },
    {
      id: 'vend-006',
      name: 'Furak Catering',
      type: 'business',
      email: 'katering@furak.tl',
      phone: '+670 7756 7890',
      address: 'Rua de Lecidere, Motael',
      city: 'Dili',
      tin: 'TL-205678901',
      notes: 'Katering ba eventu no escritoriu',
      isActive: true,
    },
    {
      id: 'vend-007',
      name: 'Imobiliaria Rai Doben',
      type: 'business',
      email: 'aluguer@raidoben.tl',
      phone: '+670 3325 7890',
      address: 'Avenida Bispo de Medeiros, Farol',
      city: 'Dili',
      tin: 'TL-206789012',
      notes: 'Proprietariu espasu escritoriu',
      isActive: true,
    },
    {
      id: 'vend-008',
      name: 'Pertamina Timor',
      type: 'business',
      email: 'comercial@pertaminatl.tl',
      phone: '+670 3326 8901',
      address: 'Estrada de Aeroporto, Comoro',
      city: 'Dili',
      tin: 'TL-207890123',
      notes: 'Kombustivel no lubrifikante',
      isActive: true,
    },
  ],

  // ============ INVOICES ============
  invoices: [
    {
      id: 'inv-001',
      invoiceNumber: 'INV-2026-001',
      customerId: 'cust-001',
      customerName: 'Hotel Timor',
      customerEmail: 'kontabilidade@hoteltimor.tl',
      customerPhone: '+670 3321 2233',
      customerAddress: 'Avenida Presidente Nicolau Lobato, Lahane, Dili',
      issueDate: subtractDays(TODAY, 45),
      dueDate: subtractDays(TODAY, 15),
      items: [
        { id: 'item-1', description: 'Servisu Konsultoria RH - Dezembru', quantity: 1, unitPrice: 2500, amount: 2500 },
        { id: 'item-2', description: 'Prosesamentu Salariu', quantity: 1, unitPrice: 500, amount: 500 },
      ],
      subtotal: 3000,
      taxRate: 0,
      taxAmount: 0,
      total: 3000,
      status: 'overdue',
      amountPaid: 0,
      balanceDue: 3000,
      notes: 'Servisu RH mensal',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
    {
      id: 'inv-002',
      invoiceNumber: 'INV-2026-002',
      customerId: 'cust-002',
      customerName: 'Kmanek Trading',
      customerEmail: 'finansas@kmanektrading.tl',
      customerPhone: '+670 3322 4455',
      customerAddress: 'Rua de Caicoli, Vera Cruz, Dili',
      issueDate: subtractDays(TODAY, 30),
      dueDate: TODAY,
      items: [
        { id: 'item-1', description: 'Programa Treinamentu Funcionariu', quantity: 2, unitPrice: 800, amount: 1600 },
      ],
      subtotal: 1600,
      taxRate: 0,
      taxAmount: 0,
      total: 1600,
      status: 'sent',
      amountPaid: 0,
      balanceDue: 1600,
      notes: 'Treinamentu ba lokasaun 2',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
    {
      id: 'inv-003',
      invoiceNumber: 'INV-2026-003',
      customerId: 'cust-003',
      customerName: 'Loja Lita',
      customerEmail: 'lojalita@gmail.com',
      customerPhone: '+670 7712 9876',
      customerAddress: 'Toko Baru, Taibessi, Dili',
      issueDate: subtractDays(TODAY, 60),
      dueDate: subtractDays(TODAY, 30),
      items: [
        { id: 'item-1', description: 'Servisu Kontabilidade - Q4', quantity: 1, unitPrice: 450, amount: 450 },
      ],
      subtotal: 450,
      taxRate: 0,
      taxAmount: 0,
      total: 450,
      status: 'paid',
      amountPaid: 450,
      balanceDue: 0,
      notes: 'Kontabilidade trimestral',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
      paidAt: Timestamp.fromDate(new Date(subtractDays(TODAY, 25))),
    },
    {
      id: 'inv-004',
      invoiceNumber: 'INV-2026-004',
      customerId: 'cust-004',
      customerName: 'Mateus Boavida',
      customerEmail: 'mateus.boavida@gmail.com',
      customerPhone: '+670 7723 4567',
      customerAddress: 'Aldeia Mascarenhas, Cristo Rei, Dili',
      issueDate: subtractDays(TODAY, 10),
      dueDate: addDays(TODAY, 20),
      items: [
        { id: 'item-1', description: 'Revisaun Dokumentu Kontratu', quantity: 3, unitPrice: 150, amount: 450 },
      ],
      subtotal: 450,
      taxRate: 0,
      taxAmount: 0,
      total: 450,
      status: 'sent',
      amountPaid: 0,
      balanceDue: 450,
      notes: 'Revisaun dokumentu legal',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
    {
      id: 'inv-005',
      invoiceNumber: 'INV-2026-005',
      customerId: 'cust-005',
      customerName: 'Haksolok Konstrusaun Lda',
      customerEmail: 'fatura@haksolok.tl',
      customerPhone: '+670 3323 6677',
      customerAddress: 'Zona Industrial Hera, Dili',
      issueDate: subtractDays(TODAY, 5),
      dueDate: addDays(TODAY, 25),
      items: [
        { id: 'item-1', description: 'Auditoria Seguransa Servisu', quantity: 1, unitPrice: 1800, amount: 1800 },
        { id: 'item-2', description: 'Treinamentu Empregadu - Seguransa', quantity: 15, unitPrice: 50, amount: 750 },
      ],
      subtotal: 2550,
      taxRate: 0,
      taxAmount: 0,
      total: 2550,
      status: 'draft',
      amountPaid: 0,
      balanceDue: 2550,
      notes: 'Pakote seguransa servisu',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
    {
      id: 'inv-006',
      invoiceNumber: 'INV-2026-006',
      customerId: 'cust-006',
      customerName: 'Cooperativa Café Timor',
      customerEmail: 'admin@cafetimorcoop.tl',
      customerPhone: '+670 3324 7788',
      customerAddress: 'Estrada de Aileu, Dare, Dili',
      issueDate: subtractDays(TODAY, 20),
      dueDate: addDays(TODAY, 10),
      items: [
        { id: 'item-1', description: 'Preparasaun Relatoriu Exportasaun', quantity: 1, unitPrice: 600, amount: 600 },
        { id: 'item-2', description: 'Servisu Tradusaun Dokumentu', quantity: 5, unitPrice: 80, amount: 400 },
      ],
      subtotal: 1000,
      taxRate: 0,
      taxAmount: 0,
      total: 1000,
      status: 'sent',
      amountPaid: 0,
      balanceDue: 1000,
      notes: 'Suporta exportasaun kafé',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
    {
      id: 'inv-007',
      invoiceNumber: 'INV-2026-007',
      customerId: 'cust-007',
      customerName: 'Restaurante Dilicious',
      customerEmail: 'info@dilicious.tl',
      customerPhone: '+670 7734 8899',
      customerAddress: 'Rua de Kolmera, Colmera, Dili',
      issueDate: subtractDays(TODAY, 35),
      dueDate: subtractDays(TODAY, 5),
      items: [
        { id: 'item-1', description: 'Setup Sistema POS', quantity: 1, unitPrice: 350, amount: 350 },
        { id: 'item-2', description: 'Treinamentu Sistema', quantity: 2, unitPrice: 100, amount: 200 },
      ],
      subtotal: 550,
      taxRate: 0,
      taxAmount: 0,
      total: 550,
      status: 'partial',
      amountPaid: 300,
      balanceDue: 250,
      notes: 'Implementasaun sistema foun',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
    {
      id: 'inv-008',
      invoiceNumber: 'INV-2026-008',
      customerId: 'cust-008',
      customerName: 'Naroman Printing',
      customerEmail: 'orders@naromanprint.tl',
      customerPhone: '+670 3325 9900',
      customerAddress: 'Rua de Lecidere, Bairo Pite, Dili',
      issueDate: subtractDays(TODAY, 15),
      dueDate: addDays(TODAY, 15),
      items: [
        { id: 'item-1', description: 'Dezenu Logo no Branding', quantity: 1, unitPrice: 800, amount: 800 },
      ],
      subtotal: 800,
      taxRate: 0,
      taxAmount: 0,
      total: 800,
      status: 'sent',
      amountPaid: 0,
      balanceDue: 800,
      notes: 'Projetu rebranding',
      terms: 'Pagamentu iha loron 30',
      currency: 'USD',
    },
  ],

  // ============ BILLS ============
  bills: [
    {
      id: 'bill-001',
      billNumber: 'EDTL-JAN-2026',
      vendorId: 'vend-002',
      vendorName: 'EDTL (Electricidade de Timor-Leste)',
      billDate: subtractDays(TODAY, 20),
      dueDate: subtractDays(TODAY, 5),
      description: 'Eletrisidade - Janeiru 2026',
      amount: 320,
      taxAmount: 0,
      total: 320,
      status: 'overdue',
      amountPaid: 0,
      balanceDue: 320,
      category: 'utilities',
      notes: 'Konta eletrisidade escritoriu',
    },
    {
      id: 'bill-002',
      billNumber: 'TT-DEZ-2025',
      vendorId: 'vend-003',
      vendorName: 'Timor Telecom',
      billDate: subtractDays(TODAY, 15),
      dueDate: addDays(TODAY, 5),
      description: 'Internet & Telefone - Dezembru 2025',
      amount: 185,
      taxAmount: 0,
      total: 185,
      status: 'pending',
      amountPaid: 0,
      balanceDue: 185,
      category: 'communication',
      notes: 'Servisu telekomunikasaun mensal',
    },
    {
      id: 'bill-003',
      billNumber: 'ALUGUER-JAN-2026',
      vendorId: 'vend-007',
      vendorName: 'Imobiliaria Rai Doben',
      billDate: subtractDays(TODAY, 30),
      dueDate: subtractDays(TODAY, 25),
      description: 'Aluguer Escritoriu - Janeiru 2026',
      amount: 1500,
      taxAmount: 0,
      total: 1500,
      status: 'paid',
      amountPaid: 1500,
      balanceDue: 0,
      category: 'rent',
      notes: 'Aluguer escritoriu mensal',
      paidAt: Timestamp.fromDate(new Date(subtractDays(TODAY, 28))),
    },
    {
      id: 'bill-004',
      billNumber: 'DSS-001-2026',
      vendorId: 'vend-001',
      vendorName: 'Dili Stationary & Office Supplies',
      billDate: subtractDays(TODAY, 7),
      dueDate: addDays(TODAY, 23),
      description: 'Materiais Escritoriu - Ordem #001',
      amount: 245,
      taxAmount: 0,
      total: 245,
      status: 'pending',
      amountPaid: 0,
      balanceDue: 245,
      category: 'supplies',
      notes: 'Papel impresora, toner, material eskrita',
    },
    {
      id: 'bill-005',
      billNumber: 'FK-KATERING-JAN',
      vendorId: 'vend-006',
      vendorName: 'Furak Catering',
      billDate: subtractDays(TODAY, 3),
      dueDate: addDays(TODAY, 12),
      description: 'Almossu Ekipa - Enkontru Janeiru',
      amount: 180,
      taxAmount: 0,
      total: 180,
      status: 'pending',
      amountPaid: 0,
      balanceDue: 180,
      category: 'meals',
      notes: 'Katering ba enkontru ekipa mensal',
    },
    {
      id: 'bill-006',
      billNumber: 'TM-JAN-2026',
      vendorId: 'vend-004',
      vendorName: 'Telemor',
      billDate: subtractDays(TODAY, 12),
      dueDate: addDays(TODAY, 18),
      description: 'Pacote Dados Movel - Janeiru 2026',
      amount: 95,
      taxAmount: 0,
      total: 95,
      status: 'pending',
      amountPaid: 0,
      balanceDue: 95,
      category: 'communication',
      notes: 'Dados internet movel ba ekipa vendas',
    },
    {
      id: 'bill-007',
      billNumber: 'PTL-JAN-2026',
      vendorId: 'vend-008',
      vendorName: 'Pertamina Timor',
      billDate: subtractDays(TODAY, 5),
      dueDate: addDays(TODAY, 10),
      description: 'Kombustivel Karru Kompania - Janeiru',
      amount: 250,
      taxAmount: 0,
      total: 250,
      status: 'pending',
      amountPaid: 0,
      balanceDue: 250,
      category: 'fuel',
      notes: 'Gasolina ba viaturas kompania',
    },
    {
      id: 'bill-008',
      billNumber: 'LC-002-2026',
      vendorId: 'vend-005',
      vendorName: 'Loja Cristal',
      billDate: subtractDays(TODAY, 18),
      dueDate: subtractDays(TODAY, 3),
      description: 'Komputador Laptop Dell',
      amount: 890,
      taxAmount: 0,
      total: 890,
      status: 'overdue',
      amountPaid: 0,
      balanceDue: 890,
      category: 'equipment',
      notes: 'Laptop foun ba empregadu IT',
    },
  ],

  // ============ EXPENSES ============
  expenses: [
    {
      id: 'exp-001',
      date: subtractDays(TODAY, 12),
      description: 'Mikrolet ba enkontru kliente - Hotel Timor',
      amount: 5,
      category: 'transport',
      vendorId: '',
      vendorName: '',
      paymentMethod: 'cash',
      notes: 'Enkontru ho Hotel Timor',
    },
    {
      id: 'exp-002',
      date: subtractDays(TODAY, 8),
      description: 'Gasolina ba viatura kompania',
      amount: 85,
      category: 'fuel',
      vendorId: 'vend-008',
      vendorName: 'Pertamina Timor',
      paymentMethod: 'cash',
      notes: 'Kombustivel mensal',
    },
    {
      id: 'exp-003',
      date: subtractDays(TODAY, 5),
      description: 'Almossu negosiu ho kliente',
      amount: 45,
      category: 'meals',
      vendorId: '',
      vendorName: 'Restaurante Diya',
      paymentMethod: 'bank_transfer',
      notes: 'Almossu ho Kmanek Trading',
    },
    {
      id: 'exp-004',
      date: subtractDays(TODAY, 2),
      description: 'Renovasaun dominiu - onit.tl',
      amount: 25,
      category: 'communication',
      vendorId: '',
      vendorName: 'Timor Registry',
      paymentMethod: 'bank_transfer',
      notes: 'Registrasaun dominiu anual',
    },
    {
      id: 'exp-005',
      date: subtractDays(TODAY, 15),
      description: 'Fotokopia dokumentu legal',
      amount: 12,
      category: 'supplies',
      vendorId: '',
      vendorName: 'Copy Center Kolmera',
      paymentMethod: 'cash',
      notes: 'Dokumentu ba kliente',
    },
    {
      id: 'exp-006',
      date: subtractDays(TODAY, 10),
      description: 'Taxa parkamentu aeroportu',
      amount: 8,
      category: 'transport',
      vendorId: '',
      vendorName: '',
      paymentMethod: 'cash',
      notes: 'Hasoru kliente iha aeroportu',
    },
    {
      id: 'exp-007',
      date: subtractDays(TODAY, 6),
      description: 'Kafé no lanxe ba enkontru',
      amount: 25,
      category: 'meals',
      vendorId: '',
      vendorName: 'Cafe Brisa Mar',
      paymentMethod: 'cash',
      notes: 'Enkontru ekipa',
    },
  ],

  // ============ PAYMENTS RECEIVED ============
  paymentsReceived: [
    {
      id: 'pay-001',
      date: subtractDays(TODAY, 25),
      customerId: 'cust-003',
      customerName: 'Loja Lita',
      invoiceId: 'inv-003',
      invoiceNumber: 'INV-2026-003',
      amount: 450,
      method: 'bank_transfer',
      reference: 'BNU-20260105-001',
      notes: 'Pagamentu kompletu ba kontabilidade Q4',
    },
    {
      id: 'pay-002',
      date: subtractDays(TODAY, 10),
      customerId: 'cust-007',
      customerName: 'Restaurante Dilicious',
      invoiceId: 'inv-007',
      invoiceNumber: 'INV-2026-007',
      amount: 300,
      method: 'cash',
      reference: 'CASH-20260109',
      notes: 'Pagamentu parsial - Setup POS',
    },
  ],

  // ============ BILL PAYMENTS ============
  billPayments: [
    {
      id: 'bpay-001',
      billId: 'bill-003',
      date: subtractDays(TODAY, 28),
      amount: 1500,
      method: 'bank_transfer',
      reference: 'BNU-20260102-ALUGUER',
      notes: 'Pagamentu aluguer Janeiru',
    },
  ],

  // ============ INVOICE SETTINGS ============
  invoiceSettings: {
    prefix: 'INV',
    nextNumber: 9,
    defaultTaxRate: 0,
    defaultTerms: 'Pagamentu iha loron 30',
    defaultNotes: 'Obrigadu barak ba ita-nia negosiu',
    defaultDueDays: 30,
    companyName: 'OniT Servisu Negosiu',
    companyAddress: 'Rua de Caicoli, Vera Cruz, Dili, Timor-Leste',
    companyPhone: '+670 3320 1234',
    companyEmail: 'fatura@onit.tl',
    companyTin: 'TL-100123456',
    bankName: 'BNU Timor-Leste',
    bankAccountName: 'OniT Servisu Negosiu Lda',
    bankAccountNumber: '0001-2345-6789-01',
  },

  // ============ CHART OF ACCOUNTS ============
  accounts: [
    // ASSETS
    { code: '1000', name: 'Current Assets', nameTL: 'Ativos Correntes', type: 'asset', subType: 'other_asset', isSystem: true, isActive: true, level: 1 },
    { code: '1100', name: 'Cash and Cash Equivalents', nameTL: 'Kaixa no Ekivalentes', type: 'asset', subType: 'cash', isSystem: true, isActive: true, parentCode: '1000', level: 2 },
    { code: '1110', name: 'Cash on Hand', nameTL: 'Kaixa', type: 'asset', subType: 'cash', description: 'Petty cash', isSystem: false, isActive: true, parentCode: '1100', level: 3 },
    { code: '1120', name: 'Cash in Bank - Operating', nameTL: 'Banku - Operasaun', type: 'asset', subType: 'bank', description: 'BNU Operating Account', isSystem: true, isActive: true, parentCode: '1100', level: 3 },
    { code: '1130', name: 'Cash in Bank - Payroll', nameTL: 'Banku - Pagamentu Saláriu', type: 'asset', subType: 'bank', description: 'Payroll disbursements', isSystem: true, isActive: true, parentCode: '1100', level: 3 },
    { code: '1200', name: 'Accounts Receivable', nameTL: 'Kontas a Receber', type: 'asset', subType: 'accounts_receivable', isSystem: true, isActive: true, parentCode: '1000', level: 2 },
    { code: '1210', name: 'Trade Receivables', nameTL: 'Receivables Komersial', type: 'asset', subType: 'accounts_receivable', description: 'Customer balances', isSystem: false, isActive: true, parentCode: '1200', level: 3 },
    { code: '1220', name: 'Employee Advances', nameTL: 'Adiantamentu Empregadu', type: 'asset', subType: 'accounts_receivable', description: 'Salary advances', isSystem: true, isActive: true, parentCode: '1200', level: 3 },
    { code: '1300', name: 'Prepaid Expenses', nameTL: 'Despesas Antecipadas', type: 'asset', subType: 'prepaid_expense', isSystem: false, isActive: true, parentCode: '1000', level: 2 },
    { code: '1500', name: 'Fixed Assets', nameTL: 'Ativos Fixos', type: 'asset', subType: 'fixed_asset', isSystem: true, isActive: true, level: 1 },
    { code: '1530', name: 'Equipment', nameTL: 'Ekipamentu', type: 'asset', subType: 'fixed_asset', isSystem: false, isActive: true, parentCode: '1500', level: 2 },
    { code: '1540', name: 'Vehicles', nameTL: 'Veíkulu', type: 'asset', subType: 'fixed_asset', isSystem: false, isActive: true, parentCode: '1500', level: 2 },
    { code: '1550', name: 'Furniture and Fixtures', nameTL: 'Mobília', type: 'asset', subType: 'fixed_asset', isSystem: false, isActive: true, parentCode: '1500', level: 2 },
    { code: '1590', name: 'Accumulated Depreciation', nameTL: 'Depresiaun Akumulada', type: 'asset', subType: 'accumulated_depreciation', isSystem: true, isActive: true, parentCode: '1500', level: 2 },

    // LIABILITIES
    { code: '2000', name: 'Current Liabilities', nameTL: 'Passivos Correntes', type: 'liability', subType: 'other_liability', isSystem: true, isActive: true, level: 1 },
    { code: '2100', name: 'Accounts Payable', nameTL: 'Kontas a Pagar', type: 'liability', subType: 'accounts_payable', isSystem: true, isActive: true, parentCode: '2000', level: 2 },
    { code: '2110', name: 'Trade Payables', nameTL: 'Payables Komersial', type: 'liability', subType: 'accounts_payable', description: 'Vendor balances', isSystem: false, isActive: true, parentCode: '2100', level: 3 },
    { code: '2200', name: 'Payroll Liabilities', nameTL: 'Passivos Folha Pagamentu', type: 'liability', subType: 'salaries_payable', isSystem: true, isActive: true, parentCode: '2000', level: 2 },
    { code: '2210', name: 'Salaries Payable', nameTL: 'Saláriu a Pagar', type: 'liability', subType: 'salaries_payable', description: 'Net salaries owed', isSystem: true, isActive: true, parentCode: '2200', level: 3 },
    { code: '2220', name: 'Withholding Income Tax (WIT)', nameTL: 'Impostu Retidu (WIT)', type: 'liability', subType: 'tax_payable', description: 'Employee tax withholdings', isSystem: true, isActive: true, parentCode: '2200', level: 3 },
    { code: '2230', name: 'INSS Payable - Employee', nameTL: 'INSS a Pagar - Trabalhador', type: 'liability', subType: 'inss_payable', description: 'Employee INSS 4%', isSystem: true, isActive: true, parentCode: '2200', level: 3 },
    { code: '2240', name: 'INSS Payable - Employer', nameTL: 'INSS a Pagar - Empregador', type: 'liability', subType: 'inss_payable', description: 'Employer INSS 6%', isSystem: true, isActive: true, parentCode: '2200', level: 3 },
    { code: '2250', name: 'Subsidio Anual Accrued', nameTL: 'Subsídiu Anual Akumuladu', type: 'liability', subType: 'accrued_expense', description: '13th month accrual', isSystem: true, isActive: true, parentCode: '2200', level: 3 },
    { code: '2400', name: 'Accrued Expenses', nameTL: 'Despesas Akumuladas', type: 'liability', subType: 'accrued_expense', isSystem: false, isActive: true, parentCode: '2000', level: 2 },
    { code: '2500', name: 'Long-term Liabilities', nameTL: 'Passivos Longu Prazu', type: 'liability', subType: 'loans_payable', isSystem: true, isActive: true, level: 1 },

    // EQUITY
    { code: '3000', name: 'Equity', nameTL: 'Capital Própriu', type: 'equity', subType: 'owner_equity', isSystem: true, isActive: true, level: 1 },
    { code: '3100', name: 'Share Capital', nameTL: 'Capital Social', type: 'equity', subType: 'share_capital', description: 'Invested capital', isSystem: true, isActive: true, parentCode: '3000', level: 2 },
    { code: '3200', name: 'Retained Earnings', nameTL: 'Lucros Retidos', type: 'equity', subType: 'retained_earnings', description: 'Accumulated profits', isSystem: true, isActive: true, parentCode: '3000', level: 2 },
    { code: '3300', name: 'Current Year Earnings', nameTL: 'Lucros Tinan Atual', type: 'equity', subType: 'retained_earnings', description: 'Net income for current year', isSystem: true, isActive: true, parentCode: '3000', level: 2 },

    // REVENUE
    { code: '4000', name: 'Revenue', nameTL: 'Receitas', type: 'revenue', subType: 'service_revenue', isSystem: true, isActive: true, level: 1 },
    { code: '4100', name: 'Service Revenue', nameTL: 'Receita Servisu', type: 'revenue', subType: 'service_revenue', description: 'Revenue from services', isSystem: true, isActive: true, parentCode: '4000', level: 2 },
    { code: '4120', name: 'Consulting Revenue', nameTL: 'Receita Konsultoria', type: 'revenue', subType: 'service_revenue', isSystem: false, isActive: true, parentCode: '4100', level: 3 },
    { code: '4200', name: 'Sales Revenue', nameTL: 'Receita Vendas', type: 'revenue', subType: 'sales_revenue', isSystem: false, isActive: true, parentCode: '4000', level: 2 },
    { code: '4300', name: 'Other Income', nameTL: 'Rendimentu Seluk', type: 'revenue', subType: 'other_income', isSystem: false, isActive: true, parentCode: '4000', level: 2 },

    // EXPENSES
    { code: '5000', name: 'Expenses', nameTL: 'Despesas', type: 'expense', subType: 'other_expense', isSystem: true, isActive: true, level: 1 },
    { code: '5100', name: 'Payroll Expenses', nameTL: 'Despesas Folha Pagamentu', type: 'expense', subType: 'salary_expense', isSystem: true, isActive: true, parentCode: '5000', level: 2 },
    { code: '5110', name: 'Salaries and Wages', nameTL: 'Saláriu no Vensimentu', type: 'expense', subType: 'salary_expense', description: 'Gross salaries', isSystem: true, isActive: true, parentCode: '5100', level: 3 },
    { code: '5120', name: 'Overtime Pay', nameTL: 'Pagamentu Oras Extra', type: 'expense', subType: 'salary_expense', isSystem: false, isActive: true, parentCode: '5100', level: 3 },
    { code: '5130', name: 'Bonuses', nameTL: 'Bónus', type: 'expense', subType: 'salary_expense', isSystem: false, isActive: true, parentCode: '5100', level: 3 },
    { code: '5140', name: 'Subsidio Anual Expense', nameTL: 'Despesa Subsídiu Anual', type: 'expense', subType: 'salary_expense', description: '13th month salary', isSystem: true, isActive: true, parentCode: '5100', level: 3 },
    { code: '5150', name: 'INSS Employer Contribution', nameTL: 'Kontribuisaun INSS Empregador', type: 'expense', subType: 'inss_expense', description: 'Employer 6% INSS', isSystem: true, isActive: true, parentCode: '5100', level: 3 },
    { code: '5160', name: 'Employee Benefits', nameTL: 'Benefísiu Empregadu', type: 'expense', subType: 'salary_expense', isSystem: false, isActive: true, parentCode: '5100', level: 3 },
    { code: '5200', name: 'Rent Expense', nameTL: 'Despesa Renda', type: 'expense', subType: 'rent_expense', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5300', name: 'Utilities Expense', nameTL: 'Despesa Utilidades', type: 'expense', subType: 'utilities_expense', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5310', name: 'Electricity', nameTL: 'Eletrisidade', type: 'expense', subType: 'utilities_expense', isSystem: false, isActive: true, parentCode: '5300', level: 3 },
    { code: '5330', name: 'Telephone and Internet', nameTL: 'Telefone no Internet', type: 'expense', subType: 'utilities_expense', isSystem: false, isActive: true, parentCode: '5300', level: 3 },
    { code: '5400', name: 'Office Supplies', nameTL: 'Material Eskritóriu', type: 'expense', subType: 'office_supplies', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5500', name: 'Transportation Expense', nameTL: 'Despesa Transporte', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5510', name: 'Fuel', nameTL: 'Kombustivel', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5500', level: 3 },
    { code: '5600', name: 'Professional Services', nameTL: 'Servisu Profisional', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5700', name: 'Insurance Expense', nameTL: 'Despesa Seguru', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5800', name: 'Depreciation Expense', nameTL: 'Despesa Depresiaun', type: 'expense', subType: 'depreciation_expense', isSystem: true, isActive: true, parentCode: '5000', level: 2 },
    { code: '5900', name: 'Other Expenses', nameTL: 'Despesa Seluk', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5000', level: 2 },
    { code: '5910', name: 'Bank Charges', nameTL: 'Taxa Banku', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5900', level: 3 },
    { code: '5920', name: 'Licenses and Permits', nameTL: 'Lisensa no Permit', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5900', level: 3 },
    { code: '5930', name: 'Meals and Entertainment', nameTL: 'Han no Entertainment', type: 'expense', subType: 'other_expense', isSystem: false, isActive: true, parentCode: '5900', level: 3 },
  ],

  // ============ FISCAL YEAR ============
  fiscalYear: {
    id: 'fy-2026',
    year: 2026,
    name: 'Fiscal Year 2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'open',
  },
};

// ===========================================
// SEED FUNCTIONS
// ===========================================

async function seedTenantData(tenantId) {
  console.log(`\n🌱 Seeding data for tenant: ${tenantId}`);
  const now = Timestamp.now();

  // Seed Departments
  console.log('   📁 Seeding departments...');
  for (const dept of SEED_DATA.departments) {
    await db.doc(`tenants/${tenantId}/departments/${dept.id}`).set({
      ...dept,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.departments.length} departments`);

  // Seed Employees
  console.log('   👥 Seeding employees...');
  for (const emp of SEED_DATA.employees) {
    await db.doc(`tenants/${tenantId}/employees/${emp.id}`).set({
      ...emp,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.employees.length} employees`);

  // Seed Customers
  console.log('   🏢 Seeding customers...');
  for (const cust of SEED_DATA.customers) {
    await db.doc(`tenants/${tenantId}/customers/${cust.id}`).set({
      ...cust,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.customers.length} customers`);

  // Seed Vendors
  console.log('   🏪 Seeding vendors...');
  for (const vend of SEED_DATA.vendors) {
    await db.doc(`tenants/${tenantId}/vendors/${vend.id}`).set({
      ...vend,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.vendors.length} vendors`);

  // Seed Invoices
  console.log('   📄 Seeding invoices...');
  for (const inv of SEED_DATA.invoices) {
    await db.doc(`tenants/${tenantId}/invoices/${inv.id}`).set({
      ...inv,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.invoices.length} invoices`);

  // Seed Bills
  console.log('   🧾 Seeding bills...');
  for (const bill of SEED_DATA.bills) {
    await db.doc(`tenants/${tenantId}/bills/${bill.id}`).set({
      ...bill,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.bills.length} bills`);

  // Seed Expenses
  console.log('   💸 Seeding expenses...');
  for (const exp of SEED_DATA.expenses) {
    await db.doc(`tenants/${tenantId}/expenses/${exp.id}`).set({
      ...exp,
      tenantId,
      createdAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.expenses.length} expenses`);

  // Seed Payments Received
  console.log('   💰 Seeding payments received...');
  for (const pay of SEED_DATA.paymentsReceived) {
    await db.doc(`tenants/${tenantId}/payments_received/${pay.id}`).set({
      ...pay,
      tenantId,
      createdAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.paymentsReceived.length} payments received`);

  // Seed Bill Payments
  console.log('   💳 Seeding bill payments...');
  for (const bpay of SEED_DATA.billPayments) {
    await db.doc(`tenants/${tenantId}/bill_payments/${bpay.id}`).set({
      ...bpay,
      tenantId,
      createdAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.billPayments.length} bill payments`);

  // Seed Invoice Settings
  console.log('   ⚙️  Seeding invoice settings...');
  await db.doc(`tenants/${tenantId}/settings/invoice_settings`).set({
    ...SEED_DATA.invoiceSettings,
    updatedAt: now,
  });
  console.log('      ✓ Created invoice settings');

  // Seed Chart of Accounts
  console.log('   📊 Seeding chart of accounts...');
  for (const acc of SEED_DATA.accounts) {
    const accId = `acc-${acc.code}`;
    await db.doc(`tenants/${tenantId}/accounts/${accId}`).set({
      ...acc,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_DATA.accounts.length} accounts`);

  // Seed Fiscal Year
  console.log('   📅 Seeding fiscal year...');
  await db.doc(`tenants/${tenantId}/fiscalYears/${SEED_DATA.fiscalYear.id}`).set({
    ...SEED_DATA.fiscalYear,
    createdAt: now,
    updatedAt: now,
  });
  console.log('      ✓ Created fiscal year 2026');

  // Seed Accounting Settings
  console.log('   ⚙️  Seeding accounting settings...');
  await db.doc(`tenants/${tenantId}/settings/accounting`).set({
    defaultCurrency: 'USD',
    fiscalYearStart: '01-01',
    currentFiscalYear: 2026,
    accountingMethod: 'accrual',
    autoPostPayrollJournals: true,
    updatedAt: now,
  });
  console.log('      ✓ Created accounting settings');

  // Update tenant config
  console.log('   🏠 Updating tenant config...');
  await db.doc(`tenants/${tenantId}`).set({
    id: tenantId,
    name: 'OniT Business Services',
    status: 'active',
    plan: 'professional',
    features: {
      hiring: true,
      timeleave: true,
      performance: true,
      payroll: true,
      reports: true,
    },
    settings: {
      timezone: 'Asia/Dili',
      currency: 'USD',
      dateFormat: 'DD/MM/YYYY',
    },
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  console.log('      ✓ Updated tenant config');

  // Seed Members (admin user)
  console.log('   👤 Seeding members...');
  const SEED_MEMBERS = [
    {
      uid: 'fgxScvArI0PEPLfSfbnPIIjzJsa2',
      email: 'admin@company.com',
      displayName: 'Admin User',
      role: 'owner',
      status: 'active',
    },
  ];
  for (const member of SEED_MEMBERS) {
    await db.doc(`tenants/${tenantId}/members/${member.uid}`).set({
      ...member,
      tenantId,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`      ✓ Created ${SEED_MEMBERS.length} members`);
}

// ===========================================
// MAIN EXECUTION
// ===========================================

async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  🔥 PRODUCTION DATABASE CLEAR & SEED TOOL');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`\n⚠️  WARNING: This will DELETE ALL DATA for tenant "${TENANT_ID}"`);
  console.log('   in the PRODUCTION Firebase database!');
  console.log('\n   This includes:');
  console.log('   - All employees, departments, and positions');
  console.log('   - All customers, vendors, invoices, and bills');
  console.log('   - All payroll records and settings');
  console.log('   - All other tenant data\n');

  const answer = await new Promise(resolve => {
    rl.question('Type "CONFIRM" to proceed: ', resolve);
  });
  rl.close();

  if (answer !== 'CONFIRM') {
    console.log('\n❌ Operation cancelled.\n');
    process.exit(0);
  }

  console.log('\n🚀 Starting clear and seed process...');

  try {
    // Step 1: Clear tenant data
    await clearTenantData(TENANT_ID);

    // Step 2: Clear root-level collections
    await clearRootCollections();

    // Step 3: Seed fresh data
    await seedTenantData(TENANT_ID);

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  ✅ CLEAR AND SEED COMPLETED SUCCESSFULLY!');
    console.log('════════════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log(`   - Departments: ${SEED_DATA.departments.length}`);
    console.log(`   - Employees: ${SEED_DATA.employees.length}`);
    console.log(`   - Customers: ${SEED_DATA.customers.length}`);
    console.log(`   - Vendors: ${SEED_DATA.vendors.length}`);
    console.log(`   - Invoices: ${SEED_DATA.invoices.length}`);
    console.log(`   - Bills: ${SEED_DATA.bills.length}`);
    console.log(`   - Expenses: ${SEED_DATA.expenses.length}`);
    console.log(`   - Payments Received: ${SEED_DATA.paymentsReceived.length}`);
    console.log(`   - Bill Payments: ${SEED_DATA.billPayments.length}`);
    console.log(`   - Chart of Accounts: ${SEED_DATA.accounts.length}`);
    console.log(`   - Fiscal Year: 2026`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error during clear and seed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
