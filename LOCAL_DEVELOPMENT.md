# Local Development Guide - Payroll App Firebase Emulator

Complete guide for developing the OniT HR Payroll system with local Firebase Emulator isolated ports.

## ⚡ Quick Start (5 minutes)

### Terminal 1: Start Emulator UI
```bash
npm run emulators:ui
```

Expected output:
```
✔ Firestore Emulator has started listening at 127.0.0.1:8081
✔ Auth Emulator has started listening at 127.0.0.1:9100
✔ Emulator UI is running at http://localhost:4001
```

### Terminal 2: Start Development Server
```bash
npm run dev
```

App will be available at `http://localhost:8080` (or next available port)

### Terminal 3: Seed Test Data (Optional)
```bash
npm run seed:dev
```

Expected output:
```
🌱 Seeding Payroll Database with Test Data...
✅ Database seeding completed successfully!
📊 Test Data Summary:
   • Departments: 5
   • Employees: 5
   • Job Postings: 3
   • Payroll Records: 3
```

### 4. Open in Browser
- **App**: http://localhost:8080
- **Emulator UI**: http://localhost:4001
- **Login**: Use test credentials (see console after seed)

---

## 📊 Port Reference

| Service | Hotel App | Payroll App | Status |
|---------|-----------|-------------|--------|
| **Firestore** | 8080 | **8081** | ✓ Isolated |
| **Auth** | 9099 | **9100** | ✓ Isolated |
| **Emulator UI** | 4000 | **4001** | ✓ Isolated |
| **Data Directory** | `firebaseemulator/` | `firebaseemulator_payroll/` | ✓ Isolated |

---

## 💾 Data Persistence

### ✅ What Survives Emulator Restart
- All Firestore collections and documents
- Auth user accounts and credentials
- Data is saved to `./firebaseemulator_payroll/` folder
- Restart emulator with same data: `npm run emulators:ui`

### ❌ What Does NOT Survive
- This is purely **local development** (not synced to cloud)
- No automatic backup to Google Firebase
- Data is lost if `firebaseemulator_payroll/` folder is deleted

---

## 🧹 Reset Database

To delete all emulator data and start fresh:

```bash
npm run reset:emulator
```

Follow the prompt:
```
⚠️  This will DELETE all emulator data at:
C:\Users\celes\VBDB\OniT-HR-Payroll-2\firebaseemulator_payroll

Are you sure? (type "yes" to confirm):
```

After reset, restart emulator to create fresh empty database:
```bash
npm run emulators:ui
```

---

## 🚀 Running Both Apps Simultaneously

You can run **both Hotel Management and Payroll apps at the same time** on different ports without conflicts.

### Setup: 4 Terminals

**Terminal 1 - Hotel Emulator:**
```bash
cd C:\Users\celes\VBDB\OniT-Hotel-Management
npm run emulators:ui
→ UI: http://localhost:4000
```

**Terminal 2 - Payroll Emulator:**
```bash
cd C:\Users\celes\VBDB\OniT-HR-Payroll-2
npm run emulators:ui
→ UI: http://localhost:4001
```

**Terminal 3 - Hotel App:**
```bash
cd C:\Users\celes\VBDB\OniT-Hotel-Management
npm run dev
→ App: http://localhost:5173 (or assigned port)
```

**Terminal 4 - Payroll App:**
```bash
cd C:\Users\celes\VBDB\OniT-HR-Payroll-2
npm run dev
→ App: http://localhost:5174 (or assigned port)
```

### ✅ Verification Checklist

After starting both apps:

- [ ] Both emulators running (no port errors)
- [ ] Hotel app connects to Firestore 8080 + Auth 9099
- [ ] Payroll app connects to Firestore 8081 + Auth 9100
- [ ] Each app shows "Emulator Mode" or connection status indicator
- [ ] Hotel Emulator UI (localhost:4000) shows ONLY hotel data
- [ ] Payroll Emulator UI (localhost:4001) shows ONLY payroll data
- [ ] No data leakage between apps ✓

### 🎯 Data Isolation Test

1. Seed Payroll data: `npm run seed:dev` (in Payroll terminal)
2. Check Payroll Emulator UI (localhost:4001) → See departments, employees, jobs
3. Check Hotel Emulator UI (localhost:4000) → Should show ONLY hotel data
4. **Confirm:** Data is NOT leaking between apps ✓

---

## 🔧 Troubleshooting

### ❌ "Port 8081 already in use"

**Diagnosis:**
```powershell
# Windows - Find what's using port 8081
netstat -ano | findstr :8081

# Output example: TCP 127.0.0.1:8081 ESTABLISHED [PID]
```

**Solution:**
```powershell
# Kill the process (replace PID with actual number)
taskkill /PID 12345 /F

# Or: Change port in firebase.json and restart
```

**macOS/Linux:**
```bash
# Find process
lsof -i :8081

# Kill it
kill -9 <PID>
```

---

### ❌ Emulator won't connect

1. **Stop emulator** (Ctrl+C in terminal)
2. **Delete data folder**: `rm -rf firebaseemulator_payroll` (or via Windows explorer)
3. **Restart emulator**: `npm run emulators:ui`
4. Fresh database will be created

---

### ❌ "Already called" error

This message:
```
Error: FirebaseError: Storage: Firebase Storage v8.x.x Auth token set on a separate instance
[already called]
```

**Status:** ✓ Harmless warning during emulator initialization. Ignore it.

---

### ❌ App shows "Not Connected" (Red indicator)

**Check:**
1. Is emulator running? (See terminal for port 8081/9100 messages)
2. Refresh browser page
3. Check browser console for errors

**Solution:**
```bash
# Kill both emulator and app
# Restart in correct order:
npm run emulators:ui    # Terminal 1
npm run dev             # Terminal 2 (wait for emulator to fully start)
```

---

### ❌ Data didn't seed

**Check if emulator is running:**
```bash
# Terminal shows these messages?
✔ Firestore Emulator has started listening at 127.0.0.1:8081
✔ Auth Emulator has started listening at 127.0.0.1:9100
```

**If not running:**
```bash
# Start emulator first
npm run emulators:ui

# Then in another terminal
npm run seed:dev
```

---

## 📚 Configuration Files

| File | Purpose |
|------|---------|
| `firebase.json` | Emulator ports (8081/9100/4001), data dir |
| `.env.emulator` | Environment variables for emulator mode |
| `firestore.rules` | Firestore security rules (dev-friendly) |
| `scripts/resetEmulator.js` | Script to delete emulator data |
| `scripts/seedDatabase.js` | Script to populate test data |

---

## 🔄 Workflow Example

### Morning: Fresh Start
```bash
# Terminal 1
npm run emulators:ui

# Terminal 2 (wait 2 seconds for emulator to start)
npm run dev

# Terminal 3 (optional - only if you want fresh test data)
npm run reset:emulator
npm run seed:dev
```

### During Development
- Edit code → Hot reload (Vite handles it)
- Need fresh data? → `npm run reset:emulator` then `npm run seed:dev`
- Check data? → Open http://localhost:4001 (Emulator UI)

### End of Day
- Close terminals (Ctrl+C)
- Data auto-saves to `firebaseemulator_payroll/`
- Next day: Same process starts fresh with yesterday's data

---

## 📖 Next Steps

1. ✅ **Emulators running** - You're ready to develop!
2. 🌱 **Seeded test data** - departments, employees, jobs, payroll entries
3. 🔗 **Emulator UI accessible** - Monitor data at http://localhost:4001
4. 🚀 **Ready for production** - See `DEPLOYMENT.md` for cloud migration

---

## 💡 Tips & Best Practices

- **Keep emulator running** - Don't stop it during development; data persists
- **Check Emulator UI regularly** - Visual way to debug Firestore data
- **Reset before major testing** - `npm run reset:emulator` ensures clean state
- **Seed after reset** - `npm run seed:dev` repopulates test data
- **Use browser DevTools** - Check console for emulator connection logs
- **Firestore rules are dev-friendly** - Allows authenticated access; tighten for production

---

## ❓ Questions?

- **Emulator docs**: https://firebase.google.com/docs/emulator-suite
- **Firestore docs**: https://firebase.google.com/docs/firestore
- **Troubleshooting**: Check this file's troubleshooting section first

---

**You're all set! Happy developing! 🎉**
