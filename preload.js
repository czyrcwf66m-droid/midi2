const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  saveVideo: (buf, ext, fps) => ipcRenderer.invoke('save-video', buf, ext, fps)
});
