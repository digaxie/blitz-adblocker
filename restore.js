const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function killBlitz() {
  console.log('[*] Terminating running Blitz processes...');
  try {
    execSync('taskkill /F /IM Blitz.exe', { stdio: 'ignore' });
  } catch (e) {}
}

function restoreFile(filePath) {
  const bakPath = filePath + '.bak';
  if (fs.existsSync(bakPath)) {
    try {
      fs.copyFileSync(bakPath, filePath);
      console.log(`[+] Restored: ${filePath}`);
      return true;
    } catch (err) {
      console.error(`[-] Error restoring ${filePath}:`, err.message);
      return false;
    }
  } else {
    console.log(`[!] No backup found for: ${filePath}`);
    return false;
  }
}

function main() {
  console.log('====================================================');
  console.log('         Blitz.gg Restore to Factory Default         ');
  console.log('====================================================\n');

  killBlitz();

  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');

  const targetAsar = path.join(localAppData, 'Programs', 'Blitz', 'resources', 'app.asar');
  const coreBinaries = path.join(localAppData, 'Programs', 'Blitz', 'resources', 'binaries', 'blitz_core.node');
  const depsDir = path.join(appData, 'Blitz', 'blitz-deps');

  restoreFile(targetAsar);
  restoreFile(coreBinaries);

  if (fs.existsSync(depsDir)) {
    const versions = fs.readdirSync(depsDir);
    for (const v of versions) {
      const nodePath = path.join(depsDir, v, 'blitz_core.node');
      if (fs.existsSync(nodePath + '.bak')) {
        restoreFile(nodePath);
      }
    }
  }

  console.log('\n[+] Restore completed successfully! You can now start Blitz.');
}

main();
