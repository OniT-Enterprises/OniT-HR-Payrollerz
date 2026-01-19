#!/bin/bash

# Firebase Emulator startup script for OniT HR Payroll
# This script starts the Firebase emulators with custom port configuration
# Ports: Firestore 8081, Auth 9100, Emulator UI 4001
# Data folder: ./firebaseemulator_payroll/

echo "🚀 Starting Firebase Emulators..."
echo ""
echo "Configuration:"
echo "  • Firestore Emulator: http://127.0.0.1:8081"
echo "  • Auth Emulator: http://127.0.0.1:9100"
echo "  • Emulator UI: http://127.0.0.1:4001"
echo "  • Data folder: ./firebaseemulator_payroll/"
echo ""

firebase emulators:start --config firebase.dev.json --only auth,firestore --import=./firebaseemulator_payroll/ --export-on-exit

echo ""
echo "✅ Emulators stopped. Data saved to ./firebaseemulator_payroll/"
