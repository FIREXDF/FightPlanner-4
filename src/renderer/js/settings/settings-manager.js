class SettingsManager {
  constructor() {
    this.settings = { 
      modsPath: null, 
      pluginsPath: null,
      emulatorType: "yuzu",
      emulatorPath: null,
      gamePath: null,
      emulatorFullscreen: false,
      switchIp: null,
      switchPort: "5000",
      switchFtpPath: null,
      conflictDetectionEnabled: true,
      conflictWhitelistPatterns: [],
      autoCheckPluginUpdates: false,
      pluginUpdateIntroShown: false,
      theme: "dark"
    };
    this.initialized = false;
    this.tabSwitchingAttached = false;
    this.initSettings();
    this.initializeUI();
  }

  async initSettings() {
    this.settings = await this.loadSettings();
    this.applyTheme(this.settings.theme);
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

    const browseEmulator = document.getElementById("browse-emulator-path");
    if (browseEmulator && !browseEmulator.dataset.listenerAttached) {
      browseEmulator.addEventListener("click", () => this.browseEmulatorPath());
      browseEmulator.dataset.listenerAttached = "true";
      console.log("Browse emulator button listener attached");
    }

    const browseGame = document.getElementById("browse-game-path");
    if (browseGame && !browseGame.dataset.listenerAttached) {
      browseGame.addEventListener("click", () => this.browseGamePath());
      browseGame.dataset.listenerAttached = "true";
      console.log("Browse game button listener attached");
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
            window.toastManager.success("toasts.settingSaved");
          } else {
            console.warn("Toast manager not available");
          }
        } catch (error) {
          console.error("Failed to save install confirm setting:", error);
          if (window.toastManager) {
            window.toastManager.error("toasts.failedToSaveSetting");
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

    const autoCheckPluginUpdates = document.getElementById("auto-check-plugin-updates-enabled");
    if (autoCheckPluginUpdates && !autoCheckPluginUpdates.dataset.listenerAttached) {
      autoCheckPluginUpdates.addEventListener("change", () => {
        this.settings.autoCheckPluginUpdates = autoCheckPluginUpdates.checked;
        this.saveSettings();
      });
      autoCheckPluginUpdates.dataset.listenerAttached = "true";
    }

    const languageTypeSelect = document.getElementById("language-type-select");
    if (languageTypeSelect && !languageTypeSelect.dataset.listenerAttached) {
      const trigger = languageTypeSelect.querySelector(".custom-select-trigger");
      const options = languageTypeSelect.querySelectorAll(".custom-select-option");
      const selectedValue = languageTypeSelect.querySelector(".selected-value");

      if (trigger) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          languageTypeSelect.classList.toggle("open");
        });
      }

      document.addEventListener("click", (e) => {
        if (!languageTypeSelect.contains(e.target)) {
          languageTypeSelect.classList.remove("open");
        }
      });

      options.forEach((option) => {
        option.addEventListener("click", async () => {
          const value = option.dataset.value;
          const text = option.querySelector("span").textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove("active"));
          option.classList.add("active");

          languageTypeSelect.classList.remove("open");

          if (window.i18n) {
            await window.i18n.changeLocale(value);
          }
        });
      });

      languageTypeSelect.dataset.listenerAttached = "true";
      this.updateLanguageTypeUI();

      window.addEventListener('localeChanged', () => {
        this.updateLanguageTypeUI();
      });
    }

    const themeSelect = document.getElementById("theme-select");
    if (themeSelect && !themeSelect.dataset.listenerAttached) {
      const trigger = themeSelect.querySelector(".custom-select-trigger");
      const options = themeSelect.querySelectorAll(".custom-select-option");
      const selectedValue = themeSelect.querySelector(".selected-value");

      if (trigger) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          themeSelect.classList.toggle("open");
        });
      }

      document.addEventListener("click", (e) => {
        if (!themeSelect.contains(e.target)) {
          themeSelect.classList.remove("open");
        }
      });

      options.forEach((option) => {
        option.addEventListener("click", () => {
          const value = option.dataset.value;
          const text = option.querySelector("span").textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove("active"));
          option.classList.add("active");

          themeSelect.classList.remove("open");

          this.setTheme(value);
        });
      });

      themeSelect.dataset.listenerAttached = "true";
      this.updateThemeUI();
    }

    const emulatorTypeSelect = document.getElementById("emulator-type-select");
    if (emulatorTypeSelect && !emulatorTypeSelect.dataset.listenerAttached) {
      const trigger = emulatorTypeSelect.querySelector(".custom-select-trigger");
      const options = emulatorTypeSelect.querySelectorAll(".custom-select-option");
      const selectedValue = emulatorTypeSelect.querySelector(".selected-value");

      if (trigger) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          emulatorTypeSelect.classList.toggle("open");
        });
      }

      document.addEventListener("click", (e) => {
        if (!emulatorTypeSelect.contains(e.target)) {
          emulatorTypeSelect.classList.remove("open");
        }
      });

      options.forEach((option) => {
        option.addEventListener("click", () => {
          const value = option.dataset.value;
          const text = option.querySelector("span").textContent;

          if (selectedValue) {
            selectedValue.textContent = text;
          }

          options.forEach((opt) => opt.classList.remove("active"));
          option.classList.add("active");

          emulatorTypeSelect.classList.remove("open");

          this.settings.emulatorType = value;
          this.saveSettings();
          this.updateFullscreenVisibility();
        });
      });

      emulatorTypeSelect.dataset.listenerAttached = "true";
    }

    const emulatorFullscreenToggle = document.getElementById("emulator-fullscreen-enabled");
    if (emulatorFullscreenToggle && !emulatorFullscreenToggle.dataset.listenerAttached) {
      emulatorFullscreenToggle.addEventListener("change", () => {
        this.settings.emulatorFullscreen = emulatorFullscreenToggle.checked;
        this.saveSettings();
      });
      emulatorFullscreenToggle.dataset.listenerAttached = "true";
    }

    this.updateModsFolderUI();
    this.updatePluginsFolderUI();
    this.updateLanguageTypeUI();
    this.updateEmulatorTypeUI();
    this.updateEmulatorPathUI();
    this.updateGamePathUI();
    this.updateEmulatorFullscreenUI();
    this.updateFullscreenVisibility();
    this.updateSwitchSettingsUI();
    this.updateConflictDetectionUI();
    this.updateAutoCheckPluginUpdatesUI();
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

    const t = (key, params = {}) => {
      return window.i18n && window.i18n.t ? window.i18n.t(key, params) : key;
    };

    const escapeHtml = (text) => {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
<div class="modal">
<div class="modal-header">
<i class="bi bi-exclamation-triangle" style="color: #f59e0b; font-size: 24px; margin-right: 10px;"></i>
<h2>${t("settings.pathWarning")}</h2>
</div>
<div class="modal-body">
<p style="margin-bottom: 15px;">${t("settings.pathWarningText")}</p>
<code style="display: block; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; margin-bottom: 15px; word-break: break-all;">${escapeHtml(path)}</code>
<p style="margin-bottom: 10px;">${t("settings.expectedPath")}</p>
<ul style="margin-left: 20px; margin-bottom: 15px; color: #aaa;">
<li><strong>ultimate/mods</strong></li>
</ul>
<p style="color: #888;">${t("settings.example")} <code>sd:/ultimate/mods</code></p>
<p style="margin-top: 15px; color: #f59e0b;">${t("settings.incorrectPathWarning")}</p>
</div>
<div class="modal-footer">
<button class="modal-btn modal-btn-primary" id="path-warning-ok">
<i class="bi bi-check-lg"></i>
${t("settings.okUnderstand")}
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

  async browseEmulatorPath() {
    if (!window.electronAPI || !window.electronAPI.selectEmulatorFile) {
      console.error("Electron API not available");
      return;
    }

    const file = await window.electronAPI.selectEmulatorFile();
    if (file) {
      this.settings.emulatorPath = file;
      this.saveSettings();
      this.updateEmulatorPathUI();
    }
  }

  async browseGamePath() {
    if (!window.electronAPI || !window.electronAPI.selectGameFile) {
      console.error("Electron API not available");
      return;
    }

    const file = await window.electronAPI.selectGameFile();
    if (file) {
      this.settings.gamePath = file;
      this.saveSettings();
      this.updateGamePathUI();
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

  updateLanguageTypeUI() {
    const languageTypeSelect = document.getElementById("language-type-select");
    if (languageTypeSelect && window.i18n) {
      const selectedValue = languageTypeSelect.querySelector(".selected-value");
      const options = languageTypeSelect.querySelectorAll(".custom-select-option");
      const currentLocale = window.i18n.getCurrentLocale() || "en";

      options.forEach((option) => {
        if (option.dataset.value === currentLocale) {
          option.classList.add("active");
          if (selectedValue) {
            selectedValue.textContent = option.querySelector("span").textContent;
          }
        } else {
          option.classList.remove("active");
        }
      });
    }
  }

  updateEmulatorTypeUI() {
    const emulatorTypeSelect = document.getElementById("emulator-type-select");
    if (emulatorTypeSelect) {
      const selectedValue = emulatorTypeSelect.querySelector(".selected-value");
      const options = emulatorTypeSelect.querySelectorAll(".custom-select-option");
      const currentType = this.settings.emulatorType || "yuzu";

      options.forEach((option) => {
        if (option.dataset.value === currentType) {
          option.classList.add("active");
          if (selectedValue) {
            selectedValue.textContent = option.querySelector("span").textContent;
          }
        } else {
          option.classList.remove("active");
        }
      });
    }
  }

  updateEmulatorPathUI() {
    const input = document.getElementById("emulator-path");
    if (input && this.settings.emulatorPath) {
      input.value = this.settings.emulatorPath;
    }
  }

  updateGamePathUI() {
    const input = document.getElementById("game-path");
    if (input && this.settings.gamePath) {
      input.value = this.settings.gamePath;
    }
  }

  updateEmulatorFullscreenUI() {
    const toggle = document.getElementById("emulator-fullscreen-enabled");
    if (toggle) {
      toggle.checked = this.settings.emulatorFullscreen || false;
    }
  }

  updateFullscreenVisibility() {
    const fullscreenToggle = document.querySelector('#emulator-fullscreen-enabled');
    if (!fullscreenToggle) return;
    
    const fullscreenSection = fullscreenToggle.closest('.settings-section');
    if (fullscreenSection) {
      if (this.settings.emulatorType === "ryujinx") {
        fullscreenSection.style.display = "none";
      } else {
        fullscreenSection.style.display = "block";
      }
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

  updateAutoCheckPluginUpdatesUI() {
    const autoCheckPluginUpdatesCheckbox = document.getElementById("auto-check-plugin-updates-enabled");
    if (autoCheckPluginUpdatesCheckbox) {
      autoCheckPluginUpdatesCheckbox.checked = this.settings.autoCheckPluginUpdates || false;
    }
  }

  updateThemeUI() {
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
      const selectedValue = themeSelect.querySelector(".selected-value");
      const options = themeSelect.querySelectorAll(".custom-select-option");
      const currentTheme = this.settings.theme || "dark";

      options.forEach((option) => {
        if (option.dataset.value === currentTheme) {
          option.classList.add("active");
          if (selectedValue) {
            selectedValue.textContent = option.querySelector("span").textContent;
          }
        } else {
          option.classList.remove("active");
        }
      });
    }
  }

  async setTheme(theme) {
    this.settings.theme = theme;
    this.applyTheme(theme);
    await window.electronAPI.store.set("theme", theme);
  }

  applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  async loadSettings() {
    try {
      const modsPath = await window.electronAPI.store.get("modsPath");
      const pluginsPath = await window.electronAPI.store.get("pluginsPath");
      const emulatorType = await window.electronAPI.store.get("emulatorType");
      const emulatorPath = await window.electronAPI.store.get("emulatorPath");
      const gamePath = await window.electronAPI.store.get("gamePath");
      const emulatorFullscreen = await window.electronAPI.store.get("emulatorFullscreen");
      const switchIp = await window.electronAPI.store.get("switchIp");
      const switchPort = await window.electronAPI.store.get("switchPort");
      const switchFtpPath = await window.electronAPI.store.get("switchFtpPath");
      const conflictDetectionEnabled = await window.electronAPI.store.get("conflictDetectionEnabled");
      const autoCheckPluginUpdates = await window.electronAPI.store.get("autoCheckPluginUpdates");
      const pluginUpdateIntroShown = await window.electronAPI.store.get("pluginUpdateIntroShown");
      const theme = await window.electronAPI.store.get("theme");
      return {
        modsPath: modsPath || null,
        pluginsPath: pluginsPath || null,
        emulatorType: emulatorType || "yuzu",
        emulatorPath: emulatorPath || null,
        gamePath: gamePath || null,
        emulatorFullscreen: emulatorFullscreen || false,
        switchIp: switchIp || null,
        switchPort: switchPort || "5000",
        switchFtpPath: switchFtpPath || null,
        conflictDetectionEnabled: conflictDetectionEnabled !== false,
        autoCheckPluginUpdates: autoCheckPluginUpdates || false,
        pluginUpdateIntroShown: pluginUpdateIntroShown || false,
        theme: theme || "dark",
      };
    } catch (error) {
      console.error("Failed to load settings:", error);
      return {
        modsPath: null,
        pluginsPath: null,
        emulatorType: "yuzu",
        emulatorPath: null,
        gamePath: null,
        emulatorFullscreen: false,
        switchIp: null,
        switchPort: "5000",
        switchFtpPath: null,
        conflictDetectionEnabled: true,
        autoCheckPluginUpdates: false,
        pluginUpdateIntroShown: false,
        theme: "dark",
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
      await window.electronAPI.store.set("emulatorType", this.settings.emulatorType);
      await window.electronAPI.store.set("emulatorPath", this.settings.emulatorPath);
      await window.electronAPI.store.set("gamePath", this.settings.gamePath);
      await window.electronAPI.store.set("emulatorFullscreen", this.settings.emulatorFullscreen);
      await window.electronAPI.store.set("switchIp", this.settings.switchIp);
      await window.electronAPI.store.set("switchPort", this.settings.switchPort);
      await window.electronAPI.store.set("switchFtpPath", this.settings.switchFtpPath);
      await window.electronAPI.store.set("conflictDetectionEnabled", this.settings.conflictDetectionEnabled);
      await window.electronAPI.store.set("autoCheckPluginUpdates", this.settings.autoCheckPluginUpdates);
      await window.electronAPI.store.set("pluginUpdateIntroShown", this.settings.pluginUpdateIntroShown);
      await window.electronAPI.store.set("theme", this.settings.theme);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  async setSetting(key, value) {
    this.settings[key] = value;
    // If specific UI update logic is needed, handle it here or rely on refresh
    if (key === 'autoCheckPluginUpdates') {
      this.updateAutoCheckPluginUpdatesUI();
    }
    await this.saveSettings();
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

  getEmulatorPath() {
    return this.settings.emulatorPath || null;
  }

  getGamePath() {
    return this.settings.gamePath || null;
  }

  hasEmulatorConfig() {
    return !!(this.settings.emulatorPath && this.settings.gamePath);
  }

  getEmulatorType() {
    return this.settings.emulatorType || "yuzu";
  }

  getEmulatorFullscreen() {
    return this.settings.emulatorFullscreen || false;
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
        window.toastManager.error('toasts.clearTempFilesNotAvailable');
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
        window.toastManager.info('toasts.clearingTempFiles');
      }

      const result = await window.electronAPI.clearTempFiles();

      if (result.success) {
        if (window.toastManager) {
          window.toastManager.success('toasts.tempFilesCleared');
        }
      } else {
        if (window.toastManager) {
          window.toastManager.error('toasts.failedToClearTempFiles', 3000, { error: result.error });
        }
      }
    } catch (error) {
      if (window.toastManager) {
        window.toastManager.error('toasts.failedToClearTempFiles', 3000, { error: error.message });
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
    window.electronAPI.store.get("theme").then((theme) => {
      if (window.settingsManager && theme) {
        window.settingsManager.applyTheme(theme);
      }
    });
  }
}
