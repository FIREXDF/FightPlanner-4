const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ModUtils = require('./mod-utils');
const PluginUtils = require('./plugin-utils');
const store = require('./store');
const packageJson = require('../../package.json');
const { initializeProtocol, getProtocolHandler } = require('./main-protocol-setup');
const ProtocolHandler = require('./protocol-handler');
const { createTutorialWindow, closeTutorialWindow } = require('./tutorial-window');
const { migrateFromV3, getMigrationStatus } = require('./migration');
const FTPClient = require('./ftp-client');
const DiscordRPCManager = require('./discord-rpc');

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
let discordRPC = null;

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

  if (!discordRPC) {
    discordRPC = new DiscordRPCManager();
    discordRPC.connect().catch(err => {
      console.warn('Could not connect to Discord:', err.message);
    });
  }

  mainWindow.on('closed', () => {
    if (discordRPC) {
      discordRPC.disconnect();
      discordRPC = null;
    }
  });

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

  ipcMain.handle('save-mod-info', async (event, modPath, infoData) => {
    try {
      const infoPath = path.join(modPath, 'info.toml');
      let tomlContent = '';

      if (infoData.display_name) {
        tomlContent += `display_name = "${infoData.display_name}"\n`;
      }
      if (infoData.authors) {
        tomlContent += `authors = "${infoData.authors}"\n`;
      }
      if (infoData.version) {
        tomlContent += `version = "${infoData.version}"\n`;
      }
      if (infoData.category) {
        tomlContent += `category = "${infoData.category}"\n`;
      }
      if (infoData.url) {
        tomlContent += `url = "${infoData.url}"\n`;
      }
      if (infoData.description) {
        tomlContent += `description = """\n${infoData.description}\n"""\n`;
      }

      fs.writeFileSync(infoPath, tomlContent, 'utf8');
      console.log('info.toml saved successfully:', infoPath);

      return { success: true };
    } catch (error) {
      console.error('Error saving mod info:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('read-mod-info-raw', async (event, modPath) => {
    try {
      const infoPath = path.join(modPath, 'info.toml');
      
      if (!fs.existsSync(infoPath)) {
        return '';
      }

      const content = fs.readFileSync(infoPath, 'utf8');
      return content;
    } catch (error) {
      console.error('Error reading raw mod info:', error);
      return '';
    }
  });

  ipcMain.handle('save-mod-info-raw', async (event, modPath, tomlContent) => {
    try {
      const infoPath = path.join(modPath, 'info.toml');
      fs.writeFileSync(infoPath, tomlContent, 'utf8');
      console.log('info.toml saved successfully (raw):', infoPath);

      return { success: true };
    } catch (error) {
      console.error('Error saving raw mod info:', error);
      return { success: false, error: error.message };
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

ipcMain.handle('select-custom-file', async (event, fileType) => {
  try {
    const filters = fileType === 'css' 
      ? [{ name: 'CSS Files', extensions: ['css'] }]
      : [{ name: 'JavaScript Files', extensions: ['js'] }];

    const result = await dialog.showOpenDialog({
      title: `Select Custom ${fileType.toUpperCase()} File`,
      properties: ['openFile'],
      filters: filters
    });

    if (result.canceled) {
      return { canceled: true };
    }

    return { 
      success: true, 
      filePath: result.filePaths[0],
      canceled: false 
    };
  } catch (error) {
    console.error('Error selecting custom file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-custom-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading custom file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-temp-files', async () => {
  try {
    const tempPath = app.getPath('temp');
    const foldersToClean = ['fightplanner-downloads', 'fightplanner-extract'];
    
    let deletedFiles = 0;
    let deletedFolders = 0;
    let totalSize = 0;

    for (const folderName of foldersToClean) {
      const folderPath = path.join(tempPath, folderName);
      
      if (fs.existsSync(folderPath)) {
        const calculateSize = (dirPath) => {
          let size = 0;
          try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
              const itemPath = path.join(dirPath, item);
              const stats = fs.statSync(itemPath);
              if (stats.isDirectory()) {
                size += calculateSize(itemPath);
                deletedFolders++;
              } else {
                size += stats.size;
                deletedFiles++;
              }
            }
          } catch (err) {
            console.warn('Error calculating size:', err);
          }
          return size;
        };

        totalSize += calculateSize(folderPath);

        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(`Cleaned temporary folder: ${folderPath}`);
        } catch (err) {
          console.warn(`Failed to delete ${folderPath}:`, err.message);
        }
      }
    }

    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    return {
      success: true,
      deletedFiles,
      deletedFolders,
      totalSize: sizeMB
    };
  } catch (error) {
    console.error('Error clearing temp files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('discord-rpc-update', (event, data) => {
  console.log('Received discord-rpc-update:', data);
  
  if (!discordRPC) {
    console.warn('Discord RPC manager not initialized');
    return;
  }

  const { tab, modCount } = data;

  switch (tab) {
    case 'tools':
      console.log(`Setting Mods tab with ${modCount} mods`);
      discordRPC.setModsTab(modCount || 0);
      break;
    case 'plugins':
      console.log('Setting Plugins tab');
      discordRPC.setPluginsTab();
      break;
    case 'characters':
      console.log('Setting Characters tab');
      discordRPC.setCharactersTab();
      break;
    case 'downloads':
      console.log('Setting Downloads tab');
      discordRPC.setDownloadsTab();
      break;
    case 'social':
      console.log('Setting Social tab');
      discordRPC.setSocialTab();
      break;
    case 'settings':
      console.log('Setting Settings tab');
      discordRPC.setSettingsTab();
      break;
    default:
      console.log('Setting Idle state');
      discordRPC.setIdleState();
      break;
  }
});

ipcMain.handle('confirm-protocol-install', async (event, url, downloadId) => {
  const protocolHandler = getProtocolHandler();
  if (protocolHandler) {
    await protocolHandler.proceedWithInstall(downloadId);
    return { success: true };
  }
  return { success: false, error: 'Protocol handler not available' };
});

ipcMain.handle('cancel-protocol-install', async (event, downloadId) => {
  const protocolHandler = getProtocolHandler();
  if (protocolHandler && protocolHandler.pendingInstalls) {
    protocolHandler.pendingInstalls.delete(downloadId);
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('fetch-gamebanana-preview', async (event, modId) => {
  try {
    const https = require('https');
    const apiUrl = `https://gamebanana.com/apiv11/Mod/${modId}?_csvProperties=%40gbprofile`;
    
    return new Promise((resolve, reject) => {
      https.get(apiUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (json._aPreviewMedia && json._aPreviewMedia._aImages && json._aPreviewMedia._aImages.length > 0) {
              const firstImage = json._aPreviewMedia._aImages[0];
              if (firstImage._sBaseUrl && firstImage._sFile) {
                const imageUrl = firstImage._sBaseUrl + "/" + firstImage._sFile;
                resolve({ success: true, imageUrl });
                return;
              }
            }
            
            resolve({ success: false, error: 'No preview image found' });
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
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
    if (discordRPC) {
      discordRPC.disconnect();
      discordRPC = null;
    }
    if (process.platform !== 'darwin') app.quit();
  });
  
  app.on('quit', () => {
    if (discordRPC) {
      discordRPC.disconnect();
      discordRPC = null;
    }
  });
}

