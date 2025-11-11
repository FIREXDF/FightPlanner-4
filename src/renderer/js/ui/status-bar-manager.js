class StatusBarManager {
  constructor() {
    this.updateInterval = null;
    this.currentTab = null;
  }

  updateStatus(tabName) {
    if (typeof tabName === 'string') {
      this.currentTab = tabName;
    }
    const statusText = document.querySelector(".bottom-text-left") || document.querySelector(".bottom-text");
    if (!statusText) return;

    // Si aucun tabName n'est fourni et qu'on n'a pas de currentTab, ne pas modifier le statut
    if (!tabName && !this.currentTab) {
      return;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    const hasActiveDownloads = this.checkActiveDownloads();

    if (hasActiveDownloads) {
      this.updateDownloadsStatus(statusText);
    } else {
      this.animateStatusChange(statusText, () => {
        const tab = this.currentTab;
        switch (tab) {
          case "social":
            this.updateSocialStatus(statusText);
            break;
          case "downloads":
            this.updateDownloadsStatus(statusText);
            break;
          case "tools":
            this.updateToolsStatus(statusText);
            break;
          case "plugins":
            this.updatePluginsStatus(statusText);
            break;
          case "settings":
            this.updateSettingsStatus(statusText);
            break;
          case "characters":
            this.updateCharactersStatus(statusText);
            break;
          case "stages":
            this.updateStagesStatus(statusText);
            break;
          default:
            // Ne réinitialiser à "Ready" que si on n'a vraiment pas de tab actif
            if (!this.currentTab) {
              statusText.textContent = "Ready";
            }
            // Sinon, garder le statut actuel (ne rien faire)
        }
      });
    }
  }

  animateStatusChange(statusText, callback) {
    statusText.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    statusText.style.opacity = "0";
    statusText.style.transform = "translateY(5px)";

    setTimeout(() => {
      callback();

      setTimeout(() => {
        statusText.style.opacity = "1";
        statusText.style.transform = "translateY(0)";
      }, 10);
    }, 200);
  }

  checkActiveDownloads() {
    // Check for FTP transfer first
    if (window.downloadManager && window.downloadManager.ftpTransfer) {
      return true;
    }
    
    if (window.downloadManager && window.downloadManager.activeDownloads) {
      const activeDownloads = Array.from(
        window.downloadManager.activeDownloads.values()
      );
      return activeDownloads.length > 0;
    }
    return false;
  }

  checkAndUpdateForDownloads() {
    const statusText = document.querySelector(".bottom-text-left") || document.querySelector(".bottom-text");
    if (!statusText) return;

    const hasActiveDownloads = this.checkActiveDownloads();

    if (hasActiveDownloads) {
      this.animateStatusChange(statusText, () => {
        this.updateDownloadsStatus(statusText);
      });
    } else if (this.currentTab) {
      if (statusText.classList.contains("status-downloading")) {
        statusText.classList.remove("status-downloading");
        statusText.offsetHeight;
      }
      this.updateStatus(this.currentTab);
    }
  }

  async updateSocialStatus(statusText) {
    const updateStatus = async () => {
      if (this.currentTab !== "social" || this.checkActiveDownloads()) {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        return;
      }

      try {
        if (
          window.socialManager &&
          window.socialManager.authToken &&
          window.socialManager.userData
        ) {
          const userId = window.socialManager.userData.localId;

          try {
            const response = await fetch(
              `${window.socialManager.API_URL}/list/links?idToken=${window.socialManager.authToken}`
            );
            const modsData = await response.json();

            if (Array.isArray(modsData)) {
              const usernameEl = document.getElementById(
                "social-profile-username"
              );
              const username = usernameEl ? usernameEl.textContent : null;
              const myMods = modsData.filter((mod) => {
                const modUserId = mod.userId;
                const modPseudo = mod.pseudo;
                return (
                  modUserId === userId || (username && modPseudo === username)
                );
              });

              const friendsResponse = await fetch(
                `${window.socialManager.API_URL}/links-friends`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    idToken: window.socialManager.authToken,
                  }),
                }
              );
              const friendsData = await friendsResponse.json();

              let friendsCount = 0;
              if (friendsData.friends && Array.isArray(friendsData.friends)) {
                friendsCount = friendsData.friends.filter(
                  (f) => f.status === "accepted"
                ).length;
              }

              statusText.textContent = `Social • ${myMods.length} mod${
                myMods.length !== 1 ? "s" : ""
              } shared • ${friendsCount} friend${
                friendsCount !== 1 ? "s" : ""
              }`;
            } else {
              statusText.textContent = "Social • Connected";
            }
          } catch (e) {
            statusText.textContent = "Social • Connected";
          }
        } else {
          statusText.textContent = "Social • Not connected";
        }
      } catch (error) {
        statusText.textContent = "Social • Ready";
      }
    };

    await updateStatus();

    this.updateInterval = setInterval(updateStatus, 30000);
  }

  updateDownloadsStatus(statusText) {
    let animationFrame = 0;
    let lastUpdateTime = Date.now();
    let lastReceivedBytes = new Map();

    const updateStatus = () => {
      try {
        // Check for FTP transfer first
        if (window.downloadManager && window.downloadManager.ftpTransfer) {
          const ftp = window.downloadManager.ftpTransfer;
          const dots = ".".repeat(animationFrame % 4);
          animationFrame++;
          
          let statusContent = `FTP • Sending to Switch${dots}`;
          if (ftp.totalMods > 0) {
            statusContent += ` • ${ftp.currentMod}/${ftp.totalMods} mods`;
          }
          
          statusText.innerHTML = statusContent;
          
          if (!statusText.classList.contains("status-downloading")) {
            statusText.classList.add("status-downloading");
          }
          
          setTimeout(() => updateStatus(), 200);
          return;
        }

        if (window.downloadManager && window.downloadManager.activeDownloads) {
          const activeDownloads = Array.from(
            window.downloadManager.activeDownloads.values()
          );
          const activeCount = activeDownloads.length;
          const completedCount = window.downloadManager.completedDownloads
            ? window.downloadManager.completedDownloads.length
            : 0;

          if (activeCount > 0) {
            const firstDownload = activeDownloads[0];
            const currentTime = Date.now();
            const timeDelta = (currentTime - lastUpdateTime) / 1000;

            let speedText = "";
            let progressText = "";

            if (
              firstDownload.receivedBytes !== undefined &&
              firstDownload.totalBytes !== undefined &&
              firstDownload.totalBytes > 0
            ) {
              const progress = Math.round(
                (firstDownload.receivedBytes / firstDownload.totalBytes) * 100
              );
              progressText = `${progress}%`;

              const downloadId = firstDownload.id;
              const lastBytes = lastReceivedBytes.get(downloadId) || 0;
              const bytesDelta = firstDownload.receivedBytes - lastBytes;

              if (timeDelta > 0 && bytesDelta > 0) {
                const speedBytes = bytesDelta / timeDelta;
                speedText = this.formatSpeed(speedBytes);
              }

              lastReceivedBytes.set(downloadId, firstDownload.receivedBytes);
            } else if (firstDownload.progress !== undefined) {
              progressText = `${Math.round(firstDownload.progress)}%`;
            }

            let sizeInfo = "";
            if (
              firstDownload.totalBytes !== undefined &&
              firstDownload.totalBytes > 0
            ) {
              const received = firstDownload.receivedBytes || 0;
              sizeInfo = `${this.formatBytes(received)} / ${this.formatBytes(
                firstDownload.totalBytes
              )}`;
            }

            const fileName =
              firstDownload.fileName ||
              firstDownload.url?.split("/").pop() ||
              "Downloading...";
            const shortFileName =
              fileName.length > 30
                ? fileName.substring(0, 27) + "..."
                : fileName;

            const dots = ".".repeat(animationFrame % 4);
            const animIndicator =
              activeCount > 1 ? ` [${activeCount} active]` : "";

            let statusContent = `Downloads • ${shortFileName}${dots}`;
            if (progressText) statusContent += ` • ${progressText}`;
            if (sizeInfo) statusContent += ` • ${sizeInfo}`;
            if (speedText) statusContent += ` • ${speedText}`;
            statusContent += animIndicator;

            statusText.innerHTML = statusContent;

            if (!statusText.classList.contains("status-downloading")) {
              statusText.classList.add("status-downloading");
            }

            lastUpdateTime = currentTime;
            animationFrame++;
          } else {
            if (statusText.classList.contains("status-downloading")) {
              statusText.classList.remove("status-downloading");

              statusText.offsetHeight;
            }

            if (this.updateInterval) {
              clearInterval(this.updateInterval);
              this.updateInterval = null;
            }

            if (this.currentTab !== "downloads") {
              this.updateStatus(this.currentTab);
              return;
            }

            if (completedCount > 0) {
              statusText.textContent = `Downloads • ${completedCount} completed download${
                completedCount !== 1 ? "s" : ""
              }`;
            } else {
              statusText.textContent = "Downloads • No active downloads";
            }
          }
        } else {
          if (statusText.classList.contains("status-downloading")) {
            statusText.classList.remove("status-downloading");

            statusText.offsetHeight;
          }

          if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
          }

          if (this.currentTab !== "downloads") {
            this.updateStatus(this.currentTab);
            return;
          }

          statusText.textContent = "Downloads • Ready";
        }
      } catch (error) {
        console.error("Status bar error:", error);
        statusText.classList.remove("status-downloading");

        if (this.currentTab !== "downloads") {
          this.updateStatus(this.currentTab);
          return;
        }

        statusText.textContent = "Downloads • Ready";
      }
    };

    updateStatus();

    this.updateInterval = setInterval(() => {
      const hasActiveDownloads = this.checkActiveDownloads();
      if (hasActiveDownloads) {
        // Only update status if there's no ongoing FTP with its own loop
        if (!window.downloadManager || !window.downloadManager.ftpTransfer) {
          updateStatus();
        }
      } else {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }

        if (statusText.classList.contains("status-downloading")) {
          statusText.classList.remove("status-downloading");
          statusText.offsetHeight;
        }

        if (this.currentTab && this.currentTab !== "downloads") {
          this.updateStatus(this.currentTab);
        } else if (this.currentTab === "downloads") {
          const completedCount =
            window.downloadManager?.completedDownloads?.length || 0;
          if (completedCount > 0) {
            statusText.textContent = `Downloads • ${completedCount} completed download${
              completedCount !== 1 ? "s" : ""
            }`;
          } else {
            statusText.textContent = "Downloads • No active downloads";
          }
        }
      }
    }, 500);
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Format download speed
   */
  formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond === 0) return "";
    return this.formatBytes(bytesPerSecond) + "/s";
  }

  /**
   * Update status for Tools tab
   */
  updateToolsStatus(statusText) {
    const updateStatus = () => {
      if (this.currentTab !== "tools" || this.checkActiveDownloads()) {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        return;
      }

      try {
        if (window.modManager) {
          const mods = window.modManager.mods || [];
          const enabledMods = mods.filter(
            (mod) => mod.enabled !== false
          ).length;
          const totalMods = mods.length;

          statusText.textContent = `Mods • ${enabledMods}/${totalMods} mod${
            totalMods !== 1 ? "s" : ""
          } enabled`;
        } else {
          statusText.textContent = "Mods • Ready";
        }
      } catch (error) {
        statusText.textContent = "Mods • Ready";
      }
    };

    updateStatus();

    this.updateInterval = setInterval(updateStatus, 10000);
  }

  /**
   * Update status for Plugins tab
   */
  updatePluginsStatus(statusText) {
    const updateStatus = () => {
      if (this.currentTab !== "plugins" || this.checkActiveDownloads()) {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        return;
      }

      try {
        if (window.pluginManager) {
          const plugins = window.pluginManager.plugins || [];
          const enabledPlugins = plugins.filter(
            (p) => p.enabled !== false
          ).length;

          statusText.textContent = `Plugins • ${enabledPlugins}/${
            plugins.length
          } plugin${plugins.length !== 1 ? "s" : ""} enabled`;
        } else {
          statusText.textContent = "Plugins • Ready";
        }
      } catch (error) {
        statusText.textContent = "Plugins • Ready";
      }
    };

    updateStatus();
    this.updateInterval = setInterval(updateStatus, 10000);
  }

  /**
   * Update status for Settings tab
   */
  updateSettingsStatus(statusText) {
    statusText.textContent =
      "Settings • Configure your application preferences";
  }

  /**
   * Update status for Characters tab
   */
  updateCharactersStatus(statusText) {
    const updateStatus = () => {
      if (this.currentTab !== "characters" || this.checkActiveDownloads()) {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        return;
      }

      try {
        if (window.charactersManager) {
          const characters = window.charactersManager.characters || [];
          statusText.textContent = `Characters • ${
            characters.length
          } character${characters.length !== 1 ? "s" : ""} available`;
        } else {
          statusText.textContent = "Characters • Ready";
        }
      } catch (error) {
        statusText.textContent = "Characters • Ready";
      }
    };

    updateStatus();
    this.updateInterval = setInterval(updateStatus, 10000);
  }
  updateStagesStatus(statusText) {
    statusText.textContent = "Stages • Manage your custom stages";
  }

  updateConflictStatus(conflictCount) {
    const statusRight = document.querySelector(".bottom-text-right");
    if (!statusRight) return;

    // Clear existing content
    statusRight.innerHTML = '';

    if (conflictCount > 0) {
      const conflictText = document.createElement("span");
      conflictText.className = "conflict-link";
      conflictText.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (window.conflictModalManager) {
          window.conflictModalManager.showConflictModal();
        }
      });
      conflictText.textContent = `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} detected`;
      statusRight.appendChild(conflictText);
    }
  }

  clear() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    const statusText = document.querySelector(".bottom-text-left") || document.querySelector(".bottom-text");
    if (statusText) {
      statusText.textContent = "Ready";
    }
    const statusRight = document.querySelector(".bottom-text-right");
    if (statusRight) {
      statusRight.innerHTML = '';
    }
  }
}

if (typeof window !== "undefined") {
  window.statusBarManager = new StatusBarManager();
}
