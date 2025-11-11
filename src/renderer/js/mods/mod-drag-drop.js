class ModDragDropHandler {
  constructor() {
    this.dragOverlay = null;
    this.isDragging = false;
    this.dragAnimation = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupWindowDropListener();
    this.setupTabStatusUpdater();
  }

  setupTabStatusUpdater() {
    const updateStatus = () => {
      const isActive = this.isToolsTabActive();
      if (window.electronAPI && window.electronAPI.updateToolsTabStatus) {
        window.electronAPI.updateToolsTabStatus(isActive);
      }
    };

    const observer = new MutationObserver(updateStatus);
    observer.observe(document.body, { childList: true, subtree: true });
    
    setInterval(updateStatus, 500);
    updateStatus();
  }

  setupWindowDropListener() {
    if (window.electronAPI && window.electronAPI.onWindowDropFiles) {
      window.electronAPI.onWindowDropFiles((filePaths) => {
        this.hideDragOverlay();
        this.isDragging = false;
        
        if (window.toastManager) {
          window.toastManager.info(`Installing ${filePaths.length} file(s)...`);
        }
      });
    }

    if (window.electronAPI && window.electronAPI.onDropResult) {
      window.electronAPI.onDropResult((data) => {
        if (data && data.result) {
          if (data.result.success) {
            if (window.toastManager) {
              window.toastManager.success(`Mod "${data.result.modName}" installed successfully!`);
            }
            
            if (window.settingsManager) {
              window.settingsManager.refreshModsList();
            }
          } else {
            if (window.toastManager) {
              window.toastManager.error(`Installation error: ${data.result.error || 'Unknown error'}`);
            }
          }
        }
      });
    }

    if (window.electronAPI && window.electronAPI.onDropError) {
      window.electronAPI.onDropError((error) => {
        if (window.toastManager) {
          window.toastManager.error(error);
        }
      });
    }
  }

  setupEventListeners() {
    document.addEventListener('dragover', (e) => this.handleDragOver(e));
    document.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    document.addEventListener('drop', (e) => this.handleDrop(e));
  }

  isToolsTabActive() {
    const activeTab = document.querySelector('.tab-content.active');
    return activeTab && activeTab.id === 'tab-tools';
  }

  createDragOverlay() {
    if (this.dragOverlay) return this.dragOverlay;
    
    this.dragOverlay = document.createElement('div');
    this.dragOverlay.id = 'drag-overlay';
    this.dragOverlay.className = 'drag-overlay';
    
    const container = document.createElement('div');
    container.className = 'drag-overlay-container';
    
    const icon = document.createElement('div');
    icon.className = 'drag-overlay-icon';
    icon.innerHTML = '<i class="bi bi-cloud-upload"></i>';
    
    const text = document.createElement('div');
    text.className = 'drag-overlay-text';
    text.textContent = 'Drop mod here';
    
    const subtitle = document.createElement('div');
    subtitle.className = 'drag-overlay-subtitle';
    subtitle.textContent = 'Supports: ZIP, RAR, 7Z, folders';
    
    container.appendChild(icon);
    container.appendChild(text);
    container.appendChild(subtitle);
    this.dragOverlay.appendChild(container);
    document.body.appendChild(this.dragOverlay);
    
    return this.dragOverlay;
  }

  showDragOverlay() {
    const overlay = this.createDragOverlay();
    overlay.style.display = 'flex';
    
    if (this.dragAnimation) {
      this.dragAnimation.kill();
    }
    
    this.dragAnimation = gsap.timeline();
    this.dragAnimation.to(overlay, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out'
    });
    
    this.dragAnimation.to(overlay, {
      boxShadow: '0 0 30px rgba(74, 158, 255, 0.6)',
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut'
    }, 0);
    
    const iconContainer = overlay.querySelector('.drag-overlay-icon');
    const iconElement = iconContainer ? iconContainer.querySelector('i') : null;
    const text = overlay.querySelector('.drag-overlay-text');
    const subtitle = overlay.querySelector('.drag-overlay-subtitle');
    
    if (iconContainer && iconElement) {
      this.dragAnimation.to(iconContainer, {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.4,
        ease: 'back.out(1.7)'
      }, 0.1);
      
      this.dragAnimation.to(iconElement, {
        y: -10,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
      }, 0.5);
    }
    
    if (text) {
      this.dragAnimation.to(text, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, 0.2);
    }
    
    if (subtitle) {
      this.dragAnimation.to(subtitle, {
        opacity: 0.8,
        y: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, 0.3);
    }
  }

  hideDragOverlay() {
    if (!this.dragOverlay) return;
    
    if (this.dragAnimation) {
      this.dragAnimation.kill();
    }
    
    this.dragAnimation = gsap.timeline({
      onComplete: () => {
        if (this.dragOverlay) {
          this.dragOverlay.style.display = 'none';
        }
      }
    });
    
    this.dragAnimation.to(this.dragOverlay, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in'
    });
  }

  handleDragOver(e) {
    if (!this.isToolsTabActive()) {
      return;
    }
    
    // Allow Electron's drop-files event to work by not preventing default
    // We still need to prevent default to show the overlay, but we'll do it conditionally
    e.preventDefault();
    e.stopPropagation();
    
    if (!this.isDragging) {
      this.isDragging = true;
      this.showDragOverlay();
    }
  }

  handleDragLeave(e) {
    if (!this.isToolsTabActive()) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.clientX === 0 && e.clientY === 0) {
      this.isDragging = false;
      this.hideDragOverlay();
    }
  }

  async handleDrop(e) {
    if (!this.isToolsTabActive()) {
      console.log('Drop ignored - Tools tab not active');
      return;
    }
    
    console.log('Browser drop event triggered');
    
    // Don't prevent default immediately - let Electron's drop-files event fire first
    // We'll use a small delay to allow Electron event to process
    this.isDragging = false;
    this.hideDragOverlay();
    
    // Wait a bit to see if Electron's drop-files event handles it
    // If not, we'll try to handle it from the browser event
    setTimeout(async () => {
      // Check if files were already processed by Electron event
      // If not, try to process from browser event
      const files = Array.from(e.dataTransfer.files);
      
      if (files.length === 0) {
        console.log('No files in drop event');
        return;
      }
      
      // Prevent default to stop browser from opening files
      e.preventDefault();
      e.stopPropagation();
      
      // In Electron, File objects from dataTransfer might have a path property
      // Try to extract paths
      const filePaths = [];
      
      for (const file of files) {
        // Check if file has path (Electron extension)
        if (file.path) {
          filePaths.push(file.path);
          console.log('Found file path:', file.path);
        } else {
          console.warn('File path not available for:', file.name, 'File object:', file);
        }
      }
      
      // If we have file paths, install them
      if (filePaths.length > 0 && window.electronAPI && window.electronAPI.installModFromPath) {
        try {
          const modsPath = await window.electronAPI.store.get('modsPath');
          if (!modsPath) {
            if (window.toastManager) {
              window.toastManager.error('Mods folder not configured. Please set it in Settings.');
            }
            return;
          }
          
          if (window.toastManager) {
            window.toastManager.info(`Installing ${filePaths.length} file(s)...`);
          }
          
          for (const filePath of filePaths) {
            try {
              console.log('Installing mod from path:', filePath);
              const result = await window.electronAPI.installModFromPath(filePath, modsPath);
              if (result && result.success) {
                if (window.toastManager) {
                  window.toastManager.success(`Mod "${result.modName}" installed successfully!`);
                }
                if (window.settingsManager) {
                  await window.settingsManager.refreshModsList();
                }
              } else {
                if (window.toastManager) {
                  window.toastManager.error(`Installation error: ${result?.error || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error('Error installing mod:', error);
              if (window.toastManager) {
                window.toastManager.error(`Error installing mod: ${error.message}`);
              }
            }
          }
        } catch (error) {
          console.error('Error in handleDrop:', error);
          if (window.toastManager) {
            window.toastManager.error(`Error: ${error.message}`);
          }
        }
      } else {
        console.log('No file paths available or API not available');
        console.log('Files:', files);
        console.log('electronAPI:', window.electronAPI);
      }
    }, 50);
  }
}

window.modDragDropHandler = new ModDragDropHandler();

