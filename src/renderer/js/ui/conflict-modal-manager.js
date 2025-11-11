class ConflictModalManager {
  constructor() {
    this.currentConflictFile = null;
    this.currentConflictingMods = [];
  }

  async showConflictModal() {
    if (!window.modManager || !window.modManager.conflicts || window.modManager.conflicts.length === 0) {
      if (window.toastManager) {
        window.toastManager.error("No conflicts detected");
      }
      return;
    }

    const modal = document.getElementById("conflict-modal");
    const summaryEl = document.getElementById("conflict-summary");
    const container = document.getElementById("conflict-list-container");
    const headerBadge = document.getElementById("conflict-header-badge");

    if (!modal || !summaryEl || !container) return;

    const conflicts = window.modManager.conflicts;

    if (headerBadge) {
      headerBadge.textContent = `${conflicts.length} file${conflicts.length !== 1 ? 's' : ''} in conflicts`;
    }

    summaryEl.textContent = "The following conflicts were found between mods:";

    container.innerHTML = "";

    const table = document.createElement("table");
    table.className = "conflict-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    
    const thFile = document.createElement("th");
    thFile.className = "conflict-th-file";
    const fileHeaderIcon = document.createElement("i");
    fileHeaderIcon.className = "bi bi-file-earmark";
    thFile.appendChild(fileHeaderIcon);
    thFile.appendChild(document.createTextNode(" File"));
    
    const thMods = document.createElement("th");
    thMods.className = "conflict-th-mods";
    const modsHeaderIcon = document.createElement("i");
    modsHeaderIcon.className = "bi bi-people-fill";
    thMods.appendChild(modsHeaderIcon);
    thMods.appendChild(document.createTextNode(" Conflicting Mods"));
    
    headerRow.appendChild(thFile);
    headerRow.appendChild(thMods);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    conflicts.forEach((conflict) => {
      const row = document.createElement("tr");
      row.className = "conflict-table-row";

      const tdFile = document.createElement("td");
      tdFile.className = "conflict-td-file";
      const filePath = document.createElement("span");
      filePath.className = "conflict-file-path-text";
      filePath.textContent = conflict.filePath;
      tdFile.appendChild(filePath);

      const tdMods = document.createElement("td");
      tdMods.className = "conflict-td-mods";
      const modsList = document.createElement("div");
      modsList.className = "conflict-mods-list";
      conflict.mods.forEach((mod) => {
        const modItem = document.createElement("div");
        modItem.className = "conflict-mod-item";
        const modWarningIcon = document.createElement("i");
        modWarningIcon.className = "bi bi-exclamation-circle-fill";
        const modName = document.createElement("span");
        modName.textContent = mod.name;
        modItem.appendChild(modWarningIcon);
        modItem.appendChild(modName);
        modsList.appendChild(modItem);
      });
      tdMods.appendChild(modsList);

      row.appendChild(tdFile);
      row.appendChild(tdMods);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    
    const listWrapper = document.createElement("div");
    listWrapper.className = "conflict-list";
    listWrapper.appendChild(table);
    container.appendChild(listWrapper);

    modal.classList.remove("closing");
    if (window.modalManager) {
      window.modalManager.showOverlay();
    }
    modal.style.display = "block";
  }

  closeConflictModal() {
    const modal = document.getElementById("conflict-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    if (window.modalManager) {
      window.modalManager.hideOverlay();
    }
  }

  openSlotChangeModal(filePath, conflictingMods) {
    this.currentConflictFile = filePath;
    this.currentConflictingMods = conflictingMods;

    const modal = document.getElementById("conflict-slot-modal");
    const container = document.getElementById("conflict-mod-select-container");

    if (!modal || !container) return;

    container.innerHTML = "";

    conflictingMods.forEach(mod => {
      const selectItem = document.createElement("div");
      selectItem.className = "conflict-mod-select-item";
      selectItem.addEventListener("click", () => {
        this.selectModForSlotChange(mod);
      });

      const icon = document.createElement("i");
      icon.className = "bi bi-folder-fill";

      const name = document.createElement("div");
      name.className = "conflict-mod-select-item-name";
      name.textContent = mod.name;

      selectItem.appendChild(icon);
      selectItem.appendChild(name);
      container.appendChild(selectItem);
    });

    this.closeConflictModal();
    modal.classList.remove("closing");
    if (window.modalManager) {
      window.modalManager.showOverlay();
    }
    modal.style.display = "block";
  }

  closeSlotChangeModal() {
    const modal = document.getElementById("conflict-slot-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 300);
    }
    if (window.modalManager) {
      window.modalManager.hideOverlay();
    }
    this.currentConflictFile = null;
    this.currentConflictingMods = [];
  }

  async selectModForSlotChange(selectedMod) {
    this.closeSlotChangeModal();

    if (!window.modManager || !window.modManager.operations) {
      if (window.toastManager) {
        window.toastManager.error("Cannot change slot - ModManager not available");
      }
      return;
    }

    await window.modManager.operations.changeSlot(selectedMod);
  }

  openGlobalSlotChange() {
    if (!window.modManager || !window.modManager.conflicts || window.modManager.conflicts.length === 0) {
      if (window.toastManager) {
        window.toastManager.error("No conflicts detected");
      }
      return;
    }

    const modal = document.getElementById("conflict-slot-modal");
    const container = document.getElementById("conflict-mod-select-container");

    if (!modal || !container) return;

    // Collect all unique mods from all conflicts
    const modsMap = new Map();
    window.modManager.conflicts.forEach(conflict => {
      conflict.mods.forEach(mod => {
        if (!modsMap.has(mod.path)) {
          modsMap.set(mod.path, {
            name: mod.name,
            path: mod.path
          });
        }
      });
    });

    const uniqueMods = Array.from(modsMap.values());

    if (uniqueMods.length === 0) {
      if (window.toastManager) {
        window.toastManager.error("No mods found in conflicts");
      }
      return;
    }

    container.innerHTML = "";

    uniqueMods.forEach(mod => {
      const selectItem = document.createElement("div");
      selectItem.className = "conflict-mod-select-item";
      selectItem.addEventListener("click", () => {
        this.selectModForSlotChange(mod);
      });

      const icon = document.createElement("i");
      icon.className = "bi bi-folder-fill";

      const name = document.createElement("div");
      name.className = "conflict-mod-select-item-name";
      name.textContent = mod.name;

      selectItem.appendChild(icon);
      selectItem.appendChild(name);
      container.appendChild(selectItem);
    });

    // Close conflict modal first
    this.closeConflictModal();
    
    // Small delay to allow conflict modal to close
    setTimeout(() => {
      modal.classList.remove("closing");
      if (window.modalManager) {
        window.modalManager.showOverlay();
      }
      modal.style.display = "block";
    }, 100);
  }
}

if (typeof window !== "undefined") {
  window.conflictModalManager = new ConflictModalManager();
}

