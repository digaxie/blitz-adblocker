# ⚡ Blitz.gg Ad-Blocker & Performance Optimizer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://www.microsoft.com)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-green.svg)](https://nodejs.org)

An open-source, automated patcher for the [Blitz.gg](https://blitz.gg) desktop application that completely removes ads, collapses the reserved right rail for a true full-width layout, boosts performance, and fixes multi-monitor off-screen window bugs.

---

## ✨ Features

- 🚫 **Complete Ad Blocking**: Blocks all ad networks (Aditude, InMobi, Google Syndication / DoubleClick, Prebid, Primis video ads, and more).
- 📐 **100% Full-Width UI**: Natively collapses the reserved 308px right-rail ad column (`--right-rail-width: 0px`), expanding rune pages, item builds, and match history to fill the entire window.
- ⚡ **Huge Performance Boost**: Eliminates background ad-bidding loops, video decoders, and canvas redraws, drastically reducing CPU, GPU, and RAM consumption while gaming.
- 🖥️ **Multi-Monitor Coordinate Fix**: Fixes the common bug where Blitz starts off-screen (e.g. on disconnected, secondary, or virtual monitors) by ensuring window coordinates always start centered on the primary display.
- 🛡️ **Safe & Reversible**: Creates pristine `.bak` backups before applying any changes. Revert back to original Blitz anytime with a single click.

---

## 🚀 Quick Start (Installation)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16 or higher)
- [Blitz.gg Desktop App](https://blitz.gg) installed on Windows

### Method 1: 1-Click Batch (Recommended for Windows)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/blitz-adblocker.git
   cd blitz-adblocker
   ```
2. Double-click **`install.bat`**.
3. The script will automatically install dependencies, backup your original Blitz files, apply the patches, and prompt you to launch Blitz!

### Method 2: Command Line (CLI)

```bash
# Install dependencies
npm install

# Run the patcher
node patch.js
```

---

## 🔄 How to Uninstall / Restore

If you ever want to revert Blitz back to its factory untouched state:

- **1-Click**: Double-click **`uninstall.bat`**.
- **CLI**: Run:
  ```bash
  node restore.js
  ```
All original files will be restored from `.bak` backups instantly.

---

## 🔬 How It Works (Technical Overview)

1. **Anti-Tamper Bypass (`blitz_core.node`)**:
   - Blitz uses a native C++ module (`blitz_core.node`) that computes a SHA-256 hash of `app.asar` on startup. If modified, it exits with error code 11 (`E6 Error`).
   - The patcher modifies the conditional branch instruction at offset `0x15b94` (`0f 84 4c 01 00 00` -> `e9 4d 01 00 00 90`), safely bypassing the integrity check without affecting any in-game overlays or LoL Client (LCU) integrations.

2. **Native Ad-Rail Collapse**:
   - Blitz frontend fetches remote advertising configurations from `https://utils.iesdev.com/static/json/rev/ads`.
   - The patcher injects a lightweight fetch interceptor in `src/preload.js` that returns `{ enabled: false }`. This causes Blitz's internal advertising controller to natively execute `this.turnOffAds()`, setting the layout custom property `--right-rail-width: 0px`.

3. **Style & Element Purging (`createWindow.js`)**:
   - Injects targeted CSS directly into the `browserView.webContents` to eliminate any residual ad placeholders (`.🤑-*`, `.ads-rail-marker`, `#display-desktop-anchor`) and enforce a 1-column grid layout across all page transitions.

4. **Off-Screen Recovery (`windowUtils.js` & `blitz-entry.js`)**:
   - Clamps window initialization and `second-instance` restore events to `screen.getPrimaryDisplay().workArea`, ensuring the window is never lost on an inactive secondary display.

---

## ⚠️ Disclaimer

This project is an independent open-source tool developed for educational, performance optimization, and personal use. It is not affiliated with, endorsed by, or associated with Blitz App, Inc. or Riot Games. All trademarks belong to their respective owners.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
