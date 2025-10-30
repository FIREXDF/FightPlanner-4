// Plugin Manager - Gestion des plugins .nro

class PluginManager {
    constructor() {
        this.plugins = [];
        this.pluginListContainer = null;
        this.pluginsPath = null;
        this.searchQuery = '';
        
        // Wait for DOM if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initContainer());
        } else {
            this.initContainer();
        }
    }

    initContainer() {
        this.pluginListContainer = document.getElementById('plugin-list');
        if (!this.pluginListContainer) {
            console.warn("Plugin list container not found - will be initialized later");
            return;
        }
        
        console.log('Plugin Manager initialized');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('plugin-search');
        if (searchInput && !searchInput.dataset.listenerAttached) {
            searchInput.addEventListener('input', (e) => this.filterPlugins(e.target.value));
            searchInput.dataset.listenerAttached = 'true';
        }

        // Add plugin button
        const addBtn = document.getElementById('add-plugin-btn');
        if (addBtn && !addBtn.dataset.listenerAttached) {
            addBtn.addEventListener('click', () => this.addPlugin());
            addBtn.dataset.listenerAttached = 'true';
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-plugin-btn');
        if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
            refreshBtn.addEventListener('click', () => this.refreshPlugins());
            refreshBtn.dataset.listenerAttached = 'true';
        }

        // Open folder button
        const openFolderBtn = document.getElementById('open-plugin-folder-btn');
        if (openFolderBtn && !openFolderBtn.dataset.listenerAttached) {
            openFolderBtn.addEventListener('click', () => this.openPluginFolder());
            openFolderBtn.dataset.listenerAttached = 'true';
        }
    }

    // Force re-initialization (called when tab content is loaded)
    reinitialize() {
        console.log('Reinitializing Plugin Manager...');
        this.initContainer();
        
        // If we have plugins to display, render them
        if (this.plugins.length > 0) {
            this.renderPluginList();
        }
    }

    // Filter plugins by search query
    filterPlugins(query) {
        this.searchQuery = query.toLowerCase();
        this.updateVisibility();
    }

    // Update visibility based on search
    updateVisibility() {
        if (!this.pluginListContainer) {
            this.pluginListContainer = document.getElementById('plugin-list');
        }
        
        if (!this.pluginListContainer) {
            console.warn('Cannot update visibility: container not found');
            return;
        }

        const pluginItems = this.pluginListContainer.querySelectorAll('.plugin-item');
        let visibleCount = 0;

        pluginItems.forEach(item => {
            const pluginName = item.querySelector('.plugin-name')?.textContent.toLowerCase() || '';
            const matches = pluginName.includes(this.searchQuery);
            
            if (matches) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        this.updatePluginCount(visibleCount);
    }

    // Load plugins from data
    async loadPlugins(pluginsData) {
        console.log('Loading plugins:', pluginsData);
        this.plugins = pluginsData;
        this.renderPluginList();
    }

    // Render plugin list
    renderPluginList() {
        if (!this.pluginListContainer) {
            this.pluginListContainer = document.getElementById('plugin-list');
        }
        
        if (!this.pluginListContainer) {
            console.warn('Plugin list container not found, skipping render');
            return;
        }

        console.log('Rendering plugins, count:', this.plugins.length);

        if (this.plugins.length === 0) {
            this.pluginListContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No plugins available</p>';
            this.updatePluginCount(0);
            return;
        }

        // Clear container
        this.pluginListContainer.innerHTML = '';

        // Render each plugin
        this.plugins.forEach((plugin, index) => {
            console.log(`Creating element for plugin ${index}:`, plugin);
            const pluginElement = this.createPluginElement(plugin);
            this.pluginListContainer.appendChild(pluginElement);
        });

        console.log('Plugin list rendered, total items:', this.pluginListContainer.children.length);
        this.updatePluginCount(this.plugins.length);
    }

    // Create plugin element
    createPluginElement(plugin) {
        const div = document.createElement('div');
        div.className = 'plugin-item';
        div.dataset.pluginId = plugin.id;
        
        // Status indicator
        const statusClass = plugin.status === 'active' ? 'status-active' : 'status-disabled';
        
        div.innerHTML = `
            <div class="plugin-status ${statusClass}"></div>
            <div class="plugin-item-content">
                <span class="plugin-name">${this.escapeHtml(plugin.name)}</span>
                <span class="plugin-size">${plugin.size}</span>
            </div>
            <div class="plugin-actions">
                ${plugin.status === 'active' 
                    ? `<button class="action-btn-small toggle-plugin-btn" data-plugin-id="${plugin.id}" title="Disable">
                        <i class="bi bi-pause-circle"></i>
                       </button>` 
                    : `<button class="action-btn-small toggle-plugin-btn" data-plugin-id="${plugin.id}" title="Enable">
                        <i class="bi bi-play-circle"></i>
                       </button>`
                }
                <button class="action-btn-small delete-plugin-btn" data-plugin-id="${plugin.id}" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        // Toggle button
        const toggleBtn = div.querySelector('.toggle-plugin-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePlugin(plugin.id);
            });
        }

        // Delete button
        const deleteBtn = div.querySelector('.delete-plugin-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePlugin(plugin.id);
            });
        }

        return div;
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update plugin count (removed - not needed with new UI)
    updatePluginCount(count) {
        // Plugin count is now displayed in the list itself
    }

    // Add plugin
    async addPlugin() {
        if (!this.pluginsPath) {
            console.warn('No plugins path set');
            if (typeof alert !== 'undefined') {
                alert('Please set the plugins folder path in Settings first');
            }
            return;
        }

        if (!window.electronAPI || !window.electronAPI.selectPluginFile) {
            console.error('Electron API not available');
            return;
        }

        try {
            const result = await window.electronAPI.selectPluginFile(this.pluginsPath);
            
            if (result.success) {
                console.log('Plugin added successfully');
                if (window.toastManager) {
                    window.toastManager.success('Plugin added successfully');
                }
                this.refreshPlugins();
            } else if (result.error) {
                console.error('Error adding plugin:', result.error);
                if (window.toastManager) {
                    window.toastManager.error(`Failed to add plugin: ${result.error}`);
                } else if (typeof alert !== 'undefined') {
                    alert(`Error: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Error adding plugin:', error);
        }
    }

    // Toggle plugin (enable/disable)
    async togglePlugin(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (!plugin) return;

        if (!window.electronAPI || !window.electronAPI.togglePlugin) {
            console.error('Electron API not available');
            return;
        }

        // Add animation to the plugin item
        const pluginElement = this.pluginListContainer.querySelector(`[data-plugin-id="${pluginId}"]`);
        if (pluginElement) {
            pluginElement.classList.add('plugin-toggling');
        }

        try {
            const result = await window.electronAPI.togglePlugin(plugin.filePath, this.pluginsPath);
            
            if (result.success) {
                console.log('Plugin toggled successfully');
                
                const wasActive = plugin.status === 'active';
                if (window.toastManager) {
                    window.toastManager.success(wasActive ? 'Plugin disabled' : 'Plugin enabled');
                }
                
                // Wait for animation to complete before refreshing
                setTimeout(() => {
                    this.refreshPlugins();
                }, 300);
            } else {
                console.error('Error toggling plugin:', result.error);
                if (pluginElement) {
                    pluginElement.classList.remove('plugin-toggling');
                }
                if (window.toastManager) {
                    window.toastManager.error(`Failed to toggle plugin: ${result.error}`);
                } else if (typeof alert !== 'undefined') {
                    alert(`Error: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Error toggling plugin:', error);
            if (pluginElement) {
                pluginElement.classList.remove('plugin-toggling');
            }
        }
    }

    // Delete plugin
    async deletePlugin(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (!plugin) return;

        // Use modal instead of confirm
        if (window.modalManager) {
            window.modalManager.openDeletePluginModal(plugin, async () => {
                await this.executeDeletePlugin(plugin);
            });
        } else {
            // Fallback to confirm if modal manager not available
            if (!confirm(`Are you sure you want to delete "${plugin.name}"?`)) {
                return;
            }
            await this.executeDeletePlugin(plugin);
        }
    }

    // Execute the actual delete operation
    async executeDeletePlugin(plugin) {
        if (!window.electronAPI || !window.electronAPI.deletePlugin) {
            console.error('Electron API not available');
            return;
        }

        // Add animation to the plugin item
        const pluginElement = this.pluginListContainer.querySelector(`[data-plugin-id="${plugin.id}"]`);
        if (pluginElement) {
            pluginElement.classList.add('plugin-deleting');
        }

        try {
            const result = await window.electronAPI.deletePlugin(plugin.filePath);
            
            if (result.success) {
                console.log('Plugin deleted successfully');
                
                // Wait for animation before showing toast and refreshing
                setTimeout(() => {
                    if (window.toastManager) {
                        window.toastManager.success(`Plugin "${plugin.name}" has been deleted`);
                    }
                    this.refreshPlugins();
                }, 300);
            } else {
                console.error('Error deleting plugin:', result.error);
                if (pluginElement) {
                    pluginElement.classList.remove('plugin-deleting');
                }
                if (window.toastManager) {
                    window.toastManager.error(`Failed to delete plugin: ${result.error}`);
                } else if (window.modalManager) {
                    window.modalManager.showAlert('error', 'Error', `Failed to delete plugin: ${result.error}`);
                } else if (typeof alert !== 'undefined') {
                    alert(`Error: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Error deleting plugin:', error);
            if (pluginElement) {
                pluginElement.classList.remove('plugin-deleting');
            }
            if (window.modalManager) {
                window.modalManager.showAlert('error', 'Error', `An error occurred: ${error.message}`);
            }
        }
    }

    // Load plugins from folder
    async loadPluginsFromFolder(pluginsPath) {
        if (!window.electronAPI || !window.electronAPI.readPluginsFolder) {
            console.error('Electron API not available');
            return;
        }

        this.pluginsPath = pluginsPath;

        try {
            const result = await window.electronAPI.readPluginsFolder(pluginsPath);
            
            if (result.error) {
                console.error('Error reading plugins:', result.error);
                this.loadPlugins([]);
                return;
            }

            const allPlugins = [];
            let idCounter = 1;

            // Active plugins
            for (const plugin of result.activePlugins) {
                allPlugins.push({
                    id: String(idCounter++),
                    name: plugin.name,
                    size: plugin.size,
                    status: 'active',
                    filePath: plugin.path
                });
            }

            // Disabled plugins
            for (const plugin of result.disabledPlugins) {
                allPlugins.push({
                    id: String(idCounter++),
                    name: plugin.name,
                    size: plugin.size,
                    status: 'disabled',
                    filePath: plugin.path
                });
            }

            this.loadPlugins(allPlugins);
        } catch (error) {
            console.error('Failed to load plugins from folder:', error);
            this.loadPlugins([]);
        }
    }

    // Refresh plugins
    async refreshPlugins() {
        if (typeof window.settingsManager !== 'undefined' && window.settingsManager) {
            const pluginsPath = window.settingsManager.getPluginsPath();
            if (pluginsPath) {
                console.log('Refreshing plugins from saved path:', pluginsPath);
                this.loadPluginsFromFolder(pluginsPath);
                return;
            }
        }
        
        console.log('No plugins path set');
    }

    // Fetch plugins (load on startup)
    async fetchPlugins() {
        if (typeof window.settingsManager !== 'undefined' && window.settingsManager) {
            const pluginsPath = window.settingsManager.getPluginsPath();
            if (pluginsPath) {
                console.log('Loading plugins from saved path:', pluginsPath);
                this.loadPluginsFromFolder(pluginsPath);
                return;
            }
        }
        
        console.log('No plugins path configured');
    }

    // Open plugin folder
    async openPluginFolder() {
        if (!this.pluginsPath) {
            console.warn('No plugins path set');
            return;
        }

        if (!window.electronAPI || !window.electronAPI.openFolder) {
            console.error('Electron API not available');
            return;
        }

        try {
            const result = await window.electronAPI.openFolder(this.pluginsPath);
            if (!result.success) {
                console.error('Failed to open folder:', result.error);
            }
        } catch (error) {
            console.error('Error opening folder:', error);
        }
    }
}

// Initialize plugin manager globally
if (typeof window !== 'undefined') {
    window.pluginManager = new PluginManager();
    console.log('Plugin Manager initialized');
}

