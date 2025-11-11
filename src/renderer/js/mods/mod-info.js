class ModInfoManager {
  constructor() {}

  getContainer() {
    return document.getElementById("mod-info-content");
  }

  displayModInfo(modData) {
    const container = this.getContainer();
    if (!container) {
      console.error("Container not found! Make sure the tab is loaded.");
      return;
    }

    const escapeHtml = (text) => {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    const formatDescription = (desc) => {
      if (!desc) return "No description available";
      return escapeHtml(desc).replace(/\n/g, "<br>");
    };

    let html = "";

    if (modData.display_name) {
      html += `
<div class="mod-info-item">
<div class="mod-info-label">Name</div>
<div class="mod-info-value">${escapeHtml(modData.display_name)}</div>
</div>`;
    }

    if (modData.authors) {
      html += `
<div class="mod-info-item">
<div class="mod-info-label">Authors</div>
<div class="mod-info-value">${escapeHtml(modData.authors)}</div>
</div>`;
    }

    if (modData.version) {
      html += `
<div class="mod-info-item">
<div class="mod-info-label">Version</div>
<div class="mod-info-value">${escapeHtml(modData.version)}</div>
</div>`;
    }

    if (modData.category) {
      html += `
<div class="mod-info-item">
<div class="mod-info-label">Category</div>
<div class="mod-info-value">${escapeHtml(modData.category)}</div>
</div>`;
    }

    if (modData.description) {
      html += `
<div class="mod-info-item">
<div class="mod-info-label">Description</div>
<div class="mod-info-value mod-info-description">${formatDescription(
        modData.description
      )}</div>
</div>`;
    }

    if (modData.url) {
      html += `
<div class="mod-info-item">
<div class="mod-info-label">URL</div>
<div class="mod-info-value">
<a href="#" onclick="window.electronAPI.openUrl('${escapeHtml(
        modData.url
      )}'); return false;" class="mod-info-link">
${escapeHtml(modData.url)}
</a>
</div>
</div>`;
    }

    if (html === "") {
      html = '<p class="mod-info-placeholder">No information available</p>';
    }

    container.style.animation = "none";
    container.offsetHeight;
    container.style.animation = "";

    container.innerHTML = html;
  }

  clearModInfo() {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML =
      '<p class="mod-info-placeholder">Select a mod to view details</p>';
  }

  showLoading() {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML = '<p class="mod-info-placeholder">Loading...</p>';
  }

  showError(message) {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML = `<p class="mod-info-placeholder" style="color: #ff4444;">${message}</p>`;
  }
}

window.modInfoManager = new ModInfoManager();

/*
window.modInfoManager.displayModInfo({
name: "Super Smash Bros Ultimate Mod",
version: "1.0.0",
author: "ModAuthor",
description: "An awesome mod for Smash Ultimate",
size: "250 MB",
date: "2024-01-15"
});
*/
