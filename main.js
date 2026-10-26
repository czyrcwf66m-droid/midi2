const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win;
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 720, minHeight: 480,
    backgroundColor: '#14111c', title: 'Partition animée MIDI',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function ffmpegPath() {
  try { return require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked'); } catch (e) { return null; }
}

// Reçoit la vidéo enregistrée par la page (WebM), demande où l'enregistrer,
// puis la convertit en vrai MP4 (H.264 + AAC) avec ffmpeg.
ipcMain.handle('save-video', async (e, data, ext, fps) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Enregistrer la vidéo',
    defaultPath: path.join(app.getPath('videos'), 'animation-midi.mp4'),
    filters: [{ name: 'Vidéo MP4', extensions: ['mp4'] }, { name: 'Vidéo WebM', extensions: ['webm'] }]
  });
  if (res.canceled || !res.filePath) return 'Export annulé.';
  const buf = Buffer.from(data);
  const out = res.filePath;
  if (/\.webm$/i.test(out) || ext === 'mp4') { fs.writeFileSync(out, buf); return 'Vidéo enregistrée : ' + out; }
  const tmp = path.join(os.tmpdir(), 'midi-anim-' + Date.now() + '.webm');
  fs.writeFileSync(tmp, buf);
  const bin = ffmpegPath();
  if (!bin) { const alt = out.replace(/\.mp4$/i, '.webm'); fs.copyFileSync(tmp, alt); return 'Conversion MP4 indisponible, vidéo WebM enregistrée : ' + alt; }
  const args = ['-y', '-i', tmp, '-r', String(fps || 30), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out];
  return new Promise(resolve => {
    execFile(bin, args, { windowsHide: true, maxBuffer: 1 << 26 }, err => {
      if (!err) { fs.unlink(tmp, () => {}); resolve('Vidéo MP4 enregistrée : ' + out); return; }
      const alt = out.replace(/\.mp4$/i, '.webm');
      try { fs.copyFileSync(tmp, alt); } catch (x) {}
      resolve('Conversion MP4 impossible (' + err.message.split('\n')[0] + '). Vidéo WebM enregistrée : ' + alt);
    });
  });
});
