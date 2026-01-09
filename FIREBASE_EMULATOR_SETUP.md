# Firebase Emulator Setup Guide

This guide explains how to set up and run Firebase emulators locally for the OniT HR Payroll application.

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`firebase --version` should return a version number)
- npm or yarn package manager

## Configuration

The emulators are configured with custom ports in `firebase.json`:

- **Firestore Emulator**: `http://127.0.0.1:8081`
- **Auth Emulator**: `http://127.0.0.1:9100`
- **Emulator UI**: `http://127.0.0.1:4001`
- **Data Folder**: `./firebaseemulator_payroll/`

## Setup Steps

### 1. Initialize Firebase Project (One-time setup)

If you haven't initialized Firebase CLI yet:

```bash
firebase init
```

This will create a `.firebaserc` file (if not already present).

### 2. Start the Development Server

In the first terminal, start the Vite + Express development server:

```bash
npm run dev
```

This will:
- Start the Vite frontend on `http://localhost:5173`
- Start the Express backend on `http://localhost:3000`

### 3. Start the Firebase Emulators

**Windows:**
```bash
.\start-emulators.bat
```

**macOS/Linux:**
```bash
./start-emulators.sh
chmod +x start-emulators.sh  # Only needed once
```

**Or use firebase CLI directly:**
```bash
firebase emulators:start --only auth,firestore --import=./firebaseemulator_payroll/ --export-on-exit
```

You should see output like:
```
✔ Firestore Emulator has started listening at 127.0.0.1:8081
✔ Auth Emulator has started listening at 127.0.0.1:9100
✔ Emulator UI is running at http://127.0.0.1:4001
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Emulator UI**: http://127.0.0.1:4001

## How It Works

### Client-Side (Frontend)

The `client/lib/firebase.ts` file:
1. Initializes Firebase with the project config
2. Detects development environment using `import.meta.env.DEV`
3. Automatically connects to the Firestore emulator (port 8081)
4. Automatically connects to the Auth emulator (port 9100)
5. No changes needed - works automatically in dev mode!

### Server-Side (Backend)

The application uses Express + SQLite during local development. Firebase emulators are primarily used for:
- User authentication testing
- Firestore data structure validation
- Migration planning to cloud Firebase

### Emulator Data Persistence

- Data is stored in `./firebaseemulator_payroll/` folder
- On startup: `--import=./firebaseemulator_payroll/` loads previous session data
- On shutdown: `--export-on-exit` saves current data for next session
- **Note**: Do not commit this folder to git (added to `.gitignore`)

## Using the Emulator UI

The Emulator UI provides a visual interface to:
- View Firestore collections and documents
- View Firebase Auth users
- Delete collections/documents
- Inspect authentication states

Access at: **http://127.0.0.1:4001**

## Logging In

Demo credentials:
- **Email**: `admin@onit.com` or `user@onit.com`
- **Password**: `admin123` or `user123`

For emulator testing:
- You can sign up new accounts directly (emulator allows any auth)
- Accounts are stored in the emulator data folder

## Troubleshooting

### Emulator won't start
```bash
# Make sure ports are available
# Check if port 8081 is in use:
lsof -i :8081          # macOS/Linux
netstat -ano | findstr :8081  # Windows

# Kill the process using the port and try again
```

### Connection refused errors
```bash
# Make sure emulator is running in another terminal
# Check that you see the startup messages:
# ✔ Firestore Emulator has started listening at 127.0.0.1:8081
# ✔ Auth Emulator has started listening at 127.0.0.1:9100
```

### Data persistence not working
```bash
# Create the data folder if it doesn't exist
mkdir firebaseemulator_payroll

# Then restart emulators with explicit path
firebase emulators:start --only auth,firestore --import=./firebaseemulator_payroll/ --export-on-exit
```

### Clear all emulator data
```bash
# Delete the data folder and restart
rm -rf firebaseemulator_payroll    # macOS/Linux
rmdir /s firebaseemulator_payroll  # Windows

# Restart emulators
firebase emulators:start --only auth,firestore --import=./firebaseemulator_payroll/ --export-on-exit
```

## Migration to Production Firebase

When ready to deploy to production with Google Cloud Firestore:

1. **Create a Google Cloud project** at https://console.cloud.google.com
2. **Update `client/lib/firebase.ts`**: Remove emulator connection code or use environment variables
3. **Deploy Firestore rules**: `firebase deploy --only firestore:rules`
4. **Export emulator data** (if needed for migration)
5. **Import to Cloud Firestore** using Firebase Admin SDK

See `DEPLOYMENT.md` for detailed migration instructions.

## Environment Variables

No environment variables are needed for local development with emulators.

For production, you would set:
```bash
VITE_USE_EMULATOR=false  # Optional, defaults to false in production
```

## Next Steps

- ✅ Emulators are now running locally
- ✅ Frontend automatically connects to emulators
- ✅ Data persists across sessions
- 📚 Learn about Firestore structure in `firestore.rules`
- 🚀 Plan migration to cloud Firebase (see `DEPLOYMENT.md`)

## Support

- Firebase Documentation: https://firebase.google.com/docs/emulator-suite
- Project Documentation: See `README.md` and `AGENTS.md`
