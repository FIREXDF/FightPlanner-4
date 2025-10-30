const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ModUtils = require('./mod-utils');
const PluginUtils = require('./plugin-utils');
const store = require('./store');
const packageJson = require('../../package.json');
const { initializeProtocol } = require('./main-protocol-setup');
const { createTutorialWindow, closeTutorialWindow } = require('./tutorial-window');
const { migrateFromV3, getMigrationStatus } = require('./migration');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#1a1a1a',
    frame: false,
    transparent: false, // Will be enabled dynamically when tutorial starts
    hasShadow: true
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Initialize protocol handling
  initializeProtocol(mainWindow);

  // Window controls
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

  // Folder selection
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Read mods folder
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

  // Get preview image from mod folder
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

  // Get mod info from info.toml file
  ipcMain.handle('get-mod-info', async (event, modPath) => {
    try {
      const modInfo = ModUtils.readModInfo(modPath);
      return modInfo;
    } catch (error) {
      console.error('Error getting mod info:', error);
      return null;
    }
  });

  // Open folder in system file explorer
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

  // Open URL in default browser
  ipcMain.handle('open-url', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Error opening URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Store operations
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

  // Get app version
  ipcMain.handle('get-app-version', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome
    };
  });

  // Scan mod for fighter folders
  ipcMain.handle('scan-mod-for-fighters', async (event, modPath) => {
    try {
      const fighters = [];
      const fighterPath = path.join(modPath, 'fighter');
      
      // Check if fighter folder exists
      if (fs.existsSync(fighterPath)) {
        const fighterDirs = fs.readdirSync(fighterPath, { withFileTypes: true });
        
        // Get all subdirectories (character folders)
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

  // Mod operations
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
      
      // Delete folder recursively
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
      
      // Check if mod is currently active or disabled
      const isInActiveMods = modPath.includes(modsBasePath) && !modPath.includes('{disabled_mods}');
      
      let targetPath;
      if (isInActiveMods) {
        // Move to disabled_mods
        if (!fs.existsSync(disabledModsPath)) {
          fs.mkdirSync(disabledModsPath, { recursive: true });
        }
        targetPath = path.join(disabledModsPath, modName);
      } else {
        // Move to active mods
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

  // Plugin operations
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

  // Slot management operations
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

  return mainWindow;
}

// Tutorial window IPC handlers (OUTSIDE createWindow so they work on first launch)
ipcMain.handle('open-tutorial-window', async () => {
  try {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0]; // Get any window as parent
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

// Migration status IPC handler
ipcMain.handle('get-migration-status', async () => {
  try {
    const status = await getMigrationStatus();
    return { success: true, ...status };
  } catch (error) {
    console.error('Error getting migration status:', error);
    return { success: false, error: error.message };
  }
});

// Make app single instance (nécessaire pour le protocole sur Windows)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Si une autre instance existe déjà, on quitte
  app.quit();
} else {
  // On est la première instance, on continue normalement
  app.whenReady().then(async () => {
    // Migrate from FightPlanner 3 if needed
    console.log('🔄 Checking for FightPlanner 3 settings...');
    const migrationResult = await migrateFromV3();
    
    if (migrationResult.migrated) {
      console.log('✅ Settings migrated from FightPlanner 3');
      console.log('📦 Migrated:', Object.keys(migrationResult.settings || {}).join(', '));
    }
    
    // Check if it's the first launch
    const hasLaunchedBefore = await store.get('hasLaunchedBefore');
    
    if (!hasLaunchedBefore) {
      // FIRST LAUNCH - Open only tutorial window
      console.log('🎉 First launch - opening tutorial only');
      await store.set('hasLaunchedBefore', true);
      
      // Create a temporary invisible window (needed for parent)
      const tempWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false
        }
      });
      
      // Open tutorial window
      const tutWindow = createTutorialWindow(tempWindow);
      
      // When tutorial closes, open main app
      tutWindow.on('closed', () => {
        tempWindow.close();
        // Open main app after tutorial
        console.log('✓ Tutorial completed. Opening main app...');
        createWindow();
      });
    } else {
      // NORMAL LAUNCH - Open main app
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

