// Title bar controls
document.querySelector('.minimize').addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.minimize();
    }
});

document.querySelector('.maximize').addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.maximize();
    }
});

document.querySelector('.close').addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.close();
    }
});

// Tab System with GSAP
let currentTimeline = null;

async function switchTab(tabName) {
    // Kill any ongoing animation
    if (currentTimeline) {
        currentTimeline.kill();
    }
    
    // Get current active tab
    const currentTab = document.querySelector('.tab-content.active');
    
    // Get the new tab
    const selectedTab = document.getElementById(`tab-${tabName}`);
    
    // If switching to the same tab, do nothing
    if (currentTab === selectedTab) return;
    
    // Check if animations are disabled
    const noAnimations = document.body.classList.contains('no-animations');
    
    if (noAnimations) {
        // Load tab content first (wait for it)
        if (window.tabLoader) {
            await window.tabLoader.loadTabContent(tabName);
        }
        
        // Wait for DOM to update
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Reset all tabs first to clear any GSAP styles
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.style.cssText = 'display: none;';
        });
        
        // Show only the selected tab
        if (selectedTab) {
            selectedTab.classList.add('active');
            // Reset ALL inline styles that might have been set by GSAP
            selectedTab.style.cssText = 'display: flex; opacity: 1; transform: none; z-index: auto;';
        }
        
        // Update sidebar buttons
        document.querySelectorAll('.sidebar-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        console.log(`Tab switched to ${tabName} (no animations)`);
        return;
    }
    
    // Load tab content if not already loaded (async but don't wait for animated mode)
    if (window.tabLoader) {
        window.tabLoader.loadTabContent(tabName);
    }
    
    // Hide ALL inactive tabs first
    document.querySelectorAll('.tab-content').forEach(tab => {
        if (tab !== selectedTab && tab !== currentTab) {
            gsap.set(tab, {
                display: 'none',
                zIndex: -1
            });
        }
    });
    
    // Prepare new tab - make it visible and position it
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.style.display = 'flex';
        gsap.set(selectedTab, {
            x: 50,
            opacity: 0,
            zIndex: 2,
            scale: 0.95,
            boxShadow: '0 0 0 rgba(0,0,0,0)'
        });
    }
    
    // Set current tab z-index lower so new tab appears on top
    if (currentTab) {
        gsap.set(currentTab, { zIndex: 1 });
    }
    
    // Create timeline for smooth animations
    currentTimeline = gsap.timeline();
    
    // Animate both tabs simultaneously
    if (currentTab) {
        currentTimeline.to(currentTab, {
            x: -50,
            opacity: 0,
            scale: 0.95,
            duration: 0.3,
            ease: 'power3.inOut'
        }, 0);
    }
    
    if (selectedTab) {
        currentTimeline.to(selectedTab, {
            x: 0,
            opacity: 1,
            scale: 1,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            duration: 0.4,
            ease: 'power3.out'
        }, 0);
    }
    
    // Remove shadow after animation
    if (selectedTab) {
        currentTimeline.to(selectedTab, {
            boxShadow: '0 0 0 rgba(0,0,0,0)',
            duration: 0.2,
            ease: 'power2.inOut',
            onComplete: () => {
                // Clean up new tab after animation
                if (selectedTab) {
                    gsap.set(selectedTab, {
                        clearProps: 'x,opacity,scale,boxShadow,zIndex'
                    });
                }
            }
        }, '+=0.1');
    }
    
    // Clean up old tab immediately when animation starts
    if (currentTab) {
        currentTimeline.call(() => {
            currentTab.classList.remove('active');
            gsap.set(currentTab, {
                display: 'none',
                clearProps: 'x,opacity,scale,boxShadow',
                zIndex: -1
            });
        }, null, 0.3); // After 0.3s (when fade out is done)
    }
    
    // Update sidebar buttons immediately
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    console.log(`Switched to tab: ${tabName}`);
}

// Sidebar button functionality
const sidebarButtons = document.querySelectorAll('.sidebar-btn');
sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) {
            switchTab(tabName);
        }
    });
});

// Action buttons functionality
const actionButtons = document.querySelectorAll('.action-btn');
actionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        console.log('Action button clicked:', btn.title);
    });
});

// Initialize tabs on page load
window.addEventListener('DOMContentLoaded', () => {
    if (window.tabLoader) {
        window.tabLoader.initializeTabs();
    }
});

// Dev shortcut: Ctrl/Cmd + Alt + R -> reset electron-store
document.addEventListener('keydown', async (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd && e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        try {
            if (window.electronAPI && window.electronAPI.store && window.electronAPI.store.clear) {
                await window.electronAPI.store.clear();
                if (window.toastManager) {
                    window.toastManager.success('Electron Store reset');
                }
            }
        } catch (err) {
            console.error('Failed to reset store:', err);
            if (window.toastManager) {
                window.toastManager.error('Failed to reset store');
            }
        }
    }
});

