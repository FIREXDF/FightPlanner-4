const { contextBridge, ipcRenderer } = require('electron');

console.log('Tutorial preload.js loaded!');

contextBridge.exposeInMainWorld('tutorialAPI', {
    closeTutorial: () => {
        console.log('tutorialAPI.closeTutorial() called from renderer');
        ipcRenderer.send('close-tutorial-window');
        console.log('IPC event "close-tutorial-window" sent');
    },
    skipTutorial: () => {
        console.log('tutorialAPI.skipTutorial() called from renderer');
        ipcRenderer.send('skip-tutorial');
        console.log('IPC event "skip-tutorial" sent');
    },
    getMigrationStatus: () => ipcRenderer.invoke('get-migration-status'),
    onAnimationComplete: (callback) => ipcRenderer.on('animation-complete', callback),
    
    // Settings & File System
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    saveSetting: (key, value) => ipcRenderer.invoke('store-set', key, value),
    getSetting: (key) => ipcRenderer.invoke('store-get', key)
});

console.log('tutorialAPI exposed to window');
