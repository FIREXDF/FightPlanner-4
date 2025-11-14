class ModalManager {
  constructor() {
    this.currentMod = null;
    this.renameCallback = null;
    this.uninstallCallback = null;
    this.deletePluginCallback = null;
    this.currentPlugin = null;
    this.editInfoCallback = null;
    this.advancedInfoCallback = null;
    this.currentModPath = null;
    this.pendingInstallData = null;
  }

  showOverlay() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.classList.remove("closing");
      overlay.style.display = "block";
    }
  }

  hideOverlay() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.classList.add("closing");
      setTimeout(() => {
        overlay.style.display = "none";
        overlay.classList.remove("closing");
      }, 250);
    }
  }

  openRenameModal(mod, callback) {
    this.currentMod = mod;
    this.renameCallback = callback;

    const modal = document.getElementById("rename-modal");
    const input = document.getElementById("rename-input");

    if (modal && input) {
      modal.classList.remove("closing");
      input.value = mod.name;
      this.showOverlay();
      modal.style.display = "block";

      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);

      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          this.confirmRename();
        } else if (e.key === "Escape") {
          this.closeRenameModal();
        }
      };
    }
  }

  closeRenameModal() {
    const modal = document.getElementById("rename-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    this.hideOverlay();
    this.currentMod = null;
    this.renameCallback = null;
  }

  confirmRename() {
    const input = document.getElementById("rename-input");
    const newName = input.value.trim();

    if (!newName) {
      this.showAlert("error", "Error", "Mod name cannot be empty");
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

  openUninstallModal(mod, callback) {
    this.currentMod = mod;
    this.uninstallCallback = callback;

    const modal = document.getElementById("uninstall-modal");
    const modNameEl = document.getElementById("uninstall-mod-name");

    if (modal && modNameEl) {
      modal.classList.remove("closing");
      modNameEl.textContent = mod.name;
      this.showOverlay();
      modal.style.display = "block";
    }
  }

  closeUninstallModal() {
    const modal = document.getElementById("uninstall-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
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

  showAlert(type, title, message) {
    const modal = document.getElementById("alert-modal");
    const header = document.getElementById("alert-modal-header");
    const titleEl = document.getElementById("alert-modal-title");
    const messageEl = document.getElementById("alert-modal-message");

    if (!modal || !header || !titleEl || !messageEl) return;

    modal.classList.remove("closing");
    let icon = "bi-info-circle";
    header.className = "modal-header";

    if (type === "success") {
      icon = "bi-check-circle";
    } else if (type === "error") {
      icon = "bi-x-circle";
      header.classList.add("modal-header-danger");
    } else if (type === "warning") {
      icon = "bi-exclamation-triangle";
    }

    titleEl.innerHTML = `<i class="bi ${icon}"></i> ${title}`;
    messageEl.textContent = message;

    this.showOverlay();
    modal.style.display = "block";
  }

  closeAlertModal() {
    const modal = document.getElementById("alert-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    this.hideOverlay();
  }

  openDeletePluginModal(plugin, callback) {
    this.currentPlugin = plugin;
    this.deletePluginCallback = callback;

    const modal = document.getElementById("delete-plugin-modal");
    const pluginNameEl = document.getElementById("delete-plugin-name");

    if (modal && pluginNameEl) {
      modal.classList.remove("closing");
      pluginNameEl.textContent = plugin.name;
      this.showOverlay();
      modal.style.display = "block";
    }
  }

  closeDeletePluginModal() {
    const modal = document.getElementById("delete-plugin-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
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

  openChangeSlotModal(mod, detectedSlots, callback) {
    this.currentMod = mod;
    this.changeSlotCallback = callback;
    this.slotData = detectedSlots.map((slot) => ({
      originalSlot: slot.slot,
      newSlot: slot.slot,
      files: slot.files,
      isNew: false,
    }));

    const modal = document.getElementById("change-slot-modal");
    const container = document.getElementById("slot-list-container");

    if (modal && container) {
      modal.classList.remove("closing");
      this.renderSlotList();
      this.showOverlay();
      modal.style.display = "block";
    }
  }

  closeChangeSlotModal() {
    const modal = document.getElementById("change-slot-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    this.hideOverlay();
    this.currentMod = null;
    this.changeSlotCallback = null;
    this.slotData = null;
  }

  renderSlotList() {
    const container = document.getElementById("slot-list-container");
    if (!container || !this.slotData) return;

    container.innerHTML = "";

    this.slotData.forEach((slot, index) => {
      const slotItem = document.createElement("div");
      slotItem.className = `slot-item ${slot.isNew ? "slot-item-new" : ""}`;
      slotItem.dataset.index = index;

      const content = document.createElement("div");
      content.className = "slot-item-content";

      const info = document.createElement("div");
      info.className = "slot-item-info";

      const label = document.createElement("span");
      label.className = "slot-item-label";
      label.textContent = slot.isNew
        ? "New Slot:"
        : `Current: c0${slot.originalSlot}`;

      const arrow = document.createElement("i");
      arrow.className = "bi bi-arrow-right slot-arrow";

      const select = document.createElement("select");
      select.className = "slot-select";
      select.dataset.index = index;

      for (let i = 0; i <= 7; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `c0${i}`;
        if (i === slot.newSlot) {
          option.selected = true;
        }
        select.appendChild(option);
      }

      select.addEventListener("change", (e) => {
        this.slotData[index].newSlot = parseInt(e.target.value);
      });

      info.appendChild(label);
      if (!slot.isNew) {
        info.appendChild(arrow);
      }
      info.appendChild(select);

      const filesInfo = document.createElement("div");
      filesInfo.className = "slot-item-files";

      if (slot.files.length > 0) {
        const filesList = document.createElement("details");

        const summary = document.createElement("summary");
        summary.textContent = `${slot.files.length} file(s) and folder(s) will be modified`;

        const fileListContainer = document.createElement("div");
        fileListContainer.className = "slot-file-list";

        slot.files.forEach((file) => {
          const fileItem = document.createElement("div");
          fileItem.className = "slot-file-item";

          const icon = file.type === "directory" ? "📁" : "📄";
          const typeLabel = file.type === "directory" ? "[DIR]" : "[FILE]";
          fileItem.textContent = `${icon} ${typeLabel} ${file.path}`;
          fileListContainer.appendChild(fileItem);
        });

        filesList.appendChild(summary);
        filesList.appendChild(fileListContainer);
        filesInfo.appendChild(filesList);
      } else {
        filesInfo.innerHTML =
          '<span style="color: #555; font-style: italic;">New slot - no files yet</span>';
      }

      content.appendChild(info);
      content.appendChild(filesInfo);

      const actions = document.createElement("div");
      actions.className = "slot-item-actions";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "slot-action-btn slot-action-delete";
      deleteBtn.innerHTML = '<i class="bi bi-trash3"></i> Delete';
      deleteBtn.addEventListener("click", () => {
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
      isNew: true,
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
      deletions: [],
    };

    this.slotData.forEach((slot) => {
      if (slot.isNew) {
        changes.modifications.push({
          type: "add",
          targetSlot: slot.newSlot,
        });
      } else if (slot.originalSlot !== slot.newSlot) {
        changes.modifications.push({
          type: "change",
          originalSlot: slot.originalSlot,
          newSlot: slot.newSlot,
          files: slot.files,
        });
      }
    });

    const existingSlots = this.slotData
      .filter((s) => !s.isNew)
      .map((s) => s.originalSlot);

    this.changeSlotCallback(changes);
    this.closeChangeSlotModal();
  }

  openEditInfoModal(modPath, currentInfo, callback) {
    this.editInfoCallback = callback;

    const modal = document.getElementById("edit-info-modal");
    const displayNameInput = document.getElementById("edit-info-display-name");
    const authorsInput = document.getElementById("edit-info-authors");
    const versionInput = document.getElementById("edit-info-version");
    const categorySelect = document.getElementById("edit-info-category");
    const urlInput = document.getElementById("edit-info-url");
    const descriptionTextarea = document.getElementById("edit-info-description");

    if (modal) {
      modal.classList.remove("closing");

      if (displayNameInput) displayNameInput.value = currentInfo?.display_name || '';
      if (authorsInput) authorsInput.value = currentInfo?.authors || '';
      if (versionInput) versionInput.value = currentInfo?.version || '';
      if (categorySelect) categorySelect.value = currentInfo?.category || '';
      if (urlInput) urlInput.value = currentInfo?.url || '';
      if (descriptionTextarea) descriptionTextarea.value = currentInfo?.description || '';

      this.showOverlay();
      modal.style.display = "block";
    }
  }

  closeEditInfoModal() {
    const modal = document.getElementById("edit-info-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    this.hideOverlay();
    this.editInfoCallback = null;
  }

  confirmEditInfo() {
    const form = document.getElementById("mod-info-form");
    if (!form) return;

    const formData = new FormData(form);
    const info = {};

    formData.forEach((value, key) => {
      if (value.trim()) {
        info[key] = value.trim();
      }
    });

    if (this.editInfoCallback) {
      this.editInfoCallback(info);
    }

    this.closeEditInfoModal();
  }

  openAdvancedInfoModal(modPath, currentTomlContent) {
    this.currentModPath = modPath;
    
    const modal = document.getElementById("advanced-info-modal");
    const textarea = document.getElementById("advanced-info-textarea");

    if (modal && textarea) {
      modal.classList.remove("closing");
      textarea.value = currentTomlContent || '';

      this.showOverlay();
      modal.style.display = "block";
    }
  }

  closeAdvancedInfoModal() {
    const modal = document.getElementById("advanced-info-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    this.hideOverlay();
    this.advancedInfoCallback = null;
    this.currentModPath = null;
  }

  async confirmAdvancedInfo() {
    const textarea = document.getElementById("advanced-info-textarea");
    if (!textarea || !this.currentModPath) return;

    const tomlContent = textarea.value;

    try {
      const result = await window.electronAPI.saveModInfoRaw(this.currentModPath, tomlContent);
      
      if (result.success) {
        if (window.toastManager) {
          window.toastManager.success('Info.toml saved successfully');
        }
        this.closeAdvancedInfoModal();
        
        if (window.modManager && window.modManager.selectedMod) {
          window.modManager.selectMod(window.modManager.selectedMod.id);
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error('Failed to save info.toml: ' + result.error);
        }
      }
    } catch (error) {
      if (window.toastManager) {
        window.toastManager.error('Failed to save info.toml');
      }
    }
  }

  async openInstallConfirmModal(url, downloadId, modId) {
    this.pendingInstallData = { url, downloadId, modId };
    
    const urlDisplay = document.getElementById('install-url-display');
    if (urlDisplay) {
      urlDisplay.textContent = url;
    }

    const modal = document.getElementById('install-confirm-modal');
    if (modal) {
      modal.classList.remove('closing');
      this.showOverlay();
      modal.style.display = 'block';
    }

    // Fetch preview image from GameBanana
    if (modId && window.electronAPI?.fetchGameBananaPreview) {
      const previewImage = document.getElementById('install-preview-image');
      const previewLoading = document.querySelector('.install-preview-loading');
      
      try {
        const result = await window.electronAPI.fetchGameBananaPreview(modId);
        
        if (result.success && result.imageUrl) {
          previewImage.onload = () => {
            previewImage.classList.add('loaded');
            if (previewLoading) previewLoading.style.display = 'none';
          };
          previewImage.src = result.imageUrl;
          previewImage.style.display = 'block';
        } else {
          // No preview available, hide loading
          if (previewLoading) previewLoading.style.display = 'none';
        }
      } catch (error) {
        console.error('Failed to fetch preview:', error);
        if (previewLoading) previewLoading.style.display = 'none';
      }
    }
  }

  closeInstallConfirmModal() {
    const modal = document.getElementById('install-confirm-modal');
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');
        
        // Reset preview image
        const previewImage = document.getElementById('install-preview-image');
        const previewLoading = document.querySelector('.install-preview-loading');
        if (previewImage) {
          previewImage.src = '';
          previewImage.style.display = 'none';
          previewImage.classList.remove('loaded');
        }
        if (previewLoading) {
          previewLoading.style.display = 'flex';
        }
      }, 300);
    }
    this.hideOverlay();
    this.pendingInstallData = null;
  }

  async confirmInstall() {
    if (this.pendingInstallData && window.electronAPI?.confirmProtocolInstall) {
      const { url, downloadId } = this.pendingInstallData;
      this.closeInstallConfirmModal();
      
      try {
        await window.electronAPI.confirmProtocolInstall(url, downloadId);
      } catch (error) {
        console.error('Error confirming install:', error);
        if (window.toastManager) {
          window.toastManager.error('Failed to start installation');
        }
      }
    }
  }

  cancelInstallConfirm() {
    if (this.pendingInstallData && window.electronAPI?.cancelProtocolInstall) {
      const { downloadId } = this.pendingInstallData;
      window.electronAPI.cancelProtocolInstall(downloadId);
    }
    this.closeInstallConfirmModal();
  }
}

if (typeof window !== "undefined") {
  window.modalManager = new ModalManager();
  console.log("Modal Manager initialized");

  document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", () => {
        window.modalManager.closeRenameModal();
        window.modalManager.closeUninstallModal();
        window.modalManager.closeAlertModal();
        window.modalManager.closeChangeSlotModal();
        window.modalManager.closeEditInfoModal();
        window.modalManager.closeAdvancedInfoModal();
        window.modalManager.closeInstallConfirmModal();
        if (window.conflictModalManager) {
          window.conflictModalManager.closeConflictModal();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        window.modalManager.closeRenameModal();
        window.modalManager.closeUninstallModal();
        window.modalManager.closeAlertModal();
        window.modalManager.closeDeletePluginModal();
        window.modalManager.closeChangeSlotModal();
        window.modalManager.closeEditInfoModal();
        window.modalManager.closeAdvancedInfoModal();
        window.modalManager.closeInstallConfirmModal();
        if (window.conflictModalManager) {
          window.conflictModalManager.closeConflictModal();
        }
      }
    });
  });
}
