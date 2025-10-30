// Mod List Renderer
// Gère le rendu de la liste des mods dans le DOM

class ModListRenderer {
    constructor(modManager) {
        this.modManager = modManager;
        this.intersectionObserver = null;
        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        // Observer to check if mod items are visible in viewport
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const modItem = entry.target;
                
                // Skip if already processed - IMPORTANT: Check before any action
                if (modItem.dataset.processed === 'true') {
                    return;
                }
                
                if (entry.isIntersecting) {
                    // Element is visible - animate
                    modItem.classList.add('mod-item-visible');
                    modItem.dataset.processed = 'true';
                    
                    // Unobserve after processing to prevent re-animation
                    this.intersectionObserver.unobserve(modItem);
                }
            });
        }, {
            root: null,
            threshold: 0.01,
            rootMargin: '100px'
        });
    }
    
    showNonVisibleInstantly() {
        if (!this.modManager || !this.modManager.modListContainer) return;
        
        const allModItems = this.modManager.modListContainer.querySelectorAll('.mod-item');
        allModItems.forEach(modItem => {
            if (modItem.dataset.processed !== 'true') {
                modItem.classList.add('mod-item-instant');
                modItem.dataset.processed = 'true';
                if (this.intersectionObserver) {
                    this.intersectionObserver.unobserve(modItem);
                }
            }
        });
    }

    renderModItem(mod, index) {
        const modItem = document.createElement('div');
        modItem.classList.add('mod-item');
        modItem.dataset.modId = mod.id;
        
        // Mark as NOT processed initially (will be processed by observer)
        modItem.dataset.processed = 'false';
        
        // Stagger animation delay for visible items
        modItem.style.animationDelay = `${index * 0.03}s`;
        
        // Ajouter la classe de status (conflict, active, disabled)
        if (mod.status) {
            modItem.classList.add('mod-' + mod.status);
        }

        // Icône de status (rond coloré à gauche)
        const statusIcon = document.createElement('div');
        statusIcon.classList.add('mod-status-icon');
        
        // SVG inline pour éviter les problèmes de chemin
        let svgHTML = '';
        if (mod.status === 'conflict') {
            svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#FFC107" stroke="#FFA000" stroke-width="2"/>
                <path d="M10 6V11M10 14H10.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
        } else if (mod.status === 'active') {
            svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#4CAF50" stroke="#388E3C" stroke-width="2"/>
                <path d="M6 10L9 13L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        } else if (mod.status === 'disabled') {
            svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#F44336" stroke="#D32F2F" stroke-width="2"/>
                <path d="M7 7L13 13M13 7L7 13" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
        }
        statusIcon.innerHTML = svgHTML;

        // Nom du mod
        const modName = document.createElement('span');
        modName.classList.add('mod-name');
        modName.textContent = mod.name || 'Unknown Mod';

        modItem.appendChild(statusIcon);
        modItem.appendChild(modName);

        // Event listeners
        modItem.addEventListener('click', () => this.modManager.selectMod(mod.id));
        modItem.addEventListener('contextmenu', (e) => {
            if (this.modManager.contextMenuHandler) {
                this.modManager.contextMenuHandler.showContextMenu(e, mod);
            }
        });

        // Observe for viewport visibility
        if (this.intersectionObserver) {
            this.intersectionObserver.observe(modItem);
        }

        return modItem;
    }

    renderModList(mods, container, searchQuery = '') {
        if (!container) {
            console.warn('Mod list container not found');
            return;
        }

        // Save the processed state of existing items BEFORE clearing
        const existingProcessedStates = new Map();
        const existingItems = container.querySelectorAll('.mod-item');
        existingItems.forEach(item => {
            const modId = item.dataset.modId;
            const processed = item.dataset.processed;
            if (modId && processed === 'true') {
                existingProcessedStates.set(modId, true);
            }
        });

        container.innerHTML = ''; // Clear

        if (mods.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No mods available</p>';
            return;
        }

        // Filter mods based on search query
        const filteredMods = searchQuery 
            ? mods.filter(mod => mod.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : mods;

        if (filteredMods.length === 0) {
            container.innerHTML = '<p class="no-results-message" style="color: #666; text-align: center; padding: 20px;">No mods found</p>';
            return;
        }

        filteredMods.forEach((mod, index) => {
            const modItem = this.renderModItem(mod, index);
            
            // If this mod was already processed before, restore its state
            if (existingProcessedStates.has(mod.id)) {
                modItem.dataset.processed = 'true';
                modItem.classList.add('mod-item-instant'); // Show instantly without animation
            }
            
            container.appendChild(modItem);
        });
        
        // Trigger fallback after render - show items not yet visible instantly
        setTimeout(() => {
            this.showNonVisibleInstantly();
        }, 150);
    }

    updateVisibility(mods, container, searchQuery = '', categoryFilter = '') {
        if (!container) return;

        const allModItems = container.querySelectorAll('.mod-item');
        
        if (allModItems.length === 0) {
            return false; // Signal that full render is needed
        }
        
        // If DOM has fewer items than total mods, we need a full re-render
        if (allModItems.length < mods.length) {
            return false; // Signal that full render is needed
        }

        let visibleCount = 0;
        
        allModItems.forEach(item => {
            const modId = item.dataset.modId;
            const mod = mods.find(m => m.id === modId);
            
            if (!mod) {
                item.style.display = 'none';
                return;
            }

            // Check if mod matches search query
            const matchesSearch = !searchQuery || 
                mod.name.toLowerCase().includes(searchQuery.toLowerCase());

            // Check if mod matches category filter
            const matchesCategory = !categoryFilter || 
                (mod.category && mod.category.toLowerCase() === categoryFilter.toLowerCase());

            if (matchesSearch && matchesCategory) {
                item.style.display = '';
                visibleCount++;
                
                // If item is becoming visible and not yet processed, observe it
                // But ONLY if it hasn't been processed before
                if (item.dataset.processed !== 'true' && this.intersectionObserver) {
                    this.intersectionObserver.observe(item);
                }
            } else {
                item.style.display = 'none';
            }
        });

        // Show "no results" message if needed
        const existingMessage = container.querySelector('.no-results-message');
        if (visibleCount === 0 && !existingMessage) {
            const message = document.createElement('p');
            message.className = 'no-results-message';
            message.style.cssText = 'color: #666; text-align: center; padding: 20px;';
            message.textContent = 'No mods found';
            container.appendChild(message);
        } else if (visibleCount > 0 && existingMessage) {
            existingMessage.remove();
        }

        return true; // Signal that visibility update was successful
    }
}

// Export for use in mod-manager
if (typeof window !== 'undefined') {
    window.ModListRenderer = ModListRenderer;
}

