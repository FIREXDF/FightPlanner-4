// Mod Context Menu Handler
// Gère l'affichage et les interactions du menu contextuel

class ModContextMenuHandler {
    constructor(modManager) {
        this.modManager = modManager;
        this.setupContextMenu();
    }

    setupContextMenu() {
        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            const contextMenu = document.getElementById('mod-context-menu');
            if (contextMenu && !contextMenu.contains(e.target) && contextMenu.style.display !== 'none') {
                this.closeContextMenu();
            }
        });

        // Context menu actions
        const contextMenu = document.getElementById('mod-context-menu');
        if (contextMenu) {
            contextMenu.addEventListener('click', async (e) => {
                const item = e.target.closest('.context-menu-item');
                if (!item) return;

                const action = item.dataset.action;
                const modId = contextMenu.dataset.modId;
                const mod = this.modManager.mods.find(m => m.id === modId);

                if (!mod) return;

                this.closeContextMenu();

                // Delegate actions to mod operations
                if (this.modManager.operations) {
                    switch (action) {
                        case 'rename':
                            await this.modManager.operations.renameMod(mod);
                            break;
                        case 'change-slot':
                            await this.modManager.operations.changeSlot(mod);
                            break;
                        case 'toggle':
                            await this.modManager.operations.toggleModStatus(mod);
                            break;
                        case 'open-folder':
                            await this.modManager.operations.openModFolder(mod);
                            break;
                        case 'uninstall':
                            await this.modManager.operations.uninstallMod(mod);
                            break;
                    }
                }
            });
        }
    }

    closeContextMenu() {
        const contextMenu = document.getElementById('mod-context-menu');
        if (!contextMenu) return;

        // Check if animations are disabled
        const noAnimations = document.body.classList.contains('no-animations');

        if (noAnimations) {
            // Instant close
            contextMenu.style.display = 'none';
        } else {
            // Animated close
            contextMenu.classList.add('closing');
            
            // Wait for animation to finish before hiding
            setTimeout(() => {
                contextMenu.style.display = 'none';
                contextMenu.classList.remove('closing');
            }, 150); // Match animation duration
        }
    }

    showContextMenu(e, mod) {
        e.preventDefault();
        
        const contextMenu = document.getElementById('mod-context-menu');
        if (!contextMenu) return;

        // Update toggle text and icon based on mod status
        const toggleText = document.getElementById('toggle-text');
        const toggleIcon = document.getElementById('toggle-icon');
        
        if (mod.status === 'disabled') {
            if (toggleText) toggleText.textContent = 'Enable';
            if (toggleIcon) toggleIcon.className = 'bi bi-toggle-off';
        } else {
            if (toggleText) toggleText.textContent = 'Disable';
            if (toggleIcon) toggleIcon.className = 'bi bi-toggle-on';
        }

        // Store mod ID in context menu
        contextMenu.dataset.modId = mod.id;

        // Reset animation by removing closing class and hiding
        contextMenu.classList.remove('closing');
        contextMenu.style.display = 'none';
        void contextMenu.offsetWidth; // Force reflow
        
        // Position context menu
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.display = 'block';

        // Adjust position if menu goes off screen
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
    }
}

// Export for use in mod-manager
if (typeof window !== 'undefined') {
    window.ModContextMenuHandler = ModContextMenuHandler;
}

