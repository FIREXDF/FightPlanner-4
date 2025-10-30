class SettingsManager {
    constructor() {
        this.settings = { modsPath: null, pluginsPath: null };
        this.initialized = false;
        this.tabSwitchingAttached = false;
        this.initSettings();
        this.initializeUI();
    }

    async initSettings() {
        this.settings = await this.loadSettings();
    }

    initializeUI() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.initialized = true;
            });
        } else {
            this.setupEventListeners();
            this.initialized = true;
        }
    }

    setupEventListeners() {
        // Settings tab switching (use delegation, only attach once)
        if (!this.tabSwitchingAttached) {
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('settings-tab-btn')) {
                    this.switchSettingsTab(e.target.dataset.settingsTab);
                }
            });
            this.tabSwitchingAttached = true;
        }

        // Animation preference (custom selector with options)
        const animationSelector = document.getElementById('animation-preference');
        if (animationSelector && !animationSelector.dataset.listenerAttached) {
            // Add click listeners to each option
            animationSelector.querySelectorAll('.animation-option').forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.dataset.value;
                    this.setAnimationPreference(value);
                    // Update UI
                    animationSelector.querySelectorAll('.animation-option').forEach(opt => {
                        opt.classList.remove('active');
                    });
                    option.classList.add('active');
                });
            });
            animationSelector.dataset.listenerAttached = 'true';
            this.loadAnimationPreference();
        }

        // Browse mods folder
        const browseMods = document.getElementById('browse-mods-folder');
        if (browseMods && !browseMods.dataset.listenerAttached) {
            browseMods.addEventListener('click', () => this.browseModsFolder());
            browseMods.dataset.listenerAttached = 'true';
            console.log('Browse mods button listener attached');
        }

        // Browse plugins folder
        const browsePlugins = document.getElementById('browse-plugins-folder');
        if (browsePlugins && !browsePlugins.dataset.listenerAttached) {
            browsePlugins.addEventListener('click', () => this.browsePluginsFolder());
            browsePlugins.dataset.listenerAttached = 'true';
            console.log('Browse plugins button listener attached');
        }

        // Restart tutorial button
        const restartTutorialBtn = document.getElementById('restart-tutorial-btn');
        if (restartTutorialBtn && !restartTutorialBtn.dataset.listenerAttached) {
            restartTutorialBtn.addEventListener('click', async () => {
                // Open tutorial window directly
                if (window.tutorial) {
                    window.tutorial.show();
                }
            });
            restartTutorialBtn.dataset.listenerAttached = 'true';
            console.log('Restart tutorial button listener attached');
        }

        // Load saved paths
        this.updateModsFolderUI();
        this.updatePluginsFolderUI();
    }

    switchSettingsTab(tabName) {
        // Update buttons
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-settings-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update content with animation
        const currentActive = document.querySelector('.settings-tab-content.active');
        const newActive = document.getElementById(`settings-${tabName}`);
        
        if (currentActive && newActive && currentActive !== newActive) {
            // Fade out current
            currentActive.style.animation = 'settingsTabFadeOut 0.2s ease-out forwards';
            
            setTimeout(() => {
                currentActive.classList.remove('active');
                currentActive.style.animation = '';
                newActive.classList.add('active');
            }, 200);
        } else if (newActive) {
            // First time or same tab
            document.querySelectorAll('.settings-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            newActive.classList.add('active');
        }
    }

    async browseModsFolder() {
        if (!window.electronAPI || !window.electronAPI.selectFolder) {
            console.error('Electron API not available');
            return;
        }

        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            const oldPath = this.settings.modsPath;
            this.settings.modsPath = folder;
            this.saveSettings();
            this.updateModsFolderUI();
            
            // Only show warning if path changed and doesn't contain expected structure
            if (oldPath !== folder) {
                this.checkModsPath(folder);
            }
        }
    }

    checkModsPath(path) {
        if (!path) return;
        
        const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
        const hasCorrectStructure = normalizedPath.includes('ultimate/mods') || normalizedPath.includes('ultimate\\mods');
        
        if (!hasCorrectStructure) {
            this.showPathWarningModal(path);
        }
    }

    showPathWarningModal(path) {
        if (!window.modalManager) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <i class="bi bi-exclamation-triangle" style="color: #f59e0b; font-size: 24px; margin-right: 10px;"></i>
                    <h2>Path Warning</h2>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 15px;">The selected path doesn't seem to contain the expected structure:</p>
                    <code style="display: block; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; margin-bottom: 15px; word-break: break-all;">${path}</code>
                    <p style="margin-bottom: 10px;">Expected path should contain:</p>
                    <ul style="margin-left: 20px; margin-bottom: 15px; color: #aaa;">
                        <li><strong>ultimate/mods</strong></li>
                    </ul>
                    <p style="color: #888;">Example: <code>sd:/ultimate/mods</code></p>
                    <p style="margin-top: 15px; color: #f59e0b;">⚠️ Using an incorrect path may prevent mods from working.</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-primary" id="path-warning-ok">
                        <i class="bi bi-check-lg"></i>
                        OK, I understand
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const okBtn = modal.querySelector('#path-warning-ok');
        okBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async browsePluginsFolder() {
        if (!window.electronAPI || !window.electronAPI.selectFolder) {
            console.error('Electron API not available');
            return;
        }

        const folder = await window.electronAPI.selectFolder();
        if (folder) {
            this.settings.pluginsPath = folder;
            this.saveSettings();
            this.updatePluginsFolderUI();
        }
    }

    updateModsFolderUI() {
        const input = document.getElementById('mods-folder-path');
        if (input && this.settings.modsPath) {
            input.value = this.settings.modsPath;
        }
    }

    updatePluginsFolderUI() {
        const input = document.getElementById('plugins-folder-path');
        if (input && this.settings.pluginsPath) {
            input.value = this.settings.pluginsPath;
        }
    }

    async loadSettings() {
        try {
            const modsPath = await window.electronAPI.store.get('modsPath');
            const pluginsPath = await window.electronAPI.store.get('pluginsPath');
            return {
                modsPath: modsPath || null,
                pluginsPath: pluginsPath || null
            };
        } catch (error) {
            console.error('Failed to load settings:', error);
            return {
                modsPath: null,
                pluginsPath: null
            };
        }
    }

    async saveSettings() {
        try {
            await window.electronAPI.store.set('modsPath', this.settings.modsPath);
            await window.electronAPI.store.set('pluginsPath', this.settings.pluginsPath);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    getModsPath() {
        return this.settings.modsPath || null;
    }

    getPluginsPath() {
        return this.settings.pluginsPath || null;
    }

    hasModsPath() {
        return !!this.settings.modsPath;
    }

    hasPluginsPath() {
        return !!this.settings.pluginsPath;
    }

    async setAnimationPreference(preference) {
        try {
            await window.electronAPI.store.set('animationPreference', preference);
            this.applyAnimationPreference(preference);
        } catch (error) {
            console.error('Failed to save animation preference:', error);
        }
    }

    async loadAnimationPreference() {
        try {
            const preference = await window.electronAPI.store.get('animationPreference') || 'full';
            const animationSelector = document.getElementById('animation-preference');
            if (animationSelector) {
                // Update active state on custom selector
                animationSelector.querySelectorAll('.animation-option').forEach(option => {
                    if (option.dataset.value === preference) {
                        option.classList.add('active');
                    } else {
                        option.classList.remove('active');
                    }
                });
            }
            this.applyAnimationPreference(preference);
        } catch (error) {
            console.error('Failed to load animation preference:', error);
            this.applyAnimationPreference('full');
        }
    }

    applyAnimationPreference(preference) {
        document.body.classList.remove('reduced-animations', 'no-animations');
        
        if (preference === 'reduced') {
            document.body.classList.add('reduced-animations');
        } else if (preference === 'none') {
            document.body.classList.add('no-animations');
        }
    }

}

// Initialize settings manager globally
if (typeof window !== 'undefined') {
    window.settingsManager = new SettingsManager();
    console.log('Settings Manager initialized');
    
    // Apply animation preference on load
    if (window.electronAPI && window.electronAPI.store) {
        window.electronAPI.store.get('animationPreference').then(preference => {
            if (window.settingsManager && preference) {
                window.settingsManager.applyAnimationPreference(preference);
            }
        });
    }
}

