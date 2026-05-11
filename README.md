# IRONBEAM Technologies

**Unrestricted file transfer between iPhone and desktop — no cloud, no cables.**

## How to build

### Option A — GitHub Actions (recommended)
Push this repo to GitHub. The installer builds automatically and appears under **Actions → latest run → Artifacts**.

### Option B — Local build
```
npm install
npx electron-builder --win --x64
```
Requires Node.js 18+ and internet access to download Electron.

## Running in development
```
npm install
npm start
```

## Architecture
- `src/main/main.js` — Electron main process (tray, window, IPC)
- `src/main/preload.js` — Secure IPC bridge
- `src/renderer/index.html` — Desktop UI
- `server-core.js` — HTTPS transfer server (runs inside Electron)
- `phone-app/index.html` — iPhone companion web app

© 2025 IRONBEAM Technologies — ironbeam.ca
