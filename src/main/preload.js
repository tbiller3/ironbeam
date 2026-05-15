const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('IB', {
  // ── Data ──────────────────────────────────────────────
  getStatus:  () => ipcRenderer.invoke('get-status'),
  listFiles:  () => ipcRenderer.invoke('list-files'),

  // ── File operations ───────────────────────────────────
  openFile:   (name) => ipcRenderer.invoke('open-file', name),
  openFolder: ()     => ipcRenderer.invoke('open-folder'),
  deleteFile: (name) => ipcRenderer.invoke('delete-file', name),

  // ── Window controls ───────────────────────────────────
  winMin:   () => ipcRenderer.send('win-min'),
  winMax:   () => ipcRenderer.send('win-max'),
  winClose: () => ipcRenderer.send('win-close'),

  // ── Event listeners ───────────────────────────────────
  onPhoneConnected:    (cb) => ipcRenderer.on('phone-connected',    (_, d) => cb(d)),
  onPhoneDisconnected: (cb) => ipcRenderer.on('phone-disconnected', (_, d) => cb(d)),
  onFileReceived:      (cb) => ipcRenderer.on('file-received',      (_, d) => cb(d)),
});
