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
export * from "./chat";

// You can add more function modules here as they're created
