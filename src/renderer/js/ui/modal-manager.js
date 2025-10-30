// Modal Manager
// Gère tous les modals de l'application

class ModalManager {
    constructor() {
        this.currentMod = null;
        this.renameCallback = null;
        this.uninstallCallback = null;
        this.deletePluginCallback = null;
        this.currentPlugin = null;
    }

    // Show overlay
    showOverlay() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.style.display = 'block';
        }
    }

    // Hide overlay
    hideOverlay() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // === RENAME MODAL ===
    openRenameModal(mod, callback) {
        this.currentMod = mod;
        this.renameCallback = callback;

        const modal = document.getElementById('rename-modal');
        const input = document.getElementById('rename-input');
        
        if (modal && input) {
            input.value = mod.name;
            this.showOverlay();
            modal.style.display = 'block';
            
            // Focus input and select text
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);

            // Handle Enter key
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    this.confirmRename();
                } else if (e.key === 'Escape') {
                    this.closeRenameModal();
                }
            };
        }
    }

    closeRenameModal() {
        const modal = document.getElementById('rename-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.hideOverlay();
        this.currentMod = null;
        this.renameCallback = null;
    }

    confirmRename() {
        const input = document.getElementById('rename-input');
        const newName = input.value.trim();

        if (!newName) {
            this.showAlert('error', 'Error', 'Mod name cannot be empty');
            return;
        }

        if (newName === this.currentMod.name) {
            this.closeRenameModal();
            return;
        }

        if (this.renameCallback) {
            this.renameCallback(newName);
        }

        this.closeRenameModal();
    }

    // === UNINSTALL MODAL ===
    openUninstallModal(mod, callback) {
        this.currentMod = mod;
        this.uninstallCallback = callback;

        const modal = document.getElementById('uninstall-modal');
        const modNameEl = document.getElementById('uninstall-mod-name');
        
        if (modal && modNameEl) {
            modNameEl.textContent = mod.name;
            this.showOverlay();
            modal.style.display = 'block';
        }
    }

    closeUninstallModal() {
        const modal = document.getElementById('uninstall-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.hideOverlay();
        this.currentMod = null;
        this.uninstallCallback = null;
    }

    confirmUninstall() {
        if (this.uninstallCallback) {
            this.uninstallCallback();
        }
        this.closeUninstallModal();
    }

    // === ALERT MODAL ===
    showAlert(type, title, message) {
        const modal = document.getElementById('alert-modal');
        const header = document.getElementById('alert-modal-header');
        const titleEl = document.getElementById('alert-modal-title');
        const messageEl = document.getElementById('alert-modal-message');

        if (!modal || !header || !titleEl || !messageEl) return;

        // Set icon based on type
        let icon = 'bi-info-circle';
        header.className = 'modal-header';
        
        if (type === 'success') {
            icon = 'bi-check-circle';
        } else if (type === 'error') {
            icon = 'bi-x-circle';
            header.classList.add('modal-header-danger');
        } else if (type === 'warning') {
            icon = 'bi-exclamation-triangle';
        }

        titleEl.innerHTML = `<i class="bi ${icon}"></i> ${title}`;
        messageEl.textContent = message;

        this.showOverlay();
        modal.style.display = 'block';
    }

    closeAlertModal() {
        const modal = document.getElementById('alert-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.hideOverlay();
    }

    // === DELETE PLUGIN MODAL ===
    openDeletePluginModal(plugin, callback) {
        this.currentPlugin = plugin;
        this.deletePluginCallback = callback;

        const modal = document.getElementById('delete-plugin-modal');
        const pluginNameEl = document.getElementById('delete-plugin-name');
        
        if (modal && pluginNameEl) {
            pluginNameEl.textContent = plugin.name;
            this.showOverlay();
            modal.style.display = 'block';
            // Use default modal animation only (no extra modal-enter)
        }
    }

    closeDeletePluginModal() {
        const modal = document.getElementById('delete-plugin-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.hideOverlay();
        this.currentPlugin = null;
        this.deletePluginCallback = null;
    }

    confirmDeletePlugin() {
        if (this.deletePluginCallback) {
            this.deletePluginCallback();
        }
        this.closeDeletePluginModal();
    }

    // === CHANGE SLOT MODAL ===
    openChangeSlotModal(mod, detectedSlots, callback) {
        this.currentMod = mod;
        this.changeSlotCallback = callback;
        this.slotData = detectedSlots.map(slot => ({
            originalSlot: slot.slot,
            newSlot: slot.slot,
            files: slot.files,
            isNew: false
        }));

        const modal = document.getElementById('change-slot-modal');
        const container = document.getElementById('slot-list-container');
        
        if (modal && container) {
            this.renderSlotList();
            this.showOverlay();
            modal.style.display = 'block';
        }
    }

    closeChangeSlotModal() {
        const modal = document.getElementById('change-slot-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.hideOverlay();
        this.currentMod = null;
        this.changeSlotCallback = null;
        this.slotData = null;
    }

    renderSlotList() {
        const container = document.getElementById('slot-list-container');
        if (!container || !this.slotData) return;

        container.innerHTML = '';

        this.slotData.forEach((slot, index) => {
            const slotItem = document.createElement('div');
            slotItem.className = `slot-item ${slot.isNew ? 'slot-item-new' : ''}`;
            slotItem.dataset.index = index;

            const content = document.createElement('div');
            content.className = 'slot-item-content';

            const info = document.createElement('div');
            info.className = 'slot-item-info';

            const label = document.createElement('span');
            label.className = 'slot-item-label';
            label.textContent = slot.isNew ? 'New Slot:' : `Current: c0${slot.originalSlot}`;

            const arrow = document.createElement('i');
            arrow.className = 'bi bi-arrow-right slot-arrow';

            const select = document.createElement('select');
            select.className = 'slot-select';
            select.dataset.index = index;
            
            for (let i = 0; i <= 7; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `c0${i}`;
                if (i === slot.newSlot) {
                    option.selected = true;
                }
                select.appendChild(option);
            }

            select.addEventListener('change', (e) => {
                this.slotData[index].newSlot = parseInt(e.target.value);
            });

            info.appendChild(label);
            if (!slot.isNew) {
                info.appendChild(arrow);
            }
            info.appendChild(select);

            const filesInfo = document.createElement('div');
            filesInfo.className = 'slot-item-files';
            
            if (slot.files.length > 0) {
                const filesList = document.createElement('details');
                
                const summary = document.createElement('summary');
                summary.textContent = `${slot.files.length} file(s) and folder(s) will be modified`;
                
                const fileListContainer = document.createElement('div');
                fileListContainer.className = 'slot-file-list';
                
                slot.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'slot-file-item';
                    
                    const icon = file.type === 'directory' ? '📁' : '📄';
                    const typeLabel = file.type === 'directory' ? '[DIR]' : '[FILE]';
                    fileItem.textContent = `${icon} ${typeLabel} ${file.path}`;
                    fileListContainer.appendChild(fileItem);
                });
                
                filesList.appendChild(summary);
                filesList.appendChild(fileListContainer);
                filesInfo.appendChild(filesList);
            } else {
                filesInfo.innerHTML = '<span style="color: #555; font-style: italic;">New slot - no files yet</span>';
            }

            content.appendChild(info);
            content.appendChild(filesInfo);

            const actions = document.createElement('div');
            actions.className = 'slot-item-actions';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'slot-action-btn slot-action-delete';
            deleteBtn.innerHTML = '<i class="bi bi-trash3"></i> Delete';
            deleteBtn.addEventListener('click', () => {
                this.deleteSlot(index);
            });

            actions.appendChild(deleteBtn);

            slotItem.appendChild(content);
            slotItem.appendChild(actions);

            container.appendChild(slotItem);
        });
    }

    addNewSlot() {
        if (!this.slotData) return;

        this.slotData.push({
            originalSlot: null,
            newSlot: 0,
            files: [],
            isNew: true
        });

        this.renderSlotList();
    }

    deleteSlot(index) {
        if (!this.slotData) return;

        this.slotData.splice(index, 1);
        this.renderSlotList();
    }

    confirmChangeSlot() {
        if (!this.changeSlotCallback || !this.slotData) return;

        const changes = {
            modifications: [],
            deletions: []
        };

        this.slotData.forEach(slot => {
            if (slot.isNew) {
                // New slot to add
                changes.modifications.push({
                    type: 'add',
                    targetSlot: slot.newSlot
                });
            } else if (slot.originalSlot !== slot.newSlot) {
                // Existing slot to change
                changes.modifications.push({
                    type: 'change',
                    originalSlot: slot.originalSlot,
                    newSlot: slot.newSlot,
                    files: slot.files
                });
            }
        });

        // Find deleted slots
        const existingSlots = this.slotData
            .filter(s => !s.isNew)
            .map(s => s.originalSlot);
        
        // We need to get original slots to find deletions
        // For now, we'll just send what we have
        
        this.changeSlotCallback(changes);
        this.closeChangeSlotModal();
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.modalManager = new ModalManager();
    console.log('Modal Manager initialized');
    
    // Close modals when clicking overlay
    document.addEventListener('DOMContentLoaded', () => {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                window.modalManager.closeRenameModal();
                window.modalManager.closeUninstallModal();
                window.modalManager.closeAlertModal();
                window.modalManager.closeChangeSlotModal();
            });
        }

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.modalManager.closeRenameModal();
                window.modalManager.closeUninstallModal();
                window.modalManager.closeAlertModal();
                window.modalManager.closeDeletePluginModal();
                window.modalManager.closeChangeSlotModal();
            }
        });
    });
}





