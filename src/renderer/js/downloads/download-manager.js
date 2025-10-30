// Download Manager - Manages downloads display in Downloads tab

class DownloadManager {
    constructor() {
        this.activeDownloads = new Map(); // downloadId -> download data
        this.completedDownloads = [];
        this.activeDownloadsList = null;
        this.completedDownloadsList = null;
        this.downloadsEmpty = null;
        this.downloadsCount = null;
        this.clearCompletedBtn = null;
        this.initialized = false;
    }

    initialize() {
        console.log('Initializing Download Manager...');
        
        // Get DOM elements
        this.activeDownloadsList = document.getElementById('active-downloads-list');
        this.completedDownloadsList = document.getElementById('completed-downloads-list');
        this.downloadsEmpty = document.getElementById('downloads-empty');
        this.downloadsCount = document.getElementById('downloads-count');
        this.clearCompletedBtn = document.getElementById('clear-completed-btn');

        if (!this.activeDownloadsList || !this.completedDownloadsList) {
            console.error('Download lists not found');
            return;
        }

        this.initialized = true;

        // Setup event listeners
        this.setupEventListeners();

        // Render any downloads that were started before initialization
        this.renderAllDownloads();

        // Update UI
        this.updateUI();

        console.log('Download Manager initialized');
    }

    /**
     * Render all stored downloads (called when tab is opened)
     */
    renderAllDownloads() {
        // Clear existing lists
        if (this.activeDownloadsList) {
            this.activeDownloadsList.innerHTML = '';
        }
        if (this.completedDownloadsList) {
            this.completedDownloadsList.innerHTML = '';
        }

        // Render active downloads
        this.activeDownloads.forEach(download => {
            this.renderActiveDownload(download);
        });

        // Render completed downloads
        this.completedDownloads.forEach(download => {
            this.renderCompletedDownload(download);
        });
    }

    setupEventListeners() {
        if (this.clearCompletedBtn) {
            this.clearCompletedBtn.addEventListener('click', () => {
                this.clearCompleted();
            });
        }
    }

    /**
     * Start a new download
     */
    startDownload(url) {
        const downloadId = Date.now().toString();
        const download = {
            id: downloadId,
            url: url,
            fileName: this.extractFileName(url),
            status: 'downloading',
            progress: 0,
            receivedBytes: 0,
            totalBytes: 0,
            startTime: Date.now()
        };

        this.activeDownloads.set(downloadId, download);
        
        // Only render if DOM is available
        if (this.initialized) {
            this.renderActiveDownload(download);
            this.updateUI();
        }
        
        // Always update badge (works even without DOM)
        this.updateBadge();

        // Don't auto-switch tabs - just show badge notification

        return downloadId;
    }

    /**
     * Update download progress
     */
    updateProgress(downloadId, progress, receivedBytes, totalBytes) {
        const download = this.activeDownloads.get(downloadId);
        if (!download) {
            // If no specific download ID, update the most recent one
            const downloads = Array.from(this.activeDownloads.values());
            if (downloads.length > 0) {
                const latestDownload = downloads[downloads.length - 1];
                this.updateProgress(latestDownload.id, progress, receivedBytes, totalBytes);
            }
            return;
        }

        download.progress = progress;
        download.receivedBytes = receivedBytes;
        download.totalBytes = totalBytes;

        // Update the download element
        const element = document.querySelector(`[data-download-id="${downloadId}"]`);
        if (element) {
            const progressBar = element.querySelector('.download-progress-fill');
            const progressText = element.querySelector('.download-progress-text');
            
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
            
            if (progressText) {
                progressText.textContent = `${progress}% (${this.formatBytes(receivedBytes)} / ${this.formatBytes(totalBytes)})`;
            }
        }
    }

    /**
     * Complete a download
     */
    completeDownload(downloadId, modName) {
        const download = this.activeDownloads.get(downloadId);
        if (!download) {
            // If no specific download ID, complete the most recent one
            const downloads = Array.from(this.activeDownloads.values());
            if (downloads.length > 0) {
                const latestDownload = downloads[downloads.length - 1];
                this.completeDownload(latestDownload.id, modName);
            }
            return;
        }

        download.status = 'completed';
        download.progress = 100;
        download.modName = modName || download.fileName;
        download.endTime = Date.now();

        // Move to completed list
        this.activeDownloads.delete(downloadId);
        this.completedDownloads.unshift(download); // Add at the beginning

        // Only manipulate DOM if initialized
        if (this.initialized) {
            // Remove from active list
            const element = document.querySelector(`[data-download-id="${downloadId}"]`);
            if (element) {
                element.remove();
            }

            // Add to completed list
            this.renderCompletedDownload(download);
            this.updateUI();
        }
        
        this.updateBadge();
    }

    /**
     * Fail a download
     */
    failDownload(downloadId, error) {
        const download = this.activeDownloads.get(downloadId);
        if (!download) {
            // If no specific download ID, fail the most recent one
            const downloads = Array.from(this.activeDownloads.values());
            if (downloads.length > 0) {
                const latestDownload = downloads[downloads.length - 1];
                this.failDownload(latestDownload.id, error);
            }
            return;
        }

        download.status = 'failed';
        download.error = error;

        // Update the download element
        const element = document.querySelector(`[data-download-id="${downloadId}"]`);
        if (element) {
            element.classList.add('download-failed');
            const statusText = element.querySelector('.download-status-text');
            if (statusText) {
                statusText.innerHTML = `<i class="bi bi-x-circle"></i> Failed: ${error}`;
                statusText.style.color = '#ff4444';
            }
        }

        // Remove from active downloads after 5 seconds
        setTimeout(() => {
            this.activeDownloads.delete(downloadId);
            if (element) {
                element.remove();
            }
            this.updateUI();
            this.updateBadge();
        }, 5000);
    }

    /**
     * Render active download
     */
    renderActiveDownload(download) {
        // Only render if DOM is available
        if (!this.activeDownloadsList) return;

        const element = document.createElement('div');
        element.className = 'download-item download-active';
        element.setAttribute('data-download-id', download.id);
        element.innerHTML = `
            <div class="download-icon">
                <i class="bi bi-download"></i>
            </div>
            <div class="download-info">
                <div class="download-name">${download.fileName}</div>
                <div class="download-url">${this.shortenUrl(download.url)}</div>
                <div class="download-progress-container">
                    <div class="download-progress-bar">
                        <div class="download-progress-fill" style="width: ${download.progress}%"></div>
                    </div>
                    <div class="download-progress-text">0%</div>
                </div>
                <div class="download-status-text">Downloading...</div>
            </div>
        `;

        this.activeDownloadsList.appendChild(element);
    }

    /**
     * Render completed download
     */
    renderCompletedDownload(download) {
        // Only render if DOM is available
        if (!this.completedDownloadsList) return;

        const element = document.createElement('div');
        element.className = 'download-item download-completed';
        element.setAttribute('data-download-id', download.id);
        
        const duration = this.formatDuration(download.endTime - download.startTime);
        
        element.innerHTML = `
            <div class="download-icon download-icon-success">
                <i class="bi bi-check-circle-fill"></i>
            </div>
            <div class="download-info">
                <div class="download-name">${download.modName || download.fileName}</div>
                <div class="download-url">${this.shortenUrl(download.url)}</div>
                <div class="download-meta">
                    <span><i class="bi bi-check-circle"></i> Completed in ${duration}</span>
                    <span><i class="bi bi-file-earmark-zip"></i> ${this.formatBytes(download.totalBytes)}</span>
                </div>
            </div>
        `;

        this.completedDownloadsList.appendChild(element);
    }

    /**
     * Update UI visibility
     */
    updateUI() {
        const hasActiveDownloads = this.activeDownloads.size > 0;
        const hasCompletedDownloads = this.completedDownloads.length > 0;
        const hasAnyDownloads = hasActiveDownloads || hasCompletedDownloads;

        // Show/hide empty state
        if (this.downloadsEmpty) {
            this.downloadsEmpty.style.display = hasAnyDownloads ? 'none' : 'flex';
        }

        // Show/hide sections
        const activeSections = document.getElementById('active-downloads-section');
        const completedSections = document.getElementById('completed-downloads-section');
        
        if (activeSections) {
            activeSections.style.display = hasActiveDownloads ? 'block' : 'none';
        }
        
        if (completedSections) {
            completedSections.style.display = hasCompletedDownloads ? 'block' : 'none';
        }

        // Update count
        if (this.downloadsCount) {
            const totalCount = this.activeDownloads.size + this.completedDownloads.length;
            this.downloadsCount.textContent = totalCount;
        }

        // Clear completed button
        if (this.clearCompletedBtn) {
            this.clearCompletedBtn.style.display = hasCompletedDownloads ? 'block' : 'none';
        }
    }

    /**
     * Update notification badge
     */
    updateBadge() {
        const downloadsBtn = document.querySelector('[data-tab="downloads"]');
        if (!downloadsBtn) return;

        let badge = downloadsBtn.querySelector('.notification-badge');
        
        if (this.activeDownloads.size > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'notification-badge';
                downloadsBtn.style.position = 'relative';
                downloadsBtn.appendChild(badge);
            }
            badge.textContent = this.activeDownloads.size;
            badge.style.display = 'flex';
        } else {
            if (badge) {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * Switch to downloads tab
     */
    switchToDownloadsTab() {
        const downloadsBtn = document.querySelector('[data-tab="downloads"]');
        if (downloadsBtn) {
            downloadsBtn.click();
        }
    }

    /**
     * Clear completed downloads
     */
    clearCompleted() {
        this.completedDownloads = [];
        if (this.completedDownloadsList) {
            this.completedDownloadsList.innerHTML = '';
        }
        this.updateUI();
    }

    /**
     * Extract filename from URL
     */
    extractFileName(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
            return filename || 'mod.zip';
        } catch {
            return 'mod.zip';
        }
    }

    /**
     * Shorten URL for display
     */
    shortenUrl(url) {
        if (url.length > 60) {
            return url.substring(0, 57) + '...';
        }
        return url;
    }

    /**
     * Format bytes
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }
}

// Initialize on window load
if (typeof window !== 'undefined') {
    window.downloadManager = new DownloadManager();
    console.log('Download Manager created');
}

