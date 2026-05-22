const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('IB', {
  getInfo:            ()     => ipcRenderer.invoke('get-info'),
  listFiles:          ()     => ipcRenderer.invoke('list-files'),
  openTransferFolder: ()     => ipcRenderer.invoke('open-transfer-folder'),
  openFile:           (name) => ipcRenderer.invoke('open-file', name),
  deleteFile:         (name) => ipcRenderer.invoke('delete-file', name),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  hide:     () => ipcRenderer.send('window-hide'),
  quit:     () => ipcRenderer.send('window-quit'),
  pushToPhone:   (name)       => ipcRenderer.invoke('push-to-phone', name),
  pullFromPhone: (name)       => ipcRenderer.invoke('pull-from-phone', name),
  copyFile:      (sourcePath) => ipcRenderer.invoke('copy-file', sourcePath),
  on:  (ch, cb) => { const ok=['server-ready','file-received','device-connected','device-disconnected','fs-change','phone-file-list']; if(ok.includes(ch)) ipcRenderer.on(ch, (_,d)=>cb(d)); },
  off: (ch) => ipcRenderer.removeAllListeners(ch),
});
