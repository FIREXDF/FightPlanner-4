document.querySelector(".minimize").addEventListener("click", () => {
  if (window.electronAPI) {
    window.electronAPI.minimize();
  }
});

document.querySelector(".maximize").addEventListener("click", () => {
  if (window.electronAPI) {
    window.electronAPI.maximize();
  }
});

document.querySelector(".close").addEventListener("click", () => {
  if (window.electronAPI) {
    window.electronAPI.close();
  }
});

let currentTimeline = null;

async function switchTab(tabName) {
  if (currentTimeline) {
    currentTimeline.kill();
  }

  const currentTab = document.querySelector(".tab-content.active");

  const selectedTab = document.getElementById(`tab-${tabName}`);

  if (currentTab === selectedTab) return;

  const noAnimations = document.body.classList.contains("no-animations");

  if (noAnimations) {
    if (window.tabLoader) {
      await window.tabLoader.loadTabContent(tabName);
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

    document.querySelectorAll(".tab-content").forEach((tab) => {
      tab.classList.remove("active");
      tab.style.cssText = "display: none;";
    });

    if (selectedTab) {
      selectedTab.classList.add("active");

      selectedTab.style.cssText =
        "display: flex; opacity: 1; transform: none; z-index: auto;";
    }

    document.querySelectorAll(".sidebar-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    console.log(`Tab switched to ${tabName} (no animations)`);
    return;
  }

  if (window.tabLoader) {
    window.tabLoader.loadTabContent(tabName);
  }

  document.querySelectorAll(".tab-content").forEach((tab) => {
    if (tab !== selectedTab && tab !== currentTab) {
      gsap.set(tab, {
        display: "none",
        zIndex: -1,
      });
    }
  });

  if (selectedTab) {
    selectedTab.classList.add("active");
    selectedTab.style.display = "flex";
    gsap.set(selectedTab, {
      x: 50,
      opacity: 0,
      zIndex: 2,
      scale: 0.95,
      boxShadow: "0 0 0 rgba(0,0,0,0)",
    });
  }

  if (currentTab) {
    gsap.set(currentTab, { zIndex: 1 });
  }

  currentTimeline = gsap.timeline();

  if (currentTab) {
    currentTimeline.to(
      currentTab,
      {
        x: -50,
        opacity: 0,
        scale: 0.95,
        duration: 0.3,
        ease: "power3.inOut",
      },
      0
    );
  }

  if (selectedTab) {
    currentTimeline.to(
      selectedTab,
      {
        x: 0,
        opacity: 1,
        scale: 1,
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        duration: 0.4,
        ease: "power3.out",
      },
      0
    );
  }

  if (selectedTab) {
    currentTimeline.to(
      selectedTab,
      {
        boxShadow: "0 0 0 rgba(0,0,0,0)",
        duration: 0.2,
        ease: "power2.inOut",
        onComplete: () => {
          if (selectedTab) {
            gsap.set(selectedTab, {
              clearProps: "x,opacity,scale,boxShadow,zIndex",
            });
          }
        },
      },
      "+=0.1"
    );
  }

  if (currentTab) {
    currentTimeline.call(
      () => {
        currentTab.classList.remove("active");
        gsap.set(currentTab, {
          display: "none",
          clearProps: "x,opacity,scale,boxShadow",
          zIndex: -1,
        });
      },
      null,
      0.3
    );
  }

  document.querySelectorAll(".sidebar-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add("active");
  }

  console.log(`Switched to tab: ${tabName}`);

  if (window.statusBarManager) {
    window.statusBarManager.updateStatus(tabName);
  }
}

const sidebarButtons = document.querySelectorAll(".sidebar-btn");
sidebarButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.getAttribute("data-tab");
    if (tabName) {
      switchTab(tabName);
    }
  });
});

const actionButtons = document.querySelectorAll(".action-btn");
actionButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    console.log("Action button clicked:", btn.title);
  });
});

window.addEventListener("DOMContentLoaded", () => {
  if (window.tabLoader) {
    window.tabLoader.initializeTabs();
  }

  setTimeout(() => {
    const activeTab = document.querySelector(".tab-content.active");
    if (activeTab) {
      const tabId = activeTab.id.replace("tab-", "");
      if (window.statusBarManager && tabId) {
        window.statusBarManager.updateStatus(tabId);
      }
    } else {
      if (window.statusBarManager) {
        window.statusBarManager.updateStatus("tools");
      }
    }
  }, 100);
});

document.addEventListener("keydown", async (e) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (isCtrlOrCmd && e.altKey && (e.key === "r" || e.key === "R")) {
    e.preventDefault();
    try {
      if (
        window.electronAPI &&
        window.electronAPI.store &&
        window.electronAPI.store.clear
      ) {
        await window.electronAPI.store.clear();
        if (window.toastManager) {
          window.toastManager.success("Electron Store reset");
        }
      }
    } catch (err) {
      console.error("Failed to reset store:", err);
      if (window.toastManager) {
        window.toastManager.error("Failed to reset store");
      }
    }
  }
});
