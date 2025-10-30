// Protocol Listener - Handles incoming protocol events from main process

class ProtocolListener {
    constructor() {
        this.currentDownloadId = null;
        this.setupListeners();
    }

    setupListeners() {
        if (!window.electronAPI) {
            console.error('Electron API not available');
            return;
        }

        // Listen for mod installation events
        window.electronAPI.onModInstallStart((data) => {
            console.log('Mod installation started:', data);
            
            // Start download in download manager
            if (window.downloadManager) {
                this.currentDownloadId = window.downloadManager.startDownload(data.url);
            }
            
            if (window.toastManager) {
                window.toastManager.info('Download started...');
            }
        });

        window.electronAPI.onModDownloadProgress((data) => {
            // Update progress in download manager
            if (window.downloadManager && this.currentDownloadId) {
                window.downloadManager.updateProgress(
                    this.currentDownloadId,
                    data.progress,
                    data.receivedBytes,
                    data.totalBytes
                );
            }
        });

        window.electronAPI.onModInstallSuccess((data) => {
            console.log('Mod installed successfully:', data);
            
            // Complete download in download manager
            if (window.downloadManager && this.currentDownloadId) {
                window.downloadManager.completeDownload(this.currentDownloadId, data.modName);
            }
            
            if (window.toastManager) {
                window.toastManager.success('Mod installed successfully! 🎉');
            }
            
            // Refresh mod list
            setTimeout(() => {
                if (window.modManager) {
                    console.log('Refreshing mod list...');
                    window.modManager.fetchMods();
                }
            }, 500);
            
            this.currentDownloadId = null;
        });

        window.electronAPI.onModInstallError((data) => {
            console.error('Mod installation failed:', data);
            
            // Fail download in download manager
            if (window.downloadManager && this.currentDownloadId) {
                window.downloadManager.failDownload(this.currentDownloadId, data.error);
            }
            
            if (window.toastManager) {
                window.toastManager.error(`Installation failed: ${data.error}`);
            }
            
            this.currentDownloadId = null;
        });
    }

}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    window.protocolListener = new ProtocolListener();
    console.log('Protocol Listener initialized');
}


