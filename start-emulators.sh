#!/bin/bash

# Firebase Emulator startup script for OniT HR Payroll
# This script starts the Firebase emulators with custom port configuration
# Ports: Firestore 8081, Auth 9100, Storage 9199, Emulator UI 4001
# Data folder: ./firebaseemulator_payroll/

echo "Starting Firebase Emulators..."
echo ""
echo "Configuration:"
echo "  - Firestore Emulator: http://localhost:8081"
echo "  - Auth Emulator: http://localhost:9100"
echo "  - Storage Emulator: http://localhost:9199"
echo "  - Emulator UI: http://localhost:4001"
echo "  - Data folder: ./firebaseemulator_payroll/"
echo ""

firebase emulators:start --config firebase.dev.json --only auth,firestore,storage --import=./firebaseemulator_payroll/ --export-on-exit

echo ""
echo "Emulators stopped. Data saved to ./firebaseemulator_payroll/"
