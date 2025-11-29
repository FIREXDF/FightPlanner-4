const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { initializeProtocol } = require('./main-protocol-setup');
const { createTutorialWindow } = require('./tutorial-window');
const { migrateFromV3 } = require('./migration');
const DiscordRPCManager = require('./discord-rpc');
const { registerAllHandlers } = require('./ipc');
const { PATHS, TEMP_FOLDERS } = require('./config');

const AnimationHandler = require('./animations/animation-handler');

const logsDir = PATHS.logsDir();
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


function createWindow(options = {}) {
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
    hasShadow: true,
    show: false // Start hidden, show when ready
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
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize animation handler with this window
    AnimationHandler.initialize(mainWindow);
    
    if (options.animate) {
      mainWindow.webContents.send('start-intro-animation');
    }
  });

  // Drop handler for window level events
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

  const loadPath = path.join(__dirname, '../renderer/index.html');
  if (options.animate) {
    mainWindow.loadFile(loadPath, { query: { animate: 'true' } });
  } else {
    mainWindow.loadFile(loadPath);
  }

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

  return mainWindow;
}


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    registerAllHandlers(ipcMain, discordRPC);

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
        createWindow({ animate: true });
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
