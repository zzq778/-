import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { APP_URL, isSafeExternalUrl, isTrustedAppUrl } from './config.mjs';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.dirname(desktopDir);
const offlinePath = path.join(desktopDir, 'offline.html');
const offlineUrl = pathToFileURL(offlinePath).href;

let mainWindow = null;

function openExternalUrl(url) {
  if (isSafeExternalUrl(url)) void shell.openExternal(url);
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#092820',
    icon: path.join(projectDir, 'public', 'assets', 'icon-512.png'),
    title: '吉政知行',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAppUrl(url)) void window.loadURL(url);
    else openExternalUrl(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url) || url === offlineUrl) return;
    event.preventDefault();
    openExternalUrl(url);
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, _errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || validatedUrl === offlineUrl) return;
      void window.loadFile(offlinePath);
    },
  );

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  void window.loadURL(APP_URL);
  return window;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
