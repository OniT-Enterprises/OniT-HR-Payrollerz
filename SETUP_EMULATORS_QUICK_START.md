# Firebase Emulators - Quick Start (Windows/Mac/Linux)

## ✅ What's Been Done

1. **Created Animated Gear Icon** ⚙️
   - New component with gears orbiting around your avatar
   - Located in top-right corner of navigation
   - Changes color: Green (connected) or Red (disconnected)

2. **Updated Navigation**
   - Gear icon is now clickable → navigates to Settings page
   - No dropdown menu, pure page navigation
   - Shows connection status with color coding

3. **Set Up Firebase Emulators**
   - Configured `firebase.json` with custom ports
   - `Firestore: 8081 | Auth: 9100 | UI: 4001`
   - Auto-connect on app startup in dev mode
   - Data persists in `./firebaseemulator_payroll/`

4. **Created Helper Scripts**
   - Windows: `start-emulators.bat`
   - macOS/Linux: `start-emulators.sh`

## 🚀 Getting Started (3 Easy Steps)

### Step 1: Start the App

```bash
npm run dev
```

**In your first terminal** - This starts:
- ✅ Vite frontend on `http://localhost:5173`
- ✅ Express backend on `http://localhost:3000`

### Step 2: Start Firebase Emulators

**Open a SECOND terminal** and run:

**Windows (PowerShell):**
```powershell
.\start-emulators.bat
```

**macOS/Linux (Bash):**
```bash
chmod +x start-emulators.sh  # First time only
./start-emulators.sh
```

**Or use Firebase CLI directly (any OS):**
```bash
firebase emulators:start --only auth,firestore --import=./firebaseemulator_payroll/ --export-on-exit
```

You should see:
```
✔ Firestore Emulator has started listening at 127.0.0.1:8081
✔ Auth Emulator has started listening at 127.0.0.1:9100
✔ Emulator UI is running at http://127.0.0.1:4001
```

### Step 3: Open the App

Visit: **http://localhost:5173**

✅ App will auto-connect to emulators
✅ Gear icon will turn **GREEN** when connected
✅ Gear icon will turn **RED** if not connected

## 🎯 Test It Out

1. **See the Gear Icon**
   - Look at top-right corner
   - Should show your initials (e.g., "CD" for Celestino de Freitas)
   - Gears orbit around the avatar

2. **Click the Gear Icon**
   - Opens Settings page
   - Shows connection status

3. **Check Emulator UI**
   - Open: http://127.0.0.1:4001
   - View Firestore collections and Auth users
   - Delete data as needed

## 🔐 Demo Credentials

```
Email:    admin@onit.com
Password: admin123

or

Email:    user@onit.com
Password: user123
```

## 📊 File Locations

| File | Purpose |
|------|---------|
| `firebase.json` | Emulator config (ports, data folder) |
| `FIREBASE_EMULATOR_SETUP.md` | Detailed setup guide |
| `client/components/AnimatedGearIcon.tsx` | New gear icon component |
| `client/lib/firebase.ts` | Auto-connects to emulator |
| `firebaseemulator_payroll/` | Emulator data (auto-created) |

## ❌ Troubleshooting

**Emulator won't start?**
```bash
# Check if port is in use
# Windows: netstat -ano | findstr :8081
# Mac/Linux: lsof -i :8081

# Kill the process and try again
```

**Gear icon is RED (not connected)?**
- Make sure emulator is running in another terminal
- Check you see the ✔ messages above
- Refresh the page

**Data not persisting?**
```bash
# Create the data folder manually
mkdir firebaseemulator_payroll
# Then restart emulators
```

**Clear all data and start fresh?**
```bash
# Delete data folder
rm -rf firebaseemulator_payroll    # Mac/Linux
rmdir /s firebaseemulator_payroll  # Windows

# Restart emulators
firebase emulators:start --only auth,firestore --import=./firebaseemulator_payroll/ --export-on-exit
```

## 📚 Next Steps

1. ✅ **Emulators running** - You're ready to develop!
2. 📖 See `FIREBASE_EMULATOR_SETUP.md` for advanced config
3. 🚀 When ready, `DEPLOYMENT.md` covers production migration

## 💡 Tips

- Keep the emulator terminal open while developing
- Data auto-saves when you stop the emulator
- Emulator UI is great for debugging Firestore data
- Use Firestore rules in `firestore.rules` to test security

---

**Questions?** Check `FIREBASE_EMULATOR_SETUP.md` for detailed troubleshooting and advanced options.
