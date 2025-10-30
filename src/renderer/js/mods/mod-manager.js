// Mod Manager - Orchestrateur principal
// Coordonne les différents composants de gestion des mods

class ModManager {
    constructor() {
        this.mods = [];
        this.selectedMod = null;
        this.modListContainer = null;
        this.modsPath = null;
        this.searchQuery = '';
        this.categoryFilter = '';
        this.renderedModIds = new Set();
        
        // Initialize sub-components
        this.listRenderer = null;
        this.contextMenuHandler = null;
        this.operations = null;
        
        // Wait for DOM if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initContainer());
        } else {
            this.initContainer();
        }
    }

    initContainer() {
        this.modListContainer = document.getElementById('mod-list');
        if (!this.modListContainer) {
            console.warn("Mod list container not found - will be initialized later");
            return;
        }
        
        // Initialize sub-components only if not already done
        if (!this.listRenderer) {
            this.listRenderer = new window.ModListRenderer(this);
        }
        if (!this.contextMenuHandler) {
            this.contextMenuHandler = new window.ModContextMenuHandler(this);
        }
        if (!this.operations) {
            this.operations = new window.ModOperations(this);
        }
        
        console.log('Mod Manager components initialized');
    }
    
    // Force re-initialization (called when tab content is loaded)
    reinitialize() {
        this.initContainer();
        
        // If we have mods to display, render them
        // Don't reapply filters here - let tabs-loader handle it
        if (this.mods.length > 0) {
            this.renderModList(true);
        }
    }

    // Filtrer les mods par recherche
    filterMods(query) {
        this.searchQuery = query.toLowerCase();
        this.updateVisibility();
    }

    // Filtrer les mods par catégorie
    filterByCategory(category) {
        this.categoryFilter = category;
        this.updateVisibility();
    }

    // Mise à jour de la visibilité des mods
    updateVisibility() {
        // Ensure container exists
        if (!this.modListContainer) {
            this.modListContainer = document.getElementById('mod-list');
        }
        
        if (!this.modListContainer) {
            console.warn('Cannot update visibility: container not found');
            return;
        }
        
        // Ensure listRenderer exists
        if (!this.listRenderer) {
            console.warn('List renderer not initialized, doing full render instead');
            this.renderModList(true);
            return;
        }
        
        const success = this.listRenderer.updateVisibility(
            this.mods, 
            this.modListContainer, 
            this.searchQuery,
            this.categoryFilter
        );
        
        if (!success) {
            // DOM is incomplete, do a full render
            this.renderModList(true);
        }
    }

    // Ajouter des mods (appelé quand tu fetch les mods)
    async loadMods(modsData) {
        this.mods = modsData;
        this.renderModList(true);
    }

    // Rendu de la liste des mods
    renderModList(forceRender = false) {
        if (!this.modListContainer) {
            this.modListContainer = document.getElementById('mod-list');
        }
        
        if (!this.modListContainer) {
            console.warn('Mod list container not found, skipping render');
            return;
        }
        
        // Ensure listRenderer is initialized
        if (!this.listRenderer) {
            console.warn('List renderer not initialized, reinitializing...');
            this.initContainer();
            if (!this.listRenderer) {
                console.error('Failed to initialize list renderer');
                return;
            }
        }

        if (this.mods.length === 0) {
            this.modListContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No mods available</p>';
            this.renderedModIds.clear();
            return;
        }

        // Check if we need to render new items or just update visibility
        const currentModIds = new Set(this.mods.map(m => m.id));
        const needsFullRender = forceRender || 
            this.renderedModIds.size !== currentModIds.size ||
            ![...currentModIds].every(id => this.renderedModIds.has(id));

        if (!needsFullRender) {
            this.updateVisibility();
            return;
        }

        // Full render
        this.listRenderer.renderModList(this.mods, this.modListContainer, this.searchQuery);
        this.renderedModIds = currentModIds;
    }

    // Sélectionner un mod
    async selectMod(modId) {
        const mod = this.mods.find(m => m.id === modId);
        if (!mod) return;

        // Don't reload if same mod is selected
        if (this.selectedMod && this.selectedMod.id === modId) {
            return;
        }

        this.selectedMod = mod;

        // Mise à jour visuelle
        const allModItems = this.modListContainer.querySelectorAll('.mod-item');
        allModItems.forEach(item => {
            if (item.dataset.modId === modId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Mise à jour de l'aperçu
        this.updatePreview(mod);

        // Mise à jour des infos du mod depuis info.toml
        if (window.modInfoManager) {
            // Show loading state
            window.modInfoManager.showLoading();

            // Try to load info.toml
            if (mod.folderPath && window.electronAPI && window.electronAPI.getModInfo) {
                try {
                    console.log('Loading mod info for:', mod.folderPath);
                    const modInfo = await window.electronAPI.getModInfo(mod.folderPath);
                    console.log('Received mod info from main process:', modInfo);
                    
                    if (modInfo) {
                        // Display info from TOML file
                        console.log('Displaying mod info:', modInfo);
                        window.modInfoManager.displayModInfo(modInfo);
                    } else {
                        console.log('No mod info found, showing fallback');
                        // Fallback to basic info
                        window.modInfoManager.displayModInfo({
                            display_name: mod.name,
                            description: 'No info.toml file found'
                        });
                    }
                } catch (error) {
                    console.error('Error loading mod info:', error);
                    window.modInfoManager.showError('Failed to load mod information');
                }
            } else {
                console.log('No folderPath or electronAPI, showing fallback');
                // Fallback if no folderPath
                window.modInfoManager.displayModInfo({
                    display_name: mod.name,
                    description: 'No detailed information available'
                });
            }
        }
    }

    // Mise à jour de l'aperçu
    async updatePreview(mod) {
        const previewArea = document.querySelector('.preview-area');
        if (!previewArea) return;

        previewArea.classList.add('loading');

        // Si le mod a un folderPath, chercher preview.webp dedans
        if (mod.folderPath && window.electronAPI && window.electronAPI.getPreviewImage) {
            try {
                const previewPath = await window.electronAPI.getPreviewImage(mod.folderPath);
                
                if (previewPath) {
                    const img = document.createElement('img');
                    img.style.opacity = '0';
                    img.alt = 'Preview';
                    
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = previewPath;
                    });

                    previewArea.innerHTML = '';
                    previewArea.appendChild(img);
                    
                    setTimeout(() => {
                        img.style.opacity = '1';
                        previewArea.classList.remove('loading');
                    }, 10);
                    
                    return;
                }
            } catch (error) {
                console.error('Error loading preview:', error);
            }
        }

        // Fallback to previewImage if set
        if (mod.previewImage) {
            const img = document.createElement('img');
            img.style.opacity = '0';
            img.alt = 'Preview';
            
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                img.src = mod.previewImage;
            });

            previewArea.innerHTML = '';
            previewArea.appendChild(img);
            
            setTimeout(() => {
                img.style.opacity = '1';
                previewArea.classList.remove('loading');
            }, 10);
        } else {
            previewArea.innerHTML = '<p style="color: #666; text-align: center;">No preview available</p>';
            previewArea.classList.remove('loading');
        }
    }

    // Exemple de données pour tester
    loadExampleMods() {
        const exampleMods = [
            {
                id: '1',
                name: 'Fighter Pack v2',
                version: '2.1.0',
                author: 'FightMaster',
                description: 'Collection de nouveaux combattants',
                size: '15.2 MB',
                status: 'active'
            },
            {
                id: '2',
                name: 'Stage HD Remaster',
                version: '1.5.0',
                author: 'StageBuilder',
                description: 'Stages en haute définition',
                size: '8.7 MB',
                status: 'active'
            },
            {
                id: '3',
                name: 'Sound Pack Deluxe',
                version: '1.0.0',
                author: 'AudioMod',
                description: 'Sons et musiques améliorés',
                size: '22.4 MB',
                status: 'conflict'
            },
            {
                id: '4',
                name: 'UI Enhancement',
                version: '3.2.1',
                author: 'UITeam',
                description: 'Interface utilisateur améliorée',
                size: '4.1 MB',
                status: 'disabled'
            },
            {
                id: '5',
                name: 'Custom Animations',
                version: '1.8.0',
                author: 'AnimPro',
                description: 'Nouvelles animations de combat',
                size: '12.6 MB',
                status: 'active'
            },
            {
                id: '6',
                name: 'Balance Patch',
                version: '2.0.0',
                author: 'BalanceTeam',
                description: 'Équilibrage des personnages',
                size: '0.8 MB',
                status: 'active'
            }
        ];

        this.loadMods(exampleMods);
    }

    // Charger les mods depuis le dossier
    async loadModsFromFolder(modsPath) {
        if (!window.electronAPI || !window.electronAPI.readModsFolder) {
            console.error('Electron API not available');
            this.loadExampleMods();
            return;
        }

        this.modsPath = modsPath;

        try {
            const result = await window.electronAPI.readModsFolder(modsPath);
            
            if (result.error) {
                console.error('Error reading mods:', result.error);
                this.loadExampleMods();
                return;
            }

            const allMods = [];
            let idCounter = 1;

            // Active mods - create basic data first
            for (const mod of result.activeMods) {
                const modData = {
                    id: String(idCounter++),
                    name: mod.name,
                    version: 'Unknown',
                    author: 'Unknown',
                    description: 'Active mod',
                    size: 'Unknown',
                    status: 'active',
                    folderPath: mod.path,
                    category: null
                };
                allMods.push(modData);
            }

            // Disabled mods - create basic data first
            for (const mod of result.disabledMods) {
                const modData = {
                    id: String(idCounter++),
                    name: mod.name,
                    version: 'Unknown',
                    author: 'Unknown',
                    description: 'Disabled mod',
                    size: 'Unknown',
                    status: 'disabled',
                    folderPath: mod.path,
                    category: null
                };
                allMods.push(modData);
            }

            // Load mods immediately so they're clickable
            this.loadMods(allMods);
            
            // Load categories in background without blocking
            this.loadCategoriesInBackground(allMods);
        } catch (error) {
            console.error('Failed to load mods from folder:', error);
            this.loadExampleMods();
        }
    }

    // Load categories from info.toml in background
    async loadCategoriesInBackground(mods) {
        for (const mod of mods) {
            try {
                const modInfo = await window.electronAPI.getModInfo(mod.folderPath);
                if (modInfo && modInfo.category) {
                    // Update the mod data in place
                    mod.category = modInfo.category;
                }
            } catch (error) {
                // Silently ignore errors loading categories
            }
        }
        
        // No need to re-render, categories are updated in place
    }

    // Ouvrir le dossier des mods
    async openSelectedModFolder() {
        if (!this.modsPath) {
            console.warn('No mods path set');
            return;
        }

        if (!window.electronAPI || !window.electronAPI.openFolder) {
            console.error('Electron API not available');
            return;
        }

        try {
            const result = await window.electronAPI.openFolder(this.modsPath);
            if (!result.success) {
                console.error('Failed to open folder:', result.error);
            }
        } catch (error) {
            console.error('Error opening folder:', error);
        }
    }

    // Fetch des mods
    async fetchMods() {
        if (typeof window.settingsManager !== 'undefined' && window.settingsManager) {
            const modsPath = window.settingsManager.getModsPath();
            if (modsPath) {
                console.log('Loading mods from saved path:', modsPath);
                this.loadModsFromFolder(modsPath);
                return;
            }
        }
        
        console.log('Loading example mods');
        this.loadExampleMods();
    }
}

// Initialisation
if (typeof window !== 'undefined') {
    window.modManager = new ModManager();
    console.log('Mod Manager initialized');
}
