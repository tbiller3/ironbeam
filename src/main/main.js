/**
 * IRONBEAM Technologies - Electron Main Process
 * © 2025 IRONBEAM Technologies - ironbeam.ca
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let mainWindow = null;
let tray = null;
let serverCore = null;
let isQuitting = false;
const isDev = process.argv.includes('--dev');
const TRANSFER_DIR = path.join(os.homedir(), 'IronBeam');

// Path resolution works both in dev and packaged app
function resPath(...parts) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...parts)
    : path.join(__dirname, '../..', ...parts);
}

app.whenReady().then(async () => {
  if (!fs.existsSync(TRANSFER_DIR)) fs.mkdirSync(TRANSFER_DIR, { recursive: true });

  // Load server (path differs when packaged)
  try {
    serverCore = require(resPath('server-core.js'));
  } catch (e) {
    serverCore = require('../../server-core');
  }
  await serverCore.start();

  createTray();
  createWindow();

  // Notify renderer that server is ready (it may have loaded before start() resolved)
  setTimeout(() => {
    mainWindow?.webContents.send('server-ready', getInfoPayload());
  }, 500);

  const firstRun = !fs.existsSync(path.join(os.homedir(), '.ironbeam-v1'));
  if (firstRun) {
    fs.writeFileSync(path.join(os.homedir(), '.ironbeam-v1'), '1');
    setTimeout(() => notify('IRONBEAM is running', 'Open the app on your iPhone to start transferring files.'), 2000);
  }
});

function getIconPath(filename = 'icon.png') {
  // Try packaged resources first, fall back to build folder
  const packed = path.join(process.resourcesPath || '', 'build', filename);
  const dev    = path.join(__dirname, '../../build', filename);
  if (fs.existsSync(packed)) return packed;
  if (fs.existsSync(dev))    return dev;
  return null;
}

function createWindow() {
  const iconPath = getIconPath('icon.png');
  mainWindow = new BrowserWindow({
    width: 960, height: 660, minWidth: 800, minHeight: 560,
    show: false, frame: false, backgroundColor: '#08080f',
    icon: iconPath || undefined,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const rendererPath = app.isPackaged
    ? path.join(process.resourcesPath, 'src', 'renderer', 'app', 'index.html')
    : path.join(__dirname, '../renderer/app/index.html');
  mainWindow.loadFile(rendererPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });
  mainWindow.on('close', e => { if (!isQuitting) { e.preventDefault(); mainWindow.hide(); } });

  if (serverCore) {
    serverCore.onFileReceived(info => {
      mainWindow?.webContents.send('file-received', info);
      notify('File received from iPhone', info.name + ' saved to IronBeam folder');
      updateTrayMenu(serverCore.isConnected());
    });
    serverCore.onPhoneConnected(ip => {
      mainWindow?.webContents.send('device-connected', { ip, count: 1 });
      updateTrayMenu(true);
      notify('iPhone connected', 'Ready to transfer files');
    });
    serverCore.onPhoneDisconnected(() => {
      mainWindow?.webContents.send('device-disconnected', { count: 0 });
      updateTrayMenu(false);
    });
  }
}

function createTray() {
  const iconPath = getIconPath('icon.png');
  const img = iconPath ? nativeImage.createFromPath(iconPath).resize({ width: 16 }) : nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('IRONBEAM');
  updateTrayMenu(false);
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function updateTrayMenu(connected) {
  const ip = getIp();
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'IRONBEAM Technologies', enabled: false },
    { type: 'separator' },
    { label: connected ? '📱 iPhone Connected ✓' : '📵 Waiting for iPhone...', enabled: false },
    { label: 'URL: https://' + ip + ':7443/phone', enabled: false },
    { type: 'separator' },
    { label: 'Open IRONBEAM', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Open Transfer Folder', click: () => shell.openPath(TRANSFER_DIR) },
    { type: 'separator' },
    { label: 'Quit IRONBEAM', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray?.setToolTip(connected ? 'IRONBEAM — iPhone Connected ✓' : `IRONBEAM — https://${ip}:7443/phone`);
}

// IPC — channel names must match preload.js exactly
function getInfoPayload() {
  return {
    ip: getIp(),
    portHttps: 7443,
    portHttp: 7878,
    transferDir: TRANSFER_DIR,
    connectedDevices: serverCore?.isConnected() ? 1 : 0,
    version: app.getVersion(),
  };
}
ipcMain.handle('get-info',    () => getInfoPayload());
ipcMain.handle('get-status',  () => getInfoPayload()); // legacy alias
ipcMain.handle('list-files', () => {
  try {
    return fs.readdirSync(TRANSFER_DIR).filter(f => !f.startsWith('.') && !f.endsWith('.mobileconfig'))
      .map(n => { const s = fs.statSync(path.join(TRANSFER_DIR, n)); return { name: n, size: s.size, modified: s.mtimeMs }; })
      .sort((a,b) => b.modified - a.modified);
  } catch { return []; }
});
ipcMain.handle('open-file',           (_, n) => shell.openPath(path.join(TRANSFER_DIR, n)));
ipcMain.handle('open-transfer-folder',()     => shell.openPath(TRANSFER_DIR));
ipcMain.handle('open-folder',         ()     => shell.openPath(TRANSFER_DIR)); // legacy alias
ipcMain.handle('delete-file', (_, n) => { try { fs.unlinkSync(path.join(TRANSFER_DIR, n)); return true; } catch { return false; } });
ipcMain.handle('get-mobileconfig', () => {
  const p = path.join(TRANSFER_DIR, 'IRONBEAM-Trust.mobileconfig');
  return fs.existsSync(p) ? p : null;
});
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window-hide',     () => mainWindow?.hide());
ipcMain.on('window-quit',     () => { isQuitting = true; app.quit(); });
ipcMain.on('win-min',   () => mainWindow?.minimize());   // legacy aliases
ipcMain.on('win-max',   () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('win-close', () => mainWindow?.hide());

app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus(); });
app.on('before-quit', () => { isQuitting = true; serverCore?.stop(); });
app.on('window-all-closed', () => {});
app.on('activate', () => mainWindow?.show());

function getIp() {
  const nets = os.networkInterfaces();
  for (const n of Object.keys(nets)) for (const i of nets[n]) if (i.family==='IPv4'&&!i.internal) return i.address;
  return '127.0.0.1';
}
function notify(title, body) { if (Notification.isSupported()) new Notification({ title, body }).show(); }
