// Tab Content Loader
// This file handles loading tab content from separate HTML files

const tabConfigs = {
    'tools': 'tabs/tools.html',
    'plugins': 'tabs/plugins.html',
    'characters': 'tabs/characters.html',
    'stages': 'tabs/stages.html',
    'social': 'tabs/social.html',
    'downloads': 'tabs/downloads.html',
    'settings': 'tabs/settings.html',
    'fightplanner': 'tabs/fightplanner.html'
};

// Initialize tab features (called every time tab is shown)
function initializeTabFeatures(tabName) {
    console.log(`Initializing features for tab: ${tabName}`);
    
    if (tabName === 'tools') {
        // Attach search input listener FIRST
        const searchInput = document.getElementById('search-mods-input');
        const savedSearchValue = searchInput ? searchInput.value : '';
        
        if (searchInput) {
            // Remove old listener by cloning
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            // Get the newly replaced element
            const finalSearchInput = document.getElementById('search-mods-input');
            if (finalSearchInput) {
                // Attach listener
                finalSearchInput.addEventListener('input', (e) => {
                    const value = e.target.value;
                    if (window.modManager) {
                        window.modManager.filterMods(value);
                    }
                });
                
                // Also handle paste event
                finalSearchInput.addEventListener('paste', (e) => {
                    setTimeout(() => {
                        const value = e.target.value;
                        if (window.modManager) {
                            window.modManager.filterMods(value);
                        }
                    }, 10);
                });
            }
        }
        
        // Attach refresh button listener
        const refreshBtn = document.getElementById('refresh-mods-btn');
        if (refreshBtn) {
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            
            newRefreshBtn.addEventListener('click', () => {
                if (window.settingsManager) {
                    window.settingsManager.refreshModsList();
                }
            });
        }
        
        // Attach open folder button listener
        const openFolderBtn = document.getElementById('open-folder-btn');
        if (openFolderBtn) {
            const newOpenFolderBtn = openFolderBtn.cloneNode(true);
            openFolderBtn.parentNode.replaceChild(newOpenFolderBtn, openFolderBtn);
            
            newOpenFolderBtn.addEventListener('click', () => {
                if (window.modManager) {
                    window.modManager.openSelectedModFolder();
                }
            });
        }
        
        // Attach category filter listener (custom select)
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            const trigger = categoryFilter.querySelector('.custom-select-trigger');
            const dropdown = categoryFilter.querySelector('.custom-select-dropdown');
            const options = categoryFilter.querySelectorAll('.custom-select-option');
            const selectedValue = categoryFilter.querySelector('.selected-value');
            
            // Toggle dropdown
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                categoryFilter.classList.toggle('open');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!categoryFilter.contains(e.target)) {
                    categoryFilter.classList.remove('open');
                }
            });
            
            // Handle option selection
            options.forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.dataset.value;
                    const text = option.querySelector('span').textContent;
                    
                    // Update selected value
                    selectedValue.textContent = text;
                    
                    // Update active class
                    options.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    // Close dropdown
                    categoryFilter.classList.remove('open');
                    
                    // Filter mods
                    if (window.modManager) {
                        window.modManager.filterByCategory(value);
                    }
                });
            });
        }
        
        // Initialize resize handler
        if (window.resizeHandler) {
            window.resizeHandler.setupResizeHandlers();
        }
        
        // Reinitialize mod manager (important: container now exists)
        if (window.modManager) {
            window.modManager.reinitialize();
        }
        
        // Load mods
        if (window.modManager) {
            window.modManager.fetchMods();
        }
        
        // Reset the search query in modManager to match the input field
        if (window.modManager) {
            const currentInput = document.getElementById('search-mods-input');
            const currentValue = currentInput ? currentInput.value : '';
            
            // Force sync the searchQuery
            window.modManager.searchQuery = currentValue.toLowerCase();
            
            // If there's a value, apply the filter after render completes
            if (currentValue) {
                setTimeout(() => {
                    if (window.modManager) {
                        window.modManager.updateVisibility();
                    }
                }, 200);
            }
        }
    }
    
    if (tabName === 'plugins') {
        // Reinitialize plugin manager (important: container now exists)
        if (window.pluginManager) {
            window.pluginManager.reinitialize();
        }
        
        // Load plugins
        if (window.pluginManager) {
            console.log('Fetching plugins...');
            window.pluginManager.fetchPlugins();
        }
    }
    
    if (tabName === 'settings' && window.settingsManager) {
        // Re-setup settings listeners after tab is loaded
        window.settingsManager.setupEventListeners();
    }
    
    if (tabName === 'fightplanner') {
        // Initialize FightPlanner tab (load version info)
        if (window.fightPlannerManager) {
            console.log('Initializing FightPlanner tab...');
            window.fightPlannerManager.initialize();
        }
    }
    
    if (tabName === 'characters') {
        // Initialize Characters tab
        if (window.charactersManager) {
            console.log('Initializing Characters tab...');
            window.charactersManager.initialize();
        }
        
        // Attach refresh button
        const refreshBtn = document.getElementById('refresh-characters-btn');
        if (refreshBtn) {
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            
            newRefreshBtn.addEventListener('click', () => {
                if (window.charactersManager) {
                    window.charactersManager.refresh();
                }
            });
        }
    }
    
    if (tabName === 'downloads') {
        // Initialize Downloads tab
        if (window.downloadManager) {
            console.log('Initializing Downloads tab...');
            window.downloadManager.initialize();
        }
    }
}

// Load tab content from HTML file
async function loadTabContent(tabName) {
    const tabElement = document.getElementById(`tab-${tabName}`);
    if (!tabElement) {
        console.warn(`Tab element not found: tab-${tabName}`);
        return;
    }
    
    // Check if already loaded
    if (tabElement.dataset.loaded === 'true') {
        console.log(`Tab already loaded: ${tabName} - reinitializing features`);
        initializeTabFeatures(tabName);
        return;
    }
    
    const htmlFile = tabConfigs[tabName];
    if (!htmlFile) {
        console.warn(`No HTML file configured for tab: ${tabName}`);
        return;
    }
    
    try {
        console.log(`Loading tab content for: ${tabName} from ${htmlFile}`);
        const response = await fetch(htmlFile);
        const html = await response.text();
        tabElement.innerHTML = html;
        tabElement.dataset.loaded = 'true';
        console.log(`✓ Successfully loaded content for tab: ${tabName}`);
        
        // Initialize tab features after first load
        initializeTabFeatures(tabName);
    } catch (error) {
        console.error(`Error loading tab ${tabName}:`, error);
        tabElement.innerHTML = `
            <div class="content-box">
                <h2>Error</h2>
                <p>Could not load content for ${tabName}</p>
            </div>
        `;
    }
}

// Load all tabs on startup (or load on-demand)
async function initializeTabs() {
    // Load the active tab first
    await loadTabContent('tools');
    
    // Optionally: pre-load all other tabs
    // for (const tabName in tabConfigs) {
    //     if (tabName !== 'tools') {
    //         await loadTabContent(tabName);
    //     }
    // }
}

// Export functions for use in renderer.js
window.tabLoader = {
    loadTabContent,
    initializeTabs
};

