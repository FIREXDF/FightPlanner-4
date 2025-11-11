let steps = [
  {
    icon: "bi-grid-3x3-gap-fill",
    title: "Welcome to FightPlanner",
    description: "Your all-in-one mod manager for Super Smash Bros Ultimate",
    content: `
<div style="text-align: center;">
<h3 style="color: #fff; margin-bottom: 16px; font-size: 22px;">Let's get you started</h3>
<p style="margin-bottom: 24px; color: #9ca3af;">This quick tutorial will help you set up FightPlanner in just a few steps.</p>
<div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(122, 155, 255, 0.06); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.15);">
<div style="width: 4px; height: 4px; background: #7a9bff; border-radius: 50%;"></div>
<span>Manage your mods easily</span>
</div>
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(122, 155, 255, 0.06); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.15);">
<div style="width: 4px; height: 4px; background: #7a9bff; border-radius: 50%;"></div>
<span>Install directly from GameBanana</span>
</div>
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(122, 155, 255, 0.06); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.15);">
<div style="width: 4px; height: 4px; background: #7a9bff; border-radius: 50%;"></div>
<span>Organize by characters</span>
</div>
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(122, 155, 255, 0.06); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.15);">
<div style="width: 4px; height: 4px; background: #7a9bff; border-radius: 50%;"></div>
<span>Handle plugins seamlessly</span>
</div>
</div>
</div>
`,
  },
  {
    icon: "bi-folder2-open",
    title: "Configure Your Paths",
    description: "Point FightPlanner to your mods and plugins folders",
    content: `
<div style="text-align: center;">
<h3 style="color: #fff; margin-bottom: 16px; font-size: 22px;">Set up your folders</h3>
<p style="margin-bottom: 24px; color: #9ca3af;">Go to <strong style="color: #fff;">Settings</strong> and configure:</p>
<div style="display: flex; flex-direction: column; gap: 14px; text-align: left;">
<div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(122, 155, 255, 0.2); border-radius: 8px; padding: 14px;">
<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
<div style="width: 20px; height: 20px; background: #7a9bff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;">1</div>
<strong style="color: #fff;">Mods Path</strong>
</div>
<code style="background: rgba(122, 155, 255, 0.15); padding: 8px 12px; border-radius: 6px; color: #7a9bff; display: block; margin-top: 8px;">sd:/ultimate/mods</code>
</div>
<div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(122, 155, 255, 0.2); border-radius: 8px; padding: 14px;">
<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
<div style="width: 20px; height: 20px; background: #7a9bff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;">2</div>
<strong style="color: #fff;">Plugins Path</strong>
</div>
<code style="background: rgba(122, 155, 255, 0.15); padding: 8px 12px; border-radius: 6px; color: #7a9bff; display: block; margin-top: 8px; font-size: 11px;">sd:/ultimate/contents/01006A800016E000/romfs/skyline/plugins</code>
</div>
</div>
<p style="margin-top: 20px; padding: 12px 16px; background: rgba(255, 193, 7, 0.08); border-left: 3px solid #ffc107; border-radius: 6px; font-size: 13px; color: #9ca3af;">These paths are on your SD card or emulator folder</p>
</div>
`,
  },
  {
    icon: "bi-grid-3x3-gap",
    title: "Manage Your Mods",
    description: "Enable, disable, and organize your mods",
    content: `
<div style="text-align: center;">
<h3 style="color: #fff; margin-bottom: 24px; font-size: 22px;">Easy mod management</h3>
<div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
<div style="display: flex; align-items: flex-start; gap: 14px; padding: 14px; background: rgba(122, 155, 255, 0.05); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.12);">
<i class="bi bi-toggle-on" style="font-size: 22px; color: #7a9bff; margin-top: 2px;"></i>
<div>
<strong style="color: #fff; display: block; margin-bottom: 4px; font-size: 15px;">Toggle mods</strong>
<p style="margin: 0; color: #9ca3af; font-size: 13px;">Click the toggle to enable or disable</p>
</div>
</div>
<div style="display: flex; align-items: flex-start; gap: 14px; padding: 14px; background: rgba(122, 155, 255, 0.05); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.12);">
<i class="bi bi-search" style="font-size: 22px; color: #7a9bff; margin-top: 2px;"></i>
<div>
<strong style="color: #fff; display: block; margin-bottom: 4px; font-size: 15px;">Search & Filter</strong>
<p style="margin: 0; color: #9ca3af; font-size: 13px;">Find mods by name or category</p>
</div>
</div>
<div style="display: flex; align-items: flex-start; gap: 14px; padding: 14px; background: rgba(122, 155, 255, 0.05); border-radius: 8px; border: 1px solid rgba(122, 155, 255, 0.12);">
<i class="bi bi-three-dots" style="font-size: 22px; color: #7a9bff; margin-top: 2px;"></i>
<div>
<strong style="color: #fff; display: block; margin-bottom: 4px; font-size: 15px;">Right-click menu</strong>
<p style="margin: 0; color: #9ca3af; font-size: 13px;">Rename, delete, or open folder</p>
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
<h3 style="color: #fff; margin-bottom: 16px; font-size: 22px;">One-click install</h3>
<p style="margin-bottom: 24px; color: #9ca3af;">Click on <strong style="color: #fff;">"Install with FightPlanner"</strong> links on GameBanana:</p>
<div style="background: rgba(122, 155, 255, 0.05); border: 1px solid rgba(122, 155, 255, 0.15); border-radius: 8px; padding: 20px;">
<div style="background: rgba(0, 0, 0, 0.4); padding: 10px 14px; border-radius: 6px; margin-bottom: 10px;">
<code style="color: #7a9bff; font-size: 12px; word-break: break-all;">fightplanner:https://gamebanana.com/mmdl/...</code>
</div>
<div style="font-size: 20px; color: #7a9bff; margin: 8px 0;">↓</div>
<div style="background: rgba(76, 175, 80, 0.12); padding: 12px 16px; border-radius: 6px; color: #4caf50; font-weight: 600; border: 1px solid rgba(76, 175, 80, 0.25);">
Mod downloads, extracts, and installs automatically
</div>
</div>
<p style="margin-top: 20px; padding: 12px 16px; background: rgba(255, 193, 7, 0.08); border-left: 3px solid #ffc107; border-radius: 6px; font-size: 13px; color: #9ca3af;">Preview and info.toml are downloaded automatically</p>
</div>
`,
  },
  {
    icon: "bi-check-circle-fill",
    title: "You're All Set",
    description: "Start modding and have fun",
    content: `
<div style="text-align: center;">
<h3 style="color: #fff; margin-bottom: 16px; font-size: 22px;">Ready to go</h3>
<p style="margin-bottom: 28px; color: #9ca3af;">You can now start managing your mods like a pro</p>
<div style="background: rgba(122, 155, 255, 0.06); border: 1px solid rgba(122, 155, 255, 0.15); border-radius: 8px; padding: 18px; text-align: left;">
<h4 style="color: #7a9bff; margin-bottom: 14px; font-size: 15px; font-weight: 600;">Quick tips</h4>
<ul style="margin: 0; padding-left: 20px; list-style: none;">
<li style="color: #d1d5db; line-height: 1.7; margin-bottom: 8px; position: relative; padding-left: 8px;">
<span style="position: absolute; left: -12px; color: #7a9bff;">•</span>
<strong style="color: #fff;">Characters tab:</strong> See mods organized by fighter
</li>
<li style="color: #d1d5db; line-height: 1.7; margin-bottom: 8px; position: relative; padding-left: 8px;">
<span style="position: absolute; left: -12px; color: #7a9bff;">•</span>
<strong style="color: #fff;">Downloads tab:</strong> Track your installations
</li>
<li style="color: #d1d5db; line-height: 1.7; position: relative; padding-left: 8px;">
<span style="position: absolute; left: -12px; color: #7a9bff;">•</span>
<strong style="color: #fff;">Settings:</strong> Customize animations and preferences
</li>
</ul>
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
<h3 style="color: #fff; margin-bottom: 16px; font-size: 22px;">Good news!</h3>
<p style="margin-bottom: 24px; color: #9ca3af;">We found your <strong style="color: #fff;">FightPlanner 3</strong> settings and imported them automatically.</p>
<div style="background: rgba(76, 175, 80, 0.12); border: 1px solid rgba(76, 175, 80, 0.25); border-radius: 8px; padding: 18px; margin-bottom: 24px;">
<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
<i class="bi bi-check-circle-fill" style="color: #4caf50; font-size: 24px;"></i>
<h4 style="color: #4caf50; margin: 0; font-size: 16px; font-weight: 600;">Settings imported</h4>
</div>
<div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">
<i class="bi bi-folder-fill" style="color: #7a9bff; font-size: 16px;"></i>
<span style="color: #d1d5db;">Mods folder path</span>
</div>
<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">
<i class="bi bi-plugin" style="color: #7a9bff; font-size: 16px;"></i>
<span style="color: #d1d5db;">Plugins folder path</span>
</div>
<div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">
<i class="bi bi-gear-fill" style="color: #7a9bff; font-size: 16px;"></i>
<span style="color: #d1d5db;">Emulator preferences</span>
</div>
</div>
</div>
<p style="color: #9ca3af; font-size: 13px;">You can verify these settings in the <strong style="color: #fff;">Settings</strong> tab after the tutorial.</p>
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
