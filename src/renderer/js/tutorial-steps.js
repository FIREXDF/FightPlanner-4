let steps = [
  {
    icon: "bi-stars",
    title: "Welcome to FightPlanner",
    description: "Your all-in-one mod manager for Super Smash Bros Ultimate",
    content: `
<div style="text-align: center;">
    <h3 style="color: #fff; margin-bottom: 20px; font-size: 24px; font-weight: 600;">Let's get you started</h3>
    <p style="margin-bottom: 32px; color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6;">This quick tutorial will help you set up FightPlanner 4 in just a few steps.</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: left;">
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05); transition: transform 0.2s ease;">
            <i class="bi bi-collection-play" style="font-size: 24px; color: #7a9bff; margin-bottom: 12px; display: block;"></i>
            <strong style="display: block; color: #fff; margin-bottom: 4px;">Manage Mods</strong>
            <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Organize effortlessly</span>
        </div>
        
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <i class="bi bi-cloud-download" style="font-size: 24px; color: #7a9bff; margin-bottom: 12px; display: block;"></i>
            <strong style="display: block; color: #fff; margin-bottom: 4px;">1-Click Install</strong>
            <span style="color: rgba(255,255,255,0.5); font-size: 13px;">From GameBanana</span>
        </div>
        
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <i class="bi bi-people" style="font-size: 24px; color: #7a9bff; margin-bottom: 12px; display: block;"></i>
            <strong style="display: block; color: #fff; margin-bottom: 4px;">Characters</strong>
            <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Sorted by fighter</span>
        </div>
        
        <div style="padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <i class="bi bi-plugin" style="font-size: 24px; color: #7a9bff; margin-bottom: 12px; display: block;"></i>
            <strong style="display: block; color: #fff; margin-bottom: 4px;">Plugins</strong>
            <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Handle .nro files</span>
        </div>
    </div>
</div>
`,
  },
  {
    icon: "bi-folder2-open",
    title: "Configure Your Paths",
    description: "Point FightPlanner to your mods folder",
    content: `
<div style="text-align: center;">
    <h3 style="color: #fff; margin-bottom: 24px; font-size: 22px;">Where are your mods?</h3>
    <p style="margin-bottom: 32px; color: rgba(255,255,255,0.7);">Select the folder where you keep your Ultimate mods (sd:/ultimate/mods).</p>
    
    <div style="display: flex; flex-direction: column; gap: 16px; text-align: left;">
        <div style="background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 24px; height: 24px; background: rgba(122, 155, 255, 0.2); color: #7a9bff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">1</div>
                    <strong style="color: #fff;">Mods Path</strong>
                </div>
                <button id="select-mods-path-btn" class="tutorial-btn-small" style="background: rgba(122, 155, 255, 0.2); color: #7a9bff; border: 1px solid rgba(122, 155, 255, 0.3); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;">
                    Browse...
                </button>
            </div>
            <div id="mods-path-display" style="background: rgba(0, 0, 0, 0.3); padding: 10px 14px; border-radius: 8px; color: #a0a0a0; font-family: monospace; font-size: 13px; display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap;">
                <i class="bi bi-folder" style="opacity: 0.5;"></i> <span class="path-text" style="text-overflow: ellipsis; overflow: hidden;">Not configured</span>
            </div>
        </div>
    </div>
    
    <div style="margin-top: 24px; padding: 12px 16px; background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.2); border-radius: 8px; display: flex; gap: 12px; align-items: start; text-align: left;">
        <i class="bi bi-info-circle-fill" style="color: #ffc107; margin-top: 2px;"></i>
        <span style="font-size: 13px; color: rgba(255, 255, 255, 0.7);">You can change this later in Settings.</span>
    </div>
</div>
`,
    onRender: async () => {
        const btn = document.getElementById("select-mods-path-btn");
        const display = document.querySelector("#mods-path-display .path-text");
        const nextBtn = document.getElementById("next-btn");
        
        // Initially disable Next button until validated
        if (nextBtn) {
            nextBtn.style.opacity = "0.5";
            nextBtn.style.pointerEvents = "none";
            nextBtn.style.cursor = "not-allowed";
        }
        
        if (!window.tutorialAPI || !window.tutorialAPI.getSetting) return;

        // Load existing setting
        try {
            const currentPath = await window.tutorialAPI.getSetting("modsPath");
            if (currentPath) {
                display.textContent = currentPath;
                display.style.color = "#fff";
                // Add success indicator
                const icon = document.querySelector("#mods-path-display i");
                if (icon) {
                    icon.className = "bi bi-check-circle-fill";
                    icon.style.color = "#4caf50";
                    icon.style.opacity = "1";
                }
                // Enable Next button since we have a path
                if (nextBtn) {
                    nextBtn.style.opacity = "1";
                    nextBtn.style.pointerEvents = "auto";
                    nextBtn.style.cursor = "pointer";
                }
            }
        } catch (e) {
            console.error("Error loading setting:", e);
        }

        // Handle click
        if (btn) {
            btn.addEventListener("click", async () => {
                try {
                    const path = await window.tutorialAPI.selectFolder();
                    if (path) {
                        // Save setting
                        await window.tutorialAPI.saveSetting("modsPath", path);
                        
                        // Update UI
                        display.textContent = path;
                        display.style.color = "#fff";
                        
                        const icon = document.querySelector("#mods-path-display i");
                        if (icon) {
                            icon.className = "bi bi-check-circle-fill";
                            icon.style.color = "#4caf50";
                            icon.style.opacity = "1";
                        }
                        
                        btn.innerHTML = '<i class="bi bi-check"></i> Selected';
                        btn.style.background = "rgba(76, 175, 80, 0.2)";
                        btn.style.color = "#4caf50";
                        btn.style.borderColor = "rgba(76, 175, 80, 0.3)";

                        // Enable Next button
                        if (nextBtn) {
                            nextBtn.style.opacity = "1";
                            nextBtn.style.pointerEvents = "auto";
                            nextBtn.style.cursor = "pointer";
                        }
                    }
                } catch (error) {
                    console.error("Error selecting folder:", error);
                }
            });
            
            // Add hover effect via JS since inline styles are static
            btn.addEventListener("mouseenter", () => {
                if (!btn.innerHTML.includes("Selected")) {
                    btn.style.background = "rgba(122, 155, 255, 0.3)";
                }
            });
            btn.addEventListener("mouseleave", () => {
                if (!btn.innerHTML.includes("Selected")) {
                    btn.style.background = "rgba(122, 155, 255, 0.2)";
                }
            });
        }
    }
  },
  {
    icon: "bi-grid-3x3-gap",
    title: "Manage Your Mods",
    description: "Enable, disable, and organize your mods",
    content: `
<div style="text-align: center;">
    <h3 style="color: #fff; margin-bottom: 24px; font-size: 22px;">Everything at your fingertips</h3>
    
    <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
        
        <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.2s;">
            <div style="width: 40px; height: 40px; background: rgba(76, 175, 80, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-toggle-on" style="font-size: 20px; color: #4caf50;"></i>
            </div>
            <div>
                <strong style="color: #fff; display: block; margin-bottom: 2px; font-size: 15px;">Toggle Mods</strong>
                <p style="margin: 0; color: rgba(255,255,255,0.5); font-size: 13px;">Click the checkbox to enable/disable</p>
            </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="width: 40px; height: 40px; background: rgba(122, 155, 255, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-search" style="font-size: 18px; color: #7a9bff;"></i>
            </div>
            <div>
                <strong style="color: #fff; display: block; margin-bottom: 2px; font-size: 15px;">Search & Filter</strong>
                <p style="margin: 0; color: rgba(255,255,255,0.5); font-size: 13px;">Find mods by name or category</p>
            </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="width: 40px; height: 40px; background: rgba(255, 193, 7, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-three-dots" style="font-size: 20px; color: #ffc107;"></i>
            </div>
            <div>
                <strong style="color: #fff; display: block; margin-bottom: 2px; font-size: 15px;">Context Menu</strong>
                <p style="margin: 0; color: rgba(255,255,255,0.5); font-size: 13px;">Right-click to rename, delete, etc.</p>
            </div>
        </div>

    </div>
</div>
`,
  },
  {
    icon: "bi-download",
    title: "GameBanana Integration",
    description: "Install mods directly from your browser",
    content: `
<div style="text-align: center;">
    <h3 style="color: #fff; margin-bottom: 20px; font-size: 22px;">One-click install</h3>
    <p style="margin-bottom: 28px; color: rgba(255,255,255,0.7);">Simply click <strong style="color: #fff;">"Install with FightPlanner"</strong> on GameBanana.</p>
    
    <div style="background: rgba(20, 20, 20, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; position: relative; overflow: hidden;">
        
        <!-- Fake GameBanana Button -->
        <div style="background: #181a1e; border-radius: 4px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 10px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1px solid #2f3136;">
            <img src="../assets/images/logo.png" style="width: 32px; height: 32px; filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.2));">
            <div style="display: flex; flex-direction: column; text-align: left; gap: 0px;">
                <span style="color: #ffd700; font-weight: 800; font-size: 14px; line-height: 1; text-shadow: 0 0 15px rgba(255, 215, 0, 0.4); font-family: 'Segoe UI', sans-serif;">FightPlanner</span>
                <span style="color: #fff; font-weight: 800; font-size: 11px; line-height: 1.2; text-shadow: 0 0 10px rgba(255,255,255,0.5); font-family: 'Segoe UI', sans-serif;">1-CLICK INSTALL</span>
            </div>
        </div>

        <div style="position: relative; height: 40px;">
            <div style="position: absolute; left: 50%; top: 0; transform: translateX(-50%); height: 30px; width: 2px; background: linear-gradient(to bottom, rgba(255,255,255,0.2), #7a9bff);"></div>
            <div style="position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); color: #7a9bff; font-size: 18px;">↓</div>
        </div>

        <div style="margin-top: 10px; background: rgba(122, 155, 255, 0.1); border: 1px solid rgba(122, 155, 255, 0.2); padding: 16px; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #7a9bff; font-weight: 600; margin-bottom: 6px;">
                <i class="bi bi-check-circle-fill"></i> Automatic
            </div>
            <span style="color: rgba(255,255,255,0.6); font-size: 13px;">Downloads • Extracts • Installs</span>
        </div>
    </div>
    
    <p style="margin-top: 24px; font-size: 13px; color: rgba(255,255,255,0.5);">
        Info.toml and previews are handled for you automatically.
    </p>
</div>
`,
  },
  {
    icon: "bi-check-circle-fill",
    title: "You're All Set",
    description: "Start modding and have fun",
    content: `
<div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: rgba(76, 175, 80, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 0 30px rgba(76, 175, 80, 0.2);">
        <i class="bi bi-check-lg" style="font-size: 40px; color: #4caf50;"></i>
    </div>
    
    <h3 style="color: #fff; margin-bottom: 16px; font-size: 24px;">Ready to go!</h3>
    <p style="margin-bottom: 32px; color: rgba(255,255,255,0.7); max-width: 400px; margin-left: auto; margin-right: auto;">
        FightPlanner is configured and ready. Start downloading mods or explore the settings to customize your experience.
    </p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 460px; margin: 0 auto;">
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 12px; text-align: left;">
            <strong style="color: #fff; display: block; margin-bottom: 4px;">Characters</strong>
            <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Browse by fighter</span>
        </div>
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 12px; text-align: left;">
            <strong style="color: #fff; display: block; margin-bottom: 4px;">Downloads</strong>
            <span style="color: rgba(255,255,255,0.5); font-size: 13px;">Track progress</span>
        </div>
    </div>
</div>
`,
  },
];

let currentStep = 0;

async function initializeTutorial() {
  console.log("🔍 Initializing tutorial...");
  console.log("🔍 window.tutorialAPI:", window.tutorialAPI);

  if (window.tutorialAPI && window.tutorialAPI.getMigrationStatus) {
    try {
      console.log("🔍 Calling getMigrationStatus...");
      const migrationStatus = await window.tutorialAPI.getMigrationStatus();
      console.log("🔍 Migration status received:", migrationStatus);

      if (migrationStatus.success && migrationStatus.completed) {
        console.log("✅ Migration detected! Adding migration step...");

        const migrationStep = {
          icon: "bi-arrow-repeat",
          title: "Settings Migrated",
          description: "Your FightPlanner 3 settings have been imported",
          content: `
<div style="text-align: center;">
    <div style="width: 64px; height: 64px; background: rgba(76, 175, 80, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
        <i class="bi bi-database-check" style="font-size: 32px; color: #4caf50;"></i>
    </div>

    <h3 style="color: #fff; margin-bottom: 12px; font-size: 22px;">Welcome Back!</h3>
    <p style="margin-bottom: 24px; color: rgba(255,255,255,0.7);">We found your <strong style="color: #fff;">FightPlanner 3</strong> settings and imported them automatically.</p>
    
    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; max-width: 400px; margin: 0 auto;">
        <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="bi bi-check-circle-fill" style="color: #4caf50;"></i>
                <span style="color: #e0e0e0;">Mods folder path</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="bi bi-check-circle-fill" style="color: #4caf50;"></i>
                <span style="color: #e0e0e0;">Plugins folder path</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="bi bi-check-circle-fill" style="color: #4caf50;"></i>
                <span style="color: #e0e0e0;">Emulator preferences</span>
            </div>
        </div>
    </div>
    
    <p style="margin-top: 24px; color: rgba(255,255,255,0.5); font-size: 13px;">
        You can double-check these in Settings anytime.
    </p>
</div>
`,
        };

        steps.splice(1, 0, migrationStep);
        console.log("✓ Migration step added to tutorial");
      } else {
        console.log("ℹ️ No migration detected or already processed");
        console.log("   - success:", migrationStatus.success);
        console.log("   - completed:", migrationStatus.completed);
      }
    } catch (error) {
      console.error("❌ Error checking migration status:", error);
    }
  } else {
    console.log("⚠️ tutorialAPI or getMigrationStatus not available");
  }

  console.log("📊 Total tutorial steps:", steps.length);

  startAnimation();
}

function startAnimation() {
  const lottieContainer = document.getElementById("lottie-animation");
  const welcomeText = document.getElementById("welcome-text");
  const screenshotPreview = document.getElementById("screenshot-preview");
  const tutorialContainer = document.getElementById("tutorial-container");
  const tutorialWindow = document.querySelector(".tutorial-window");

  const animation = lottie.loadAnimation({
    container: lottieContainer,
    renderer: "svg",
    loop: false,
    autoplay: false,
    path: "../assets/images/animation.json",
  });

  setTimeout(() => {
    animation.play();
  }, 200);

  setTimeout(() => {
    tutorialWindow.classList.add("white-bg");
  }, 2330 + 200);

  setTimeout(() => {
    lottieContainer.style.opacity = "0";
  }, 3200);

  setTimeout(() => {
    welcomeText.classList.add("show");
  }, 3500);

  setTimeout(() => {
    screenshotPreview.classList.add("show");
  }, 4500);

  setTimeout(() => {
    welcomeText.classList.add("move-up");
    screenshotPreview.classList.add("slide-up");
    screenshotPreview.classList.add("clear");
  }, 5000);

  setTimeout(() => {
    welcomeText.style.opacity = "0";
    screenshotPreview.style.opacity = "0";
    lottieContainer.style.display = "none";
  }, 8000);

  setTimeout(() => {
    welcomeText.style.display = "none";
    screenshotPreview.style.display = "none";
    tutorialContainer.style.display = "flex";

    renderProgressDots();
    renderStep(0);

    setTimeout(() => {
      tutorialContainer.classList.add("show");
    }, 50);
  }, 9000);
}

function renderProgressDots() {
  const container = document.getElementById("progress-dots");
  container.innerHTML = steps
    .map(
      (_, index) => `
<div class="tutorial-progress-dot ${
        index === 0 ? "active" : ""
      }" data-step="${index}"></div>
`
    )
    .join("");

  document.querySelectorAll(".tutorial-progress-dot").forEach((dot) => {
    dot.addEventListener("click", (e) => {
      const step = parseInt(e.target.dataset.step);
      goToStep(step);
    });
  });
}

function renderStep(index) {
  const step = steps[index];
  const contentDiv = document.getElementById("tutorial-content");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  contentDiv.style.opacity = "0";
  contentDiv.style.transform = "translateY(10px)";

  setTimeout(() => {
    contentDiv.innerHTML = `
<div class="tutorial-step">
<div class="tutorial-step-header">
<div class="tutorial-step-icon">
<i class="bi ${step.icon}"></i>
</div>
<div class="tutorial-step-title">
<h2>${step.title}</h2>
<p>${step.description}</p>
</div>
</div>
<div class="tutorial-step-content">
${step.content}
</div>
</div>
`;

    contentDiv.style.opacity = "1";
    contentDiv.style.transform = "translateY(0)";
    
    if (step.onRender) {
        step.onRender();
    }
  }, 200);

  document.querySelectorAll(".tutorial-progress-dot").forEach((dot, i) => {
    if (i === index) {
      dot.classList.add("active");
    } else if (i < index) {
      dot.classList.add("completed");
      dot.classList.remove("active");
    } else {
      dot.classList.remove("active", "completed");
    }
  });

  prevBtn.style.display = index > 0 ? "flex" : "none";

  if (index === steps.length - 1) {
    nextBtn.innerHTML = 'Get Started! <i class="bi bi-check-lg"></i>';
  } else {
    nextBtn.innerHTML = 'Next <i class="bi bi-arrow-right"></i>';
  }
}

function goToStep(index) {
  if (index >= 0 && index < steps.length) {
    currentStep = index;
    renderStep(currentStep);
  }
}

function nextStep() {
  if (currentStep < steps.length - 1) {
    currentStep++;
    renderStep(currentStep);
  } else {
    closeTutorial();
  }
}

function previousStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep(currentStep);
  }
}

function closeTutorial() {
  console.log("Closing tutorial...");
  console.log("window.tutorialAPI:", window.tutorialAPI);

  if (window.tutorialAPI && window.tutorialAPI.closeTutorial) {
    console.log("Calling tutorialAPI.closeTutorial()");
    try {
      window.tutorialAPI.closeTutorial();
      console.log("✓ Close event sent");
    } catch (error) {
      console.error("Error calling closeTutorial:", error);
    }
  } else {
    console.error("tutorialAPI not available!");
    console.error("Available window properties:", Object.keys(window));

    if (window.close) {
      console.log("Trying window.close() as fallback");
      window.close();
    }
  }
}

function skipTutorial() {
  if (confirm("Are you sure you want to skip the tutorial?")) {
    closeTutorial();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Tutorial DOM loaded");
  console.log("tutorialAPI available:", !!window.tutorialAPI);

  setTimeout(() => {
    initializeTutorial();
  }, 100);

  const closeBtn = document.getElementById("close-btn");
  const skipBtn = document.getElementById("skip-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      console.log("Close button clicked");
      closeTutorial();
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      console.log("Skip button clicked");
      skipTutorial();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      console.log("Previous button clicked");
      previousStep();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      console.log("Next button clicked");
      nextStep();
    });
  }
});
