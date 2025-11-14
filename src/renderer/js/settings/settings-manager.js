class SettingsManager {
  constructor() {
    this.settings = { 
      modsPath: null, 
      pluginsPath: null,
      switchIp: null,
      switchPort: "5000",
      switchFtpPath: null,
      conflictDetectionEnabled: true,
      conflictWhitelistPatterns: []
    };
    this.initialized = false;
    this.tabSwitchingAttached = false;
    this.initSettings();
    this.initializeUI();
  }

  async initSettings() {
    this.settings = await this.loadSettings();
  }

  initializeUI() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.setupEventListeners();
        this.initialized = true;
      });
    } else {
      this.setupEventListeners();
      this.initialized = true;
    }
  }

  setupEventListeners() {
    if (!this.tabSwitchingAttached) {
      document.addEventListener("click", (e) => {
        if (e.target.classList.contains("settings-tab-btn")) {
          const tabName = e.target.dataset.settingsTab;
          this.switchSettingsTab(tabName);
          
          if (tabName === 'logs' && window.logsManager) {
            setTimeout(() => {
              window.logsManager.reinitialize();
            }, 250);
          }
          
          if (tabName === 'customization' && window.customizationManager) {
            setTimeout(() => {
              window.customizationManager.setupEventListeners();
            }, 250);
          }
        }
      });
      this.tabSwitchingAttached = true;
    }

    const animationSelector = document.getElementById("animation-preference");
    if (animationSelector && !animationSelector.dataset.listenerAttached) {
      animationSelector
        .querySelectorAll(".animation-option")
        .forEach((option) => {
          option.addEventListener("click", () => {
            const value = option.dataset.value;
            this.setAnimationPreference(value);

            animationSelector
              .querySelectorAll(".animation-option")
              .forEach((opt) => {
                opt.classList.remove("active");
              });
            option.classList.add("active");
          });
        });
      animationSelector.dataset.listenerAttached = "true";
      this.loadAnimationPreference();
    }

    const browseMods = document.getElementById("browse-mods-folder");
    if (browseMods && !browseMods.dataset.listenerAttached) {
      browseMods.addEventListener("click", () => this.browseModsFolder());
      browseMods.dataset.listenerAttached = "true";
      console.log("Browse mods button listener attached");
    }

    const browsePlugins = document.getElementById("browse-plugins-folder");
    if (browsePlugins && !browsePlugins.dataset.listenerAttached) {
      browsePlugins.addEventListener("click", () => this.browsePluginsFolder());
      browsePlugins.dataset.listenerAttached = "true";
      console.log("Browse plugins button listener attached");
    }

    const restartTutorialBtn = document.getElementById("restart-tutorial-btn");
    if (restartTutorialBtn && !restartTutorialBtn.dataset.listenerAttached) {
      restartTutorialBtn.addEventListener("click", async () => {
        if (window.tutorial) {
          window.tutorial.show();
        }
      });
      restartTutorialBtn.dataset.listenerAttached = "true";
      console.log("Restart tutorial button listener attached");
    }

    const clearTempFilesBtn = document.getElementById("clear-temp-files-btn");
    if (clearTempFilesBtn && !clearTempFilesBtn.dataset.listenerAttached) {
      clearTempFilesBtn.addEventListener("click", async () => {
        await this.clearTempFiles();
      });
      clearTempFilesBtn.dataset.listenerAttached = "true";
      console.log("Clear temp files button listener attached");
    }

    const installConfirmToggle = document.getElementById("install-confirm-enabled");
    if (installConfirmToggle && !installConfirmToggle.dataset.listenerAttached) {
      installConfirmToggle.addEventListener("change", async () => {
        console.log("Install confirm toggle changed!");
        const enabled = installConfirmToggle.checked;
        console.log("New value:", enabled);
        
        try {
          await window.electronAPI.store.set("installConfirmEnabled", enabled);
          console.log("Setting saved successfully");
          
          if (window.toastManager) {
            window.toastManager.success(
              enabled ? "Install confirmation enabled" : "Install confirmation disabled"
            );
          } else {
            console.warn("Toast manager not available");
          }
        } catch (error) {
          console.error("Failed to save install confirm setting:", error);
          if (window.toastManager) {
            window.toastManager.error("Failed to save setting");
          }
        }
      });
      installConfirmToggle.dataset.listenerAttached = "true";
      console.log("Install confirm toggle listener attached");
      
      this.loadInstallConfirmSetting();
    } else {
      console.log("Install confirm toggle:", installConfirmToggle ? "already has listener" : "not found");
    }

    const switchIp = document.getElementById("switch-ip");
    if (switchIp && !switchIp.dataset.listenerAttached) {
      switchIp.addEventListener("change", () => {
        this.settings.switchIp = switchIp.value;
        this.saveSettings();
      });
      switchIp.dataset.listenerAttached = "true";
    }

    const switchPort = document.getElementById("switch-port");
    if (switchPort && !switchPort.dataset.listenerAttached) {
      switchPort.addEventListener("change", () => {
        this.settings.switchPort = switchPort.value || "5000";
        this.saveSettings();
      });
      switchPort.dataset.listenerAttached = "true";
    }

    const switchFtpPath = document.getElementById("switch-ftp-path");
    if (switchFtpPath && !switchFtpPath.dataset.listenerAttached) {
      switchFtpPath.addEventListener("change", () => {
        this.settings.switchFtpPath = switchFtpPath.value;
        this.saveSettings();
      });
      switchFtpPath.dataset.listenerAttached = "true";
    }

    const conflictDetectionEnabled = document.getElementById("conflict-detection-enabled");
    if (conflictDetectionEnabled && !conflictDetectionEnabled.dataset.listenerAttached) {
      conflictDetectionEnabled.addEventListener("change", () => {
        this.settings.conflictDetectionEnabled = conflictDetectionEnabled.checked;
        this.saveSettings();
      });
      conflictDetectionEnabled.dataset.listenerAttached = "true";
    }

    this.updateModsFolderUI();
    this.updatePluginsFolderUI();
    this.updateSwitchSettingsUI();
    this.updateConflictDetectionUI();
  }

  switchSettingsTab(tabName) {
    document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    const activeBtn = document.querySelector(
      `[data-settings-tab="${tabName}"]`
    );
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    const currentActive = document.querySelector(
      ".settings-tab-content.active"
    );
    const newActive = document.getElementById(`settings-${tabName}`);

    if (currentActive && newActive && currentActive !== newActive) {
      currentActive.classList.add('fade-out');
      
      setTimeout(() => {
        currentActive.classList.remove("active", "fade-out");
        newActive.classList.add("active");
      }, 300);
    } else if (newActive) {
      document.querySelectorAll(".settings-tab-content").forEach((content) => {
        content.classList.remove("active", "fade-out");
      });
      newActive.classList.add("active");
    }
  }

  async browseModsFolder() {
    if (!window.electronAPI || !window.electronAPI.selectFolder) {
      console.error("Electron API not available");
      return;
    }

    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      const oldPath = this.settings.modsPath;
      this.settings.modsPath = folder;
      this.saveSettings();
      this.updateModsFolderUI();

      if (oldPath !== folder) {
        this.checkModsPath(folder);
      }
    }
  }

  checkModsPath(path) {
    if (!path) return;

    const normalizedPath = path.toLowerCase().replace(/\\/g, "/");
    const hasCorrectStructure =
      normalizedPath.includes("ultimate/mods") ||
      normalizedPath.includes("ultimate\\mods");

    if (!hasCorrectStructure) {
      this.showPathWarningModal(path);
    }
  }

  showPathWarningModal(path) {
    if (!window.modalManager) return;

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
<div class="modal">
<div class="modal-header">
<i class="bi bi-exclamation-triangle" style="color: #f59e0b; font-size: 24px; margin-right: 10px;"></i>
<h2>Path Warning</h2>
</div>
<div class="modal-body">
<p style="margin-bottom: 15px;">The selected path doesn't seem to contain the expected structure:</p>
<code style="display: block; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; margin-bottom: 15px; word-break: break-all;">${path}</code>
<p style="margin-bottom: 10px;">Expected path should contain:</p>
<ul style="margin-left: 20px; margin-bottom: 15px; color: #aaa;">
<li><strong>ultimate/mods</strong></li>
</ul>
<p style="color: #888;">Example: <code>sd:/ultimate/mods</code></p>
<p style="margin-top: 15px; color: #f59e0b;">⚠️ Using an incorrect path may prevent mods from working.</p>
</div>
<div class="modal-footer">
<button class="modal-btn modal-btn-primary" id="path-warning-ok">
<i class="bi bi-check-lg"></i>
OK, I understand
</button>
</div>
</div>
`;

    document.body.appendChild(modal);

    const okBtn = modal.querySelector("#path-warning-ok");
    okBtn.addEventListener("click", () => {
      modal.remove();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);
  }

  async browsePluginsFolder() {
    if (!window.electronAPI || !window.electronAPI.selectFolder) {
      console.error("Electron API not available");
      return;
    }

    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      this.settings.pluginsPath = folder;
      this.saveSettings();
      this.updatePluginsFolderUI();
    }
  }

  updateModsFolderUI() {
    const input = document.getElementById("mods-folder-path");
    if (input && this.settings.modsPath) {
      input.value = this.settings.modsPath;
    }
  }

  updatePluginsFolderUI() {
    const input = document.getElementById("plugins-folder-path");
    if (input && this.settings.pluginsPath) {
      input.value = this.settings.pluginsPath;
    }
  }

  updateSwitchSettingsUI() {
    const switchIpInput = document.getElementById("switch-ip");
    if (switchIpInput && this.settings.switchIp) {
      switchIpInput.value = this.settings.switchIp;
    }

    const switchPortInput = document.getElementById("switch-port");
    if (switchPortInput && this.settings.switchPort) {
      switchPortInput.value = this.settings.switchPort;
    }

    const switchFtpPathInput = document.getElementById("switch-ftp-path");
    if (switchFtpPathInput && this.settings.switchFtpPath) {
      switchFtpPathInput.value = this.settings.switchFtpPath;
    }
  }

  updateConflictDetectionUI() {
    const conflictDetectionCheckbox = document.getElementById("conflict-detection-enabled");
    if (conflictDetectionCheckbox) {
      conflictDetectionCheckbox.checked = this.settings.conflictDetectionEnabled !== false;
    }
  }

  async loadSettings() {
    try {
      const modsPath = await window.electronAPI.store.get("modsPath");
      const pluginsPath = await window.electronAPI.store.get("pluginsPath");
      const switchIp = await window.electronAPI.store.get("switchIp");
      const switchPort = await window.electronAPI.store.get("switchPort");
      const switchFtpPath = await window.electronAPI.store.get("switchFtpPath");
      const conflictDetectionEnabled = await window.electronAPI.store.get("conflictDetectionEnabled");
      return {
        modsPath: modsPath || null,
        pluginsPath: pluginsPath || null,
        switchIp: switchIp || null,
        switchPort: switchPort || "5000",
        switchFtpPath: switchFtpPath || null,
        conflictDetectionEnabled: conflictDetectionEnabled !== false,
      };
    } catch (error) {
      console.error("Failed to load settings:", error);
      return {
        modsPath: null,
        pluginsPath: null,
        switchIp: null,
        switchPort: "5000",
        switchFtpPath: null,
        conflictDetectionEnabled: true,
      };
    }
  }

  async saveSettings() {
    try {
      await window.electronAPI.store.set("modsPath", this.settings.modsPath);
      await window.electronAPI.store.set(
        "pluginsPath",
        this.settings.pluginsPath
      );
      await window.electronAPI.store.set("switchIp", this.settings.switchIp);
      await window.electronAPI.store.set("switchPort", this.settings.switchPort);
      await window.electronAPI.store.set("switchFtpPath", this.settings.switchFtpPath);
      await window.electronAPI.store.set("conflictDetectionEnabled", this.settings.conflictDetectionEnabled);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  getModsPath() {
    return this.settings.modsPath || null;
  }

  getPluginsPath() {
    return this.settings.pluginsPath || null;
  }

  hasModsPath() {
    return !!this.settings.modsPath;
  }

  hasPluginsPath() {
    return !!this.settings.pluginsPath;
  }

  getSwitchIp() {
    return this.settings.switchIp || null;
  }

  getSwitchPort() {
    return this.settings.switchPort || "5000";
  }

  getSwitchFtpPath() {
    return this.settings.switchFtpPath || null;
  }

  hasSwitchConfig() {
    return !!(this.settings.switchIp && this.settings.switchPort);
  }

  async setAnimationPreference(preference) {
    try {
      await window.electronAPI.store.set("animationPreference", preference);
      this.applyAnimationPreference(preference);
    } catch (error) {
      console.error("Failed to save animation preference:", error);
    }
  }

  async loadAnimationPreference() {
    try {
      const preference =
        (await window.electronAPI.store.get("animationPreference")) || "full";
      const animationSelector = document.getElementById("animation-preference");
      if (animationSelector) {
        animationSelector
          .querySelectorAll(".animation-option")
          .forEach((option) => {
            if (option.dataset.value === preference) {
              option.classList.add("active");
            } else {
              option.classList.remove("active");
            }
          });
      }
      this.applyAnimationPreference(preference);
    } catch (error) {
      console.error("Failed to load animation preference:", error);
      this.applyAnimationPreference("full");
    }
  }

  applyAnimationPreference(preference) {
    document.body.classList.remove("reduced-animations", "no-animations");

    if (preference === "reduced") {
      document.body.classList.add("reduced-animations");
    } else if (preference === "none") {
      document.body.classList.add("no-animations");
    }
  }

  async loadInstallConfirmSetting() {
    try {
      const installConfirmEnabled = await window.electronAPI.store.get("installConfirmEnabled");
      const installConfirmToggle = document.getElementById("install-confirm-enabled");
      if (installConfirmToggle) {
        installConfirmToggle.checked = installConfirmEnabled !== false;
      }
      console.log("Loaded install confirm setting:", installConfirmEnabled);
    } catch (error) {
      console.error("Failed to load install confirm setting:", error);
    }
  }

  async clearTempFiles() {
    if (!window.electronAPI || !window.electronAPI.clearTempFiles) {
      if (window.toastManager) {
        window.toastManager.error('Clear temp files function not available');
      }
      return;
    }

    const btn = document.getElementById("clear-temp-files-btn");
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }

    try {
      if (window.toastManager) {
        window.toastManager.info('Clearing temporary files...');
      }

      const result = await window.electronAPI.clearTempFiles();

      if (result.success) {
        const message = result.deletedFiles > 0 
          ? `Cleared ${result.deletedFiles} file(s) and ${result.deletedFolders} folder(s) (${result.totalSize} MB freed)`
          : 'No temporary files to clear';
        
        if (window.toastManager) {
          window.toastManager.success(message);
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error(`Failed to clear temp files: ${result.error}`);
        }
      }
    } catch (error) {
      if (window.toastManager) {
        window.toastManager.error(`Error: ${error.message}`);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.settingsManager = new SettingsManager();
  console.log("Settings Manager initialized");

  if (window.electronAPI && window.electronAPI.store) {
    window.electronAPI.store.get("animationPreference").then((preference) => {
      if (window.settingsManager && preference) {
        window.settingsManager.applyAnimationPreference(preference);
      }
    });
  }
}
