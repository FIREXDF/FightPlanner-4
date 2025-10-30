// Mod Info Manager
// Gère l'affichage des informations de mod dans le panneau de droite

class ModInfoManager {
    constructor() {
        // Don't cache container as it may not exist yet (loaded dynamically)
    }

    // Get container (always fresh)
    getContainer() {
        return document.getElementById('mod-info-content');
    }

    // Afficher les informations d'un mod
    displayModInfo(modData) {
        const container = this.getContainer();
        if (!container) {
            console.error('Container not found! Make sure the tab is loaded.');
            return;
        }

        // Escape HTML to prevent XSS
        const escapeHtml = (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        // Format description with line breaks
        const formatDescription = (desc) => {
            if (!desc) return 'No description available';
            return escapeHtml(desc).replace(/\n/g, '<br>');
        };

        // Build HTML based on available data
        let html = '';

        // Display name (main title)
        if (modData.display_name) {
            html += `
            <div class="mod-info-item">
                <div class="mod-info-label">Name</div>
                <div class="mod-info-value">${escapeHtml(modData.display_name)}</div>
            </div>`;
        }

        // Authors
        if (modData.authors) {
            html += `
            <div class="mod-info-item">
                <div class="mod-info-label">Authors</div>
                <div class="mod-info-value">${escapeHtml(modData.authors)}</div>
            </div>`;
        }

        // Version
        if (modData.version) {
            html += `
            <div class="mod-info-item">
                <div class="mod-info-label">Version</div>
                <div class="mod-info-value">${escapeHtml(modData.version)}</div>
            </div>`;
        }

        // Category
        if (modData.category) {
            html += `
            <div class="mod-info-item">
                <div class="mod-info-label">Category</div>
                <div class="mod-info-value">${escapeHtml(modData.category)}</div>
            </div>`;
        }

        // Description (with line breaks preserved)
        if (modData.description) {
            html += `
            <div class="mod-info-item">
                <div class="mod-info-label">Description</div>
                <div class="mod-info-value mod-info-description">${formatDescription(modData.description)}</div>
            </div>`;
        }

        // URL (as clickable link)
        if (modData.url) {
            html += `
            <div class="mod-info-item">
                <div class="mod-info-label">URL</div>
                <div class="mod-info-value">
                    <a href="#" onclick="window.electronAPI.openUrl('${escapeHtml(modData.url)}'); return false;" class="mod-info-link">
                        ${escapeHtml(modData.url)}
                    </a>
                </div>
            </div>`;
        }

        // If no data available
        if (html === '') {
            html = '<p class="mod-info-placeholder">No information available</p>';
        }
        
        // Trigger animation by removing and re-adding animation
        container.style.animation = 'none';
        container.offsetHeight; // Trigger reflow
        container.style.animation = '';
        
        container.innerHTML = html;
    }

    // Effacer les informations
    clearModInfo() {
        const container = this.getContainer();
        if (!container) return;
        container.innerHTML = '<p class="mod-info-placeholder">Select a mod to view details</p>';
    }

    // Afficher un message de chargement
    showLoading() {
        const container = this.getContainer();
        if (!container) return;
        container.innerHTML = '<p class="mod-info-placeholder">Loading...</p>';
    }

    // Afficher un message d'erreur
    showError(message) {
        const container = this.getContainer();
        if (!container) return;
        container.innerHTML = `<p class="mod-info-placeholder" style="color: #ff4444;">${message}</p>`;
    }
}

// Créer une instance globale
window.modInfoManager = new ModInfoManager();

// Exemple d'utilisation (à supprimer ou commenter plus tard)
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

