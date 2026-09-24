const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const asar = require('asar');

const AD_BLOCK_CSS = `
  .🤑-wrapper,
  .🤑-column,
  .🤑-rectangle,
  .🤑-leaderboard,
  .🤑-placeholder,
  .ads-rail-marker,
  #display-desktop-anchor,
  .title-container:has(svg) {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
  :root {
    --right-rail-width: 0px !important;
    --rail-gap: 0px !important;
  }
  .content-container.svelte-1idh3hh.width-rail,
  .content-container.width-rail {
    grid-template-columns: minmax(0, 1fr) !important;
    max-width: calc(var(--sp-container) + (2 * var(--padd))) !important;
    gap: 0 !important;
  }
`;

function killBlitz() {
  console.log('[*] Terminating running Blitz processes...');
  try {
    execSync('taskkill /F /IM Blitz.exe', { stdio: 'ignore' });
  } catch (e) {}
}

function backupFile(filePath) {
  const bakPath = filePath + '.bak';
  if (!fs.existsSync(bakPath) && fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, bakPath);
      console.log(`[+] Backup created: ${bakPath}`);
    } catch (err) {
      console.error(`[-] Failed to backup ${filePath}:`, err.message);
    }
  }
}

function patchBinary(filePath) {
  if (!fs.existsSync(filePath)) return;
  backupFile(filePath);

  let data = fs.readFileSync(filePath);
  const oldBytes = Buffer.from('0f844c010000', 'hex');
  const newBytes = Buffer.from('e94d01000090', 'hex');

  const idx = data.indexOf(oldBytes);
  if (idx !== -1) {
    newBytes.copy(data, idx);
    fs.writeFileSync(filePath, data);
    console.log(`[+] Patched binary integrity check in: ${filePath}`);
  } else if (data.indexOf(newBytes) !== -1) {
    console.log(`[+] Binary integrity check already patched in: ${filePath}`);
  } else {
    console.warn(`[!] Signature not found in binary: ${filePath}`);
  }
}

function patchPreload(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('__ads_mocked__')) {
    console.log('[+] preload.js is already patched.');
    return;
  }

  const hook = `
try {
  webFrame.executeJavaScript(\`
    (() => {
      try {
        const origFetch = window.fetch;
        if (origFetch && !window.__ads_mocked__) {
          window.__ads_mocked__ = true;
          window.fetch = async function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url && url.includes('/static/json/rev/ads')) {
              return new Response(JSON.stringify({
                enabled: false,
                adhesion: false,
                videoEnabled: false,
                videoEnabledWeb: false,
                refresh: 999999,
                maxRefreshCount: 0,
                overrides: {}
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            return origFetch.apply(this, args);
          };
          window.tude = { cmd: [], refreshAdsViaDivMappings: () => {}, isConfigLoaded: () => true };
        }
      } catch (e) {}
    })();
  \`);
} catch (e) {}
`;

  content = hook + '\n' + content;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[+] Patched preload.js (native ad-controller mock injected).');
}

function patchCreateWindow(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Constrain coordinates to primary display
  if (!content.includes('primaryDisplay.workArea')) {
    const oldCoordFunc = `async function getWindowCoordinates() {
  let width, height, x, y;
  const displaySize = screen.getPrimaryDisplay().size;
  const centerX = displaySize.width / 2 - 1366 / 2;
  const centerY = displaySize.height / 2 - 768 / 2;

  width = Math.max(MIN_WIDTH, (await get("windowWidth")) || DEFAULT_WIDTH);
  height = Math.max(MIN_HEIGHT, (await get("windowHeight")) || MIN_HEIGHT);
  x = (await get("windowX")) || centerX;
  y = (await get("windowY")) || centerY;
  width = Number(width);
  height = Number(height);
  x = Number(x);
  y = Number(y);

  return { width, height, x, y };
}`;

    const newCoordFunc = `async function getWindowCoordinates() {
  let width, height, x, y;
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const centerX = Math.round(workArea.x + (workArea.width - DEFAULT_WIDTH) / 2);
  const centerY = Math.round(workArea.y + (workArea.height - DEFAULT_HEIGHT) / 2);

  width = Math.max(MIN_WIDTH, (await get("windowWidth")) || DEFAULT_WIDTH);
  height = Math.max(MIN_HEIGHT, (await get("windowHeight")) || MIN_HEIGHT);
  x = await get("windowX");
  y = await get("windowY");

  if (
    x === undefined ||
    y === undefined ||
    x === null ||
    y === null ||
    isNaN(Number(x)) ||
    isNaN(Number(y)) ||
    Number(x) < workArea.x - 50 ||
    Number(x) > workArea.x + workArea.width - 200 ||
    Number(y) < workArea.y - 50 ||
    Number(y) > workArea.y + workArea.height - 200
  ) {
    x = centerX;
    y = centerY;
  }

  width = Number(width);
  height = Number(height);
  x = Number(x);
  y = Number(y);

  return { width, height, x, y };
}`;

    if (content.includes(oldCoordFunc)) {
      content = content.replace(oldCoordFunc, newCoordFunc);
    }
  }

  // 2. Inject CSS rules
  if (!content.includes('adBlockCSS')) {
    const cssBlock = `
  const adBlockCSS = \`${AD_BLOCK_CSS}\`;

  browserView.webContents.on("dom-ready", () => {
    browserView.webContents.insertCSS(adBlockCSS).catch(() => {});
  });
  browserView.webContents.on("did-finish-load", () => {
    browserView.webContents.insertCSS(adBlockCSS).catch(() => {});
  });
  browserView.webContents.on("did-navigate-in-page", () => {
    browserView.webContents.insertCSS(adBlockCSS).catch(() => {});
  });
`;
    content = content.replace('browserView.webContents.loadURL(url);', cssBlock + '\n  browserView.webContents.loadURL(url);');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[+] Patched createWindow.js (primary screen constraint & CSS injection).');
}

function patchWindowUtils(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('isVisibleOnPrimary')) {
    console.log('[+] windowUtils.js is already patched.');
    return;
  }

  const oldEnsure = `function ensureWindowIsOnADisplay() {
  if (windows.client) {
    const winBounds = windows.client.getBounds();
    const isOnADisplay = screen
      .getAllDisplays()
      .map(
        (display) =>
          winBounds.x >= display.bounds.x &&
          winBounds.x <= display.bounds.x + display.bounds.width &&
          winBounds.y >= display.bounds.y &&
          winBounds.y <= display.bounds.y + display.bounds.height
      )
      .some((display) => display);
    if (!windows.client.isVisible() || !isOnADisplay) {
      log.info("[core]", "[Window] Window isn't visible, center it");
      windows.client.center();
      windows.client.moveTop();
    }
  }
}`;

  const newEnsure = `function ensureWindowIsOnADisplay() {
  if (windows.client) {
    const winBounds = windows.client.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;
    const isVisibleOnPrimary =
      winBounds.x >= workArea.x - 50 &&
      winBounds.x < workArea.x + workArea.width - 200 &&
      winBounds.y >= workArea.y - 50 &&
      winBounds.y < workArea.y + workArea.height - 200;

    if (!windows.client.isVisible() || !isVisibleOnPrimary) {
      log.info("[core]", "[Window] Window isn't visible on primary display, centering");
      windows.client.center();
      windows.client.show();
      windows.client.focus();
      windows.client.moveTop();
    }
  }
}`;

  const oldRestore = `function restoreAndFocusWindow() {
  if (windows.client) {
    if (windows.client.isMinimized()) {
      windows.client.restore();
    }
    windows.client.show();
    windows.client.focus();
  }
}`;

  const newRestore = `function restoreAndFocusWindow() {
  if (windows.client) {
    if (windows.client.isMinimized()) {
      windows.client.restore();
    }
    const winBounds = windows.client.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;
    const isVisibleOnPrimary =
      winBounds.x >= workArea.x - 50 &&
      winBounds.x < workArea.x + workArea.width - 200 &&
      winBounds.y >= workArea.y - 50 &&
      winBounds.y < workArea.y + workArea.height - 200;

    if (!isVisibleOnPrimary) {
      windows.client.center();
    }
    windows.client.show();
    windows.client.focus();
    windows.client.moveTop();
  }
}`;

  if (content.includes(oldEnsure)) content = content.replace(oldEnsure, newEnsure);
  if (content.includes(oldRestore)) content = content.replace(oldRestore, newRestore);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[+] Patched windowUtils.js (multi-monitor centering).');
}

function patchBlitzEntry(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('primaryDisplay.workArea')) {
    console.log('[+] blitz-entry.js is already patched.');
    return;
  }

  const oldSecond = `  app.on("second-instance", (event, commandLine = [], workingDirectory) => {
    if (windows.client.isMinimized()) windows.client.restore();
    windows.client.show();
    windows.client.focus();`;

  const newSecond = `  app.on("second-instance", (event, commandLine = [], workingDirectory) => {
    if (windows.client) {
      if (windows.client.isMinimized()) windows.client.restore();
      const { screen } = require("electron");
      const primaryDisplay = screen.getPrimaryDisplay();
      const workArea = primaryDisplay.workArea;
      const winBounds = windows.client.getBounds();
      if (
        winBounds.x < workArea.x - 50 ||
        winBounds.x >= workArea.x + workArea.width - 200 ||
        winBounds.y < workArea.y - 50 ||
        winBounds.y >= workArea.y + workArea.height - 200
      ) {
        windows.client.center();
      }
      windows.client.show();
      windows.client.focus();
      windows.client.moveTop();
    }`;

  if (content.includes(oldSecond)) {
    content = content.replace(oldSecond, newSecond);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[+] Patched blitz-entry.js (second instance window recovery).');
  }
}

function patchElectronWindowHandlers(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('AD_BLOCK_DOMAINS')) {
    console.log('[+] electronWindowHandlers.js is already patched.');
    return;
  }

  const oldFunc = `function interceptRequests(window) {
  // Mess with request headers necessary for internal requests.`;

  const newFunc = `function interceptRequests(window) {
  const AD_BLOCK_DOMAINS = [
    "cloudfront.net/blitz-",
    "cmp.inmobi.com",
    "inmobi.com",
    "doubleclick.net",
    "googlesyndication.com",
    "google-analytics.com",
    "aditude.com",
    "tude.bid",
    "cpmstar.com",
    "primis.tech",
    "adnxs.com",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "casalemedia.com",
    "amazon-adsystem.com",
    "playwire.com",
    "nitropay.com",
    "revcontent.com",
    "outbrain.com",
    "taboola.com",
  ];

  try {
    window.webContents.session.webRequest.onBeforeRequest(
      {
        urls: ["*://*/*"],
      },
      (details, callback) => {
        const lowerUrl = details.url.toLowerCase();
        const isAd = AD_BLOCK_DOMAINS.some((domain) => lowerUrl.includes(domain));
        if (isAd) {
          return callback({ cancel: true });
        }
        callback({ cancel: false });
      }
    );
  } catch (err) {
    log.error("[core]", "onBeforeRequest adblock error", err);
  }

  // Mess with request headers necessary for internal requests.`;

  if (content.includes(oldFunc)) {
    content = content.replace(oldFunc, newFunc);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[+] Patched electronWindowHandlers.js (ad request network blocking).');
  }
}

function patchAuth(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('hasPremiumRole(roles) {\n  return true;')) {
    console.log('[+] auth.js is already patched.');
    return;
  }

  content = content.replace(
    /function hasPremiumRole\([^)]*\)\s*\{[^}]*\}/,
    'function hasPremiumRole(roles) {\n  return true;\n}'
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[+] Patched auth.js (premium role unlocked).');
}

function patchAutoUpdater(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('__updater_disabled__')) {
    console.log('[+] autoUpdater is already disabled.');
    return;
  }

  content = content.replace(
    /function checkForUpdates\(\)\s*\{[^}]*\}/,
    'function checkForUpdates() {\n  // __updater_disabled__\n  return Promise.resolve();\n}'
  );

  const oldPoll = `function pollForUpdates() {
  checkForUpdates();
  setInterval(() => {
    checkForUpdates();
  }, oneHour);
}`;
  const newPoll = `function pollForUpdates() {
  // __updater_disabled__
  log.info("[core]", "[Updater] Auto-updates disabled by patcher");
}`;
  if (content.includes(oldPoll)) {
    content = content.replace(oldPoll, newPoll);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[+] Patched autoUpdater.js (auto-update checks disabled).');
}

async function main() {
  console.log('====================================================');
  console.log('     Blitz.gg Ad-Blocker & Performance Patcher      ');
  console.log('====================================================\n');

  killBlitz();

  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');

  // Clear blitz-updater cache so pending updates don't fire
  const updaterDir = path.join(localAppData, 'blitz-updater');
  if (fs.existsSync(updaterDir)) {
    try {
      fs.rmSync(updaterDir, { recursive: true, force: true });
      fs.mkdirSync(updaterDir);
      console.log('[+] Cleared blitz-updater cache.');
    } catch (e) {
      console.warn('[!] Could not clear blitz-updater:', e.message);
    }
  }

  const targetAsar = path.join(localAppData, 'Programs', 'Blitz', 'resources', 'app.asar');
  const coreBinaries = path.join(localAppData, 'Programs', 'Blitz', 'resources', 'binaries', 'blitz_core.node');
  const depsDir = path.join(appData, 'Blitz', 'blitz-deps');

  if (!fs.existsSync(targetAsar)) {
    console.error(`[-] Blitz installation not found at: ${targetAsar}`);
    process.exit(1);
  }

  // 1. Backup
  backupFile(targetAsar);
  backupFile(coreBinaries);

  // 2. Patch binary anti-tamper
  patchBinary(coreBinaries);
  if (fs.existsSync(depsDir)) {
    const versions = fs.readdirSync(depsDir);
    for (const v of versions) {
      const nodePath = path.join(depsDir, v, 'blitz_core.node');
      if (fs.existsSync(nodePath)) {
        patchBinary(nodePath);
      }
    }
  }

  // 3. Extract asar to temporary directory
  const tempDir = path.join(os.tmpdir(), `blitz_extracted_${Date.now()}`);
  console.log(`[*] Extracting app.asar to temporary directory...`);
  asar.extractAll(targetAsar, tempDir);

  // 4. Apply patches in extracted files
  console.log(`[*] Applying code modifications...`);
  patchPreload(path.join(tempDir, 'src', 'preload.js'));
  patchCreateWindow(path.join(tempDir, 'src', 'createWindow.js'));
  patchWindowUtils(path.join(tempDir, 'src', 'windowUtils.js'));
  patchBlitzEntry(path.join(tempDir, 'src', 'blitz-entry.js'));
  patchElectronWindowHandlers(path.join(tempDir, 'src', 'electronWindowHandlers.js'));
  patchAuth(path.join(tempDir, 'src', 'auth.js'));
  patchAutoUpdater(path.join(tempDir, 'src', 'autoUpdater', 'index.js'));

  // 5. Repack asar
  console.log(`[*] Repacking app.asar...`);
  const repackedAsar = path.join(os.tmpdir(), `app_repacked_${Date.now()}.asar`);
  await asar.createPackageWithOptions(tempDir, repackedAsar, {
    unpack: '*.node',
    unpackDir: 'node_modules/lzma-native'
  });

  // 6. Deploy repacked asar
  fs.copyFileSync(repackedAsar, targetAsar);
  console.log(`[+] Updated: ${targetAsar}`);

  // 7. Cleanup
  console.log(`[*] Cleaning up temporary files...`);
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(repackedAsar);
  } catch (e) {}

  console.log('\n====================================================');
  console.log('   All patches applied successfully! Blitz is ready.');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('[-] Fatal error:', err);
  process.exit(1);
});
