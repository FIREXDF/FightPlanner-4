const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ModUtils = require('./mod-utils');
const PluginUtils = require('./plugin-utils');
const store = require('./store');
const packageJson = require('../../package.json');
const { initializeProtocol, getProtocolHandler } = require('./main-protocol-setup');
const { createTutorialWindow, closeTutorialWindow } = require('./tutorial-window');
const { migrateFromV3, getMigrationStatus } = require('./migration');
const FTPClient = require('./ftp-client');

// Log file setup
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Intercept console logs and write to file + send to renderer
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

let mainWindow = null;

function writeLog(level, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  const logLine = `[${timestamp}] [${level.toUpperCase()}] [MAIN] ${message}\n`;
  logStream.write(logLine);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('main-log', {
      level,
      message,
      timestamp: new Date().toISOString()
    });
  }
}

console.log = (...args) => {
  writeLog('log', args);
  originalConsoleLog.apply(console, args);
};

console.warn = (...args) => {
  writeLog('warn', args);
  originalConsoleWarn.apply(console, args);
};

console.error = (...args) => {
  writeLog('error', args);
  originalConsoleError.apply(console, args);
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#1a1a1a',
    frame: false,
    transparent: false,
    hasShadow: true
  });

  let isToolsTabActive = false;

  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('tools-tab-active')) {
      isToolsTabActive = message.includes('true');
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });

  ipcMain.on('update-tools-tab-status', (event, status) => {
    isToolsTabActive = status;
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    webPreferences.nodeIntegration = false;
  });

  const handleWindowDropFiles = async (filePaths) => {
    try {
      console.log('handleWindowDropFiles called with:', filePaths);
      const modsPath = store.get('modsPath');
      
      if (!modsPath) {
        console.error('Mods folder not configured');
        mainWindow.webContents.send('drop-error', 'Mods folder not configured. Please set it in Settings.');
        return;
      }
      
      console.log('Installing mods to:', modsPath);
      
      for (const filePath of filePaths) {
        try {
          console.log('Installing mod from path:', filePath);
          const result = await ModUtils.installModFromPath(filePath, modsPath);
          console.log('Install result:', result);
          mainWindow.webContents.send('drop-result', {
            filePath,
            result
          });
        } catch (error) {
          console.error('Error installing mod:', error);
          mainWindow.webContents.send('drop-error', `Error installing ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Error in handleWindowDropFiles:', error);
      mainWindow.webContents.send('drop-error', `Error: ${error.message}`);
    }
  };

  mainWindow.on('drop-files', (event, filePaths) => {
    event.preventDefault();
    console.log('Drop-files event triggered:', filePaths, 'isToolsTabActive:', isToolsTabActive);
    if (isToolsTabActive) {
      handleWindowDropFiles(filePaths);
    } else {
      console.log('Drop ignored - Tools tab is not active');
    }
  });

  mainWindow.on('dragover', (event) => {
    if (isToolsTabActive) {
      event.preventDefault();
    }
  });

  // Also listen for drop event at window level
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
      document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    `);
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  initializeProtocol(mainWindow);

  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow.close();
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('read-mods-folder', async (event, modsPath) => {
    try {
      const result = ModUtils.readAllMods(modsPath);
      return result;
    } catch (error) {
      console.error('Error reading mods folder:', error);
      return {
        activeMods: [],
        disabledMods: [],
        error: error.message
      };
    }
  });

  ipcMain.handle('get-preview-image', async (event, modPath) => {
    try {
      const previewPath = ModUtils.getPreviewImagePath(modPath);

      if (previewPath) {
        return ModUtils.pathToFileUrl(previewPath);
      }

      return null;
    } catch (error) {
      console.error('Error getting preview image:', error);
      return null;
    }
  });

  ipcMain.handle('get-mod-info', async (event, modPath) => {
    try {
      const modInfo = ModUtils.readModInfo(modPath);
      return modInfo;
    } catch (error) {
      console.error('Error getting mod info:', error);
      return null;
    }
  });

  ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
      if (fs.existsSync(folderPath)) {
        await shell.openPath(folderPath);
        return { success: true };
      } else {
        console.error('Folder does not exist:', folderPath);
        return { success: false, error: 'Folder does not exist' };
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return { success: true };
      } else {
        console.error('File does not exist:', filePath);
        return { success: false, error: 'File does not exist' };
      }
    } catch (error) {
      console.error('Error opening file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-url', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Error opening URL:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-fightplanner-link', async (event, url) => {
    try {
      if (!url || !url.startsWith('fightplanner:')) {
        return { success: false, error: 'Invalid fightplanner link' };
      }

      const handler = getProtocolHandler();
      if (handler) {
        handler.handleDeepLink(url);
        return { success: true };
      } else {
        return { success: false, error: 'Protocol handler not initialized' };
      }
    } catch (error) {
      console.error('Error opening fightplanner link:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cancel-download', async (event, downloadId) => {
    try {
      const handler = getProtocolHandler();
      if (handler) {
        return handler.cancelDownload(downloadId);
      } else {
        return { success: false, error: 'Protocol handler not initialized' };
      }
    } catch (error) {
      console.error('Error cancelling download:', error);
      return { success: false, error: error.message };
    }
  });


  ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
    return { success: true };
  });

  ipcMain.handle('store-delete', (event, key) => {
    store.delete(key);
    return { success: true };
  });

  ipcMain.handle('store-clear', () => {
    store.clear();
    return { success: true };
  });

  ipcMain.handle('get-app-version', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome
    };
  });

  ipcMain.handle('scan-mod-for-fighters', async (event, modPath) => {
    try {
      const fighters = [];
      const fighterPath = path.join(modPath, 'fighter');

      if (fs.existsSync(fighterPath)) {
        const fighterDirs = fs.readdirSync(fighterPath, { withFileTypes: true });

        for (const dirent of fighterDirs) {
          if (dirent.isDirectory()) {
            fighters.push(dirent.name);
          }
        }
      }

      return fighters;
    } catch (error) {
      console.error('Error scanning mod for fighters:', error);
      return [];
    }
  });

  ipcMain.handle('rename-mod', async (event, modPath, newName) => {
    try {
      const parentDir = path.dirname(modPath);
      const newPath = path.join(parentDir, newName);

      if (fs.existsSync(newPath)) {
        return { success: false, error: 'A mod with this name already exists' };
      }

      fs.renameSync(modPath, newPath);
      return { success: true, newPath };
    } catch (error) {
      console.error('Error renaming mod:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-mod', async (event, modPath) => {
    try {
      if (!fs.existsSync(modPath)) {
        return { success: false, error: 'Mod folder does not exist' };
      }

      fs.rmSync(modPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      console.error('Error deleting mod:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('toggle-mod', async (event, modPath, modsBasePath) => {
    try {
      const modName = path.basename(modPath);
      const parentDir = path.dirname(modsBasePath);
      const disabledModsPath = path.join(parentDir, '{disabled_mod}');

      const isInActiveMods = modPath.includes(modsBasePath) && !modPath.includes('{disabled_mods}');

      let targetPath;
      if (isInActiveMods) {

        if (!fs.existsSync(disabledModsPath)) {
          fs.mkdirSync(disabledModsPath, { recursive: true });
        }
        targetPath = path.join(disabledModsPath, modName);
      } else {

        targetPath = path.join(modsBasePath, modName);
      }

      if (fs.existsSync(targetPath)) {
        return { success: false, error: 'A mod with this name already exists in the target location' };
      }

      fs.renameSync(modPath, targetPath);
      return { success: true, newPath: targetPath, isNowActive: !isInActiveMods };
    } catch (error) {
      console.error('Error toggling mod:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('read-plugins-folder', async (event, pluginsPath) => {
    try {
      const result = PluginUtils.readAllPlugins(pluginsPath);
      return result;
    } catch (error) {
      console.error('Error reading plugins folder:', error);
      return {
        activePlugins: [],
        disabledPlugins: [],
        error: error.message
      };
    }
  });

  ipcMain.handle('select-plugin-file', async (event, pluginsPath) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'NRO Files', extensions: ['nro'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const sourcePath = result.filePaths[0];
      const copyResult = PluginUtils.copyPlugin(sourcePath, pluginsPath);

      return copyResult;
    } catch (error) {
      console.error('Error selecting plugin file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('toggle-plugin', async (event, pluginPath, pluginsBasePath) => {
    try {
      const result = PluginUtils.togglePlugin(pluginPath, pluginsBasePath);
      return result;
    } catch (error) {
      console.error('Error toggling plugin:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-plugin', async (event, pluginPath) => {
    try {
      const result = PluginUtils.deletePlugin(pluginPath);
      return result;
    } catch (error) {
      console.error('Error deleting plugin:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('scan-mod-slots', async (event, modPath) => {
    try {
      const slots = ModUtils.scanModForSlots(modPath);
      return { success: true, slots };
    } catch (error) {
      console.error('Error scanning mod slots:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('apply-slot-changes', async (event, modPath, changes) => {
    try {
      const result = ModUtils.applySlotChanges(modPath, changes);
      return result;
    } catch (error) {
      console.error('Error applying slot changes:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('detect-conflicts', async (event, modsPath, whitelistPatterns = []) => {
    try {
      const result = ModUtils.readAllMods(modsPath);
      const conflicts = ModUtils.detectConflicts(result.activeMods, whitelistPatterns);
      
      return { 
        success: true, 
        conflicts: conflicts,
        totalConflicts: conflicts.length,
        activeModsCount: result.activeMods.length
      };
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('install-mod-from-path', async (event, sourcePath, modsPath) => {
    try {
      const result = await ModUtils.installModFromPath(sourcePath, modsPath);
      return result;
    } catch (error) {
      console.error('Error installing mod from path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('select-mod-file', async (event) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Archive Files', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
          { name: 'ZIP Files', extensions: ['zip'] },
          { name: 'RAR Files', extensions: ['rar'] },
          { name: '7Z Files', extensions: ['7z'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      console.error('Error selecting mod file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('handle-files-dropped', async (event, filePaths) => {
    try {
      const modsPath = store.get('modsPath');
      
      if (!modsPath) {
        return { success: false, error: 'Mods folder not configured. Please set it in Settings.' };
      }
      
      const results = [];
      
      for (const filePath of filePaths) {
        try {
          const installResult = await ModUtils.installModFromPath(filePath, modsPath);
          results.push({
            filePath,
            result: installResult
          });
        } catch (error) {
          results.push({
            filePath,
            result: { success: false, error: error.message }
          });
        }
      }
      
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  return mainWindow;
}

ipcMain.handle('open-tutorial-window', async () => {
  try {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    createTutorialWindow(mainWindow || null);
    return { success: true };
  } catch (error) {
    console.error('Error opening tutorial window:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('close-tutorial-window', () => {
  console.log('✅ Received close-tutorial-window event');
  closeTutorialWindow();
});

ipcMain.on('skip-tutorial', () => {
  console.log('✅ Received skip-tutorial event');
  closeTutorialWindow();
});

ipcMain.handle('get-migration-status', async () => {
  try {
    const status = await getMigrationStatus();
    return { success: true, ...status };
  } catch (error) {
    console.error('Error getting migration status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-mods-to-switch', async (event, config) => {
  const ftpClient = new FTPClient();
  let transferredCount = 0;
  
  try {
    // Normalize remote path - ensure it starts with /
    let remoteBasePath = (config.switchFtpPath || '/switch').replace(/\\/g, '/');
    if (!remoteBasePath.startsWith('/')) {
      remoteBasePath = '/' + remoteBasePath;
    }
    
    console.log('Starting FTP transfer to Switch:', {
      ip: config.switchIp,
      port: config.switchPort,
      remotePath: remoteBasePath
    });

    // Connect to Switch FTP server
    await ftpClient.connect(config.switchIp, config.switchPort);

    // If there are specific recent mods, only send those
    if (config.recentMods && config.recentMods.length > 0) {
      for (const mod of config.recentMods) {
        try {
          // Use folderPath if available, otherwise try to find by modName
          let localModPath = null;
          if (mod.folderPath && fs.existsSync(mod.folderPath)) {
            localModPath = mod.folderPath;
          } else {
            const modFolderName = mod.modName || mod.id;
            localModPath = path.join(config.modsPath, modFolderName);
          }
          
          if (localModPath && fs.existsSync(localModPath) && fs.statSync(localModPath).isDirectory()) {
            const remoteModPath = `${remoteBasePath}/${path.basename(localModPath)}`;
            const count = await ftpClient.uploadDirectory(localModPath, remoteModPath);
            transferredCount += count;
            console.log(`Successfully sent mod: ${path.basename(localModPath)} (${count} files)`);
          } else {
            console.warn(`Mod folder not found: ${localModPath}`);
          }
        } catch (modError) {
          console.error(`Error sending mod ${mod.modName}:`, modError);
          // Continue with next mod instead of failing completely
        }
      }
    } else {
      // Send all mods from the mods directory
      if (fs.existsSync(config.modsPath)) {
        const files = fs.readdirSync(config.modsPath);
        for (const file of files) {
          const localModPath = path.join(config.modsPath, file);
          if (fs.statSync(localModPath).isDirectory()) {
            const remoteModPath = `${remoteBasePath}/${file}`;
            const count = await ftpClient.uploadDirectory(localModPath, remoteModPath);
            transferredCount += count;
          }
        }
      }
    }

    await ftpClient.disconnect();
    
    console.log(`Successfully transferred ${transferredCount} files to Switch`);
    return { success: true, transferredCount };
  } catch (error) {
    console.error('Error sending mods to Switch:', error);
    try {
      await ftpClient.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-logs-path', () => {
  return logsDir;
});

ipcMain.handle('read-log-file', async (event, filePath) => {
  try {
    if (!filePath.startsWith(logsDir)) {
      throw new Error('Invalid log file path');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading log file:', error);
    return { success: false, error: error.message };
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {

  app.quit();
} else {

  app.whenReady().then(async () => {

    console.log('🔄 Checking for FightPlanner 3 settings...');
    const migrationResult = await migrateFromV3();

    if (migrationResult.migrated) {
      console.log('✅ Settings migrated from FightPlanner 3');
      console.log('📦 Migrated:', Object.keys(migrationResult.settings || {}).join(', '));
    }

    const hasLaunchedBefore = await store.get('hasLaunchedBefore');

    if (!hasLaunchedBefore) {

      console.log('🎉 First launch - opening tutorial only');
      await store.set('hasLaunchedBefore', true);

      const tempWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false
        }
      });

      const tutWindow = createTutorialWindow(tempWindow);

      tutWindow.on('closed', () => {
        tempWindow.close();

        console.log('✓ Tutorial completed. Opening main app...');
        createWindow();
      });
    } else {

      createWindow();
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}

