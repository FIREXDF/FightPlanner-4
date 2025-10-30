const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('minimize-window'),
    maximize: () => ipcRenderer.send('maximize-window'),
    close: () => ipcRenderer.send('close-window'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    readModsFolder: (path) => ipcRenderer.invoke('read-mods-folder', path),
    getPreviewImage: (modPath) => ipcRenderer.invoke('get-preview-image', modPath),
    getModInfo: (modPath) => ipcRenderer.invoke('get-mod-info', modPath),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    openUrl: (url) => ipcRenderer.invoke('open-url', url),
    renameMod: (modPath, newName) => ipcRenderer.invoke('rename-mod', modPath, newName),
    deleteMod: (modPath) => ipcRenderer.invoke('delete-mod', modPath),
    toggleMod: (modPath, modsBasePath) => ipcRenderer.invoke('toggle-mod', modPath, modsBasePath),
    // Plugin operations
    readPluginsFolder: (path) => ipcRenderer.invoke('read-plugins-folder', path),
    selectPluginFile: (pluginsPath) => ipcRenderer.invoke('select-plugin-file', pluginsPath),
    togglePlugin: (pluginPath, pluginsBasePath) => ipcRenderer.invoke('toggle-plugin', pluginPath, pluginsBasePath),
    deletePlugin: (pluginPath) => ipcRenderer.invoke('delete-plugin', pluginPath),
    store: {
        get: (key) => ipcRenderer.invoke('store-get', key),
        set: (key, value) => ipcRenderer.invoke('store-set', key, value),
        delete: (key) => ipcRenderer.invoke('store-delete', key),
        clear: () => ipcRenderer.invoke('store-clear')
    },
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    scanModForFighters: (modPath) => ipcRenderer.invoke('scan-mod-for-fighters', modPath),
    // Slot management
    scanModSlots: (modPath) => ipcRenderer.invoke('scan-mod-slots', modPath),
    applySlotChanges: (modPath, changes) => ipcRenderer.invoke('apply-slot-changes', modPath, changes),
    // Tutorial window
    openTutorialWindow: () => ipcRenderer.invoke('open-tutorial-window'),
    // Protocol events
    onModInstallStart: (callback) => ipcRenderer.on('mod-install-start', (event, data) => callback(data)),
    onModDownloadProgress: (callback) => ipcRenderer.on('mod-download-progress', (event, data) => callback(data)),
    onModInstallSuccess: (callback) => ipcRenderer.on('mod-install-success', (event, data) => callback(data)),
    onModInstallError: (callback) => ipcRenderer.on('mod-install-error', (event, data) => callback(data))
});

