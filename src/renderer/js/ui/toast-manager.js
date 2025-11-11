class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = [];
    this.toastHistory = new Map();
    this.toastCooldown = 2000;
    this.groupedToasts = new Map();
    this.groupTimeout = null;
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.setupContainer()
      );
    } else {
      this.setupContainer();
    }
  }

  setupContainer() {
    this.container = document.getElementById("toast-container");
    if (!this.container) {
      console.warn("Toast container not found");
    }
  }

  /**
   * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms (default: 3000)
   */
  show(type, message, duration = 3000) {
    if (!this.container) {
      this.setupContainer();
      if (!this.container) {
        console.error("Cannot show toast: container not found");
        return;
      }
    }

    const toastKey = `${type}:${message}`;
    const now = Date.now();

    if (this.toastHistory.has(toastKey)) {
      const lastShown = this.toastHistory.get(toastKey);
      const timeSince = now - lastShown;

      if (timeSince < this.toastCooldown) {
        console.log(
          "[Toast] Skipping duplicate toast (shown",
          timeSince,
          "ms ago):",
          message
        );
        return;
      }
    }

    this.toastHistory.set(toastKey, now);

    for (const [key, timestamp] of this.toastHistory.entries()) {
      if (now - timestamp > 10000) {
        this.toastHistory.delete(key);
      }
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "";
    switch (type) {
      case "success":
        icon = '<i class="bi bi-check-circle-fill"></i>';
        break;
      case "error":
        icon = '<i class="bi bi-x-circle-fill"></i>';
        break;
      case "warning":
        icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
        break;
      case "info":
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

    this.container.appendChild(toast);
    this.toasts.push(toast);

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => this.hide(toast));

    setTimeout(() => {
      toast.classList.add("toast-show");
    }, 10);

    setTimeout(() => {
      this.hide(toast);
    }, duration);
  }

  hide(toast) {
    if (!toast || !toast.parentElement) return;

    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");

    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }

      const index = this.toasts.indexOf(toast);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    }, 300);
  }

  success(message, duration) {
    this.show("success", message, duration);
  }

  error(message, duration) {
    this.show("error", message, duration);
  }

  warning(message, duration) {
    this.show("warning", message, duration);
  }

  info(message, duration) {
    this.show("info", message, duration);
  }

  /**
   * Clear all toasts
   */
  clear() {
    this.toasts.forEach((toast) => {
      if (toast.parentElement) {
        toast.classList.remove("toast-show");
        toast.classList.add("toast-hide");
        setTimeout(() => {
          if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
          }
        }, 300);
      }
    });
    this.toasts = [];
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

if (typeof window !== "undefined") {
  window.toastManager = new ToastManager();
  console.log("Toast Manager initialized");
}
