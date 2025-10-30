// Toast Manager
// Gère les notifications toast de l'application

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupContainer());
        } else {
            this.setupContainer();
        }
    }

    setupContainer() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            console.warn('Toast container not found');
        }
    }

    /**
     * Show a toast notification
     * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
     * @param {string} message - Message to display
     * @param {number} duration - Duration in ms (default: 3000)
     */
    show(type, message, duration = 3000) {
        if (!this.container) {
            this.setupContainer();
            if (!this.container) {
                console.error('Cannot show toast: container not found');
                return;
            }
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Choose icon based on type
        let icon = '';
        switch (type) {
            case 'success':
                icon = '<i class="bi bi-check-circle-fill"></i>';
                break;
            case 'error':
                icon = '<i class="bi bi-x-circle-fill"></i>';
                break;
            case 'warning':
                icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
                break;
            case 'info':
                icon = '<i class="bi bi-info-circle-fill"></i>';
                break;
        }

        toast.innerHTML = `
            ${icon}
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close">
                <i class="bi bi-x"></i>
            </button>
        `;

        // Add to container
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.hide(toast));

        // Trigger entrance animation
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);

        // Auto-hide after duration
        setTimeout(() => {
            this.hide(toast);
        }, duration);
    }

    hide(toast) {
        if (!toast || !toast.parentElement) return;

        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');

        // Remove from DOM after animation
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
            
            // Remove from array
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    // Helper methods for common use cases
    success(message, duration) {
        this.show('success', message, duration);
    }

    error(message, duration) {
        this.show('error', message, duration);
    }

    warning(message, duration) {
        this.show('warning', message, duration);
    }

    info(message, duration) {
        this.show('info', message, duration);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.toastManager = new ToastManager();
    console.log('Toast Manager initialized');
}



