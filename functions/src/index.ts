import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// Import and export all function modules
export * from "./hiring";
export * from "./timeleave";
export * from "./payroll";
export * from "./tenant";
export * from "./admin";
export * from "./documentAlerts";
export * from "./money";
export * from "./chat";
export * from "./contracts";
export * from "./audit";
export * from "./billing";
export * from "./accountantPartners";
export * from "./email";
export * from "./authEmails";
export * from "./invoiceLinks";
export * from "./notifications";

// You can add more function modules here as they're created
