const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_PATH = path.join(__dirname, '..', 'firebaseemulator_payroll');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const deleteFolder = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolder(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
};

const promptConfirmation = () => {
  rl.question(
    `\n⚠️  This will DELETE all emulator data at:\n${DATA_PATH}\n\nAre you sure? (type "yes" to confirm): `,
    (answer) => {
      if (answer.toLowerCase() === 'yes') {
        try {
          console.log('\n🗑️  Deleting emulator data...');
          deleteFolder(DATA_PATH);
          console.log('\n✅ Emulator data deleted successfully!');
          console.log('🔄 Restart the emulator to create fresh data: pnpm emulators:ui');
        } catch (error) {
          console.error('\n❌ Error deleting data:', error.message);
        }
      } else {
        console.log('\n❌ Operation cancelled.');
      }
      rl.close();
    },
  );
};

console.log('🧹 Firebase Emulator Data Reset Tool');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!fs.existsSync(DATA_PATH)) {
  console.log('ℹ️  No emulator data found at:');
  console.log(DATA_PATH);
  console.log('\n✅ Nothing to delete.');
  rl.close();
} else {
  promptConfirmation();
}
