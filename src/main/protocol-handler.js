const { app, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const AdmZip = require("adm-zip");
const packageJson = require("../../package.json");
const sharedStore = require("./store");

const USER_AGENT = `FightPlanner/${packageJson.version} (Electron ${process.versions.electron}; Node ${process.versions.node}; ${process.platform})`;

class ProtocolHandler {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.downloadInProgress = false;
    this.activeDownloads = new Map(); // Map of downloadId -> {request, file, filePath, cancelled, paused}
  }
  static registerProtocol() {
    if (process.platform === "win32") {
      if (process.defaultApp) {
        if (process.argv.length >= 2) {
          app.setAsDefaultProtocolClient("fightplanner", process.execPath, [
            path.resolve(process.argv[1]),
          ]);
          console.log("✓ FightPlanner protocol registered (dev mode)");
        }
      } else {
        app.setAsDefaultProtocolClient("fightplanner");
        console.log("✓ FightPlanner protocol registered (production)");
      }

      this.registerProtocolInRegistry();
    } else if (process.platform === "darwin" || process.platform === "linux") {
      try {
        const before = app.isDefaultProtocolClient
          ? app.isDefaultProtocolClient("fightplanner")
          : undefined;
        console.log(
          `[protocol][${process.platform}] before registration isDefault=${before}`
        );
        if (process.defaultApp && process.argv.length >= 2) {
          const ok = app.setAsDefaultProtocolClient(
            "fightplanner",
            process.execPath,
            [path.resolve(process.argv[1])]
          );
          console.log(
            `[protocol][${process.platform}] register dev returned=${ok}`
          );
        } else {
          const ok = app.setAsDefaultProtocolClient("fightplanner");
          console.log(
            `[protocol][${process.platform}] register prod returned=${ok}`
          );
        }
        const after = app.isDefaultProtocolClient
          ? app.isDefaultProtocolClient("fightplanner")
          : undefined;
        console.log(
          `[protocol][${process.platform}] after registration isDefault=${after}`
        );
      } catch (e) {
        console.warn(
          "Protocol registration skipped (" + process.platform + "):",
          e.message
        );
      }
    }
  }
  static registerProtocolInRegistry() {
    if (process.platform !== "win32") return;

    try {
      const { exec } = require("child_process");

      let commandString;
      if (process.defaultApp) {
        const exePath = process.execPath.replace(/\\/g, "\\\\");
        const scriptPath = path.resolve(process.argv[1]).replace(/\\/g, "\\\\");
        commandString = `\\"${exePath}\\" \\"${scriptPath}\\" \\"%1\\"`;
        console.log("Registering protocol in registry (dev mode)...");
      } else {
        const exePath = process.execPath.replace(/\\/g, "\\\\");
        commandString = `\\"${exePath}\\" \\"%1\\"`;
        console.log("Registering protocol in registry (production)...");
      }

      console.log("Command string:", commandString);

      const commands = [
        `reg add "HKCU\\Software\\Classes\\fightplanner" /ve /d "URL:FightPlanner Protocol" /f`,
        `reg add "HKCU\\Software\\Classes\\fightplanner" /v "URL Protocol" /t REG_SZ /d "" /f`,
        `reg add "HKCU\\Software\\Classes\\fightplanner\\DefaultIcon" /ve /d "${process.execPath.replace(
          /\\/g,
          "\\\\"
        )},0" /f`,
        `reg add "HKCU\\Software\\Classes\\fightplanner\\shell\\open\\command" /ve /d "${commandString}" /f`,
      ];

      let commandsExecuted = 0;
      commands.forEach((cmd, index) => {
        exec(cmd, (error, stdout, stderr) => {
          commandsExecuted++;

          if (error) {
            console.error(
              `Registry command ${index + 1} failed:`,
              error.message
            );
          } else {
            console.log(
              `✓ Registry command ${index + 1} executed successfully`
            );
          }

          if (commandsExecuted === commands.length) {
            console.log("Protocol registration in registry completed!");

            exec(
              'reg query "HKCU\\Software\\Classes\\fightplanner\\shell\\open\\command"',
              (error, stdout, stderr) => {
                if (!error) {
                  console.log("✓ Protocol verified in registry:");
                  console.log(stdout);
                }
              }
            );
          }
        });
      });
    } catch (error) {
      console.error("Registry registration failed:", error);
      console.error("You may need to run the app as Administrator once.");
    }
  }
  async handleDeepLink(url) {
    console.log("[protocol] Handling deep link:", url);

    try {
      const downloadId = `dl_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const cleanUrl = url.replace("fightplanner:", "");

      const modId = this.extractModId(cleanUrl);

      const downloadUrl = this.parseGameBananaUrl(cleanUrl);

      if (!downloadUrl) {
        this.showError("Invalid URL format");
        return;
      }

      console.log("[protocol] Download URL:", downloadUrl);
      console.log("[protocol] Mod ID:", modId);

      this.sendToRenderer("mod-install-start", {
        url: downloadUrl,
        downloadId,
      });

      const filePath = await this.downloadMod(downloadUrl, downloadId);

      if (!filePath) {
        this.showError("Download failed");
        return;
      }

      console.log("Downloaded to:", filePath);

      const modName = await this.installMod(filePath, downloadId);

      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn("Failed to delete temp file:", err);
      }

      let modFolderPath = null;
      if (modId && modName) {
        const modsPath = sharedStore.get("modsPath");

        if (modsPath) {
          modFolderPath = path.join(modsPath, modName);
          await this.fetchAndSaveModMetadata(modId, modFolderPath);
        }
      }

      this.sendToRenderer("mod-install-success", {
        url: downloadUrl,
        modName: modName,
        downloadId,
        folderPath: modFolderPath,
      });
    } catch (error) {
      console.error("Error handling deep link:", error);
      this.showError(`Installation failed: ${error.message}`);
      this.sendToRenderer("mod-install-error", { error: error.message });
    }
  }
  extractModId(url) {
    try {
      const mmdlMatch = url.match(/mmdl\/\d+,Mod,(\d+)/);
      if (mmdlMatch && mmdlMatch[1]) {
        return mmdlMatch[1];
      }
      return null;
    } catch (error) {
      console.error("Error extracting mod ID:", error);
      return null;
    }
  }
  parseGameBananaUrl(url) {
    try {
      const mmdlMatch = url.match(/mmdl\/(\d+)/);
      if (mmdlMatch && mmdlMatch[1]) {
        const modId = mmdlMatch[1];
        return `https://gamebanana.com/dl/${modId}`;
      }

      if (url.includes("/dl/")) {
        return url;
      }

      return null;
    } catch (error) {
      console.error("Error parsing URL:", error);
      return null;
    }
  }

  async downloadMod(url, downloadId) {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(app.getPath("temp"), "fightplanner-downloads");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `mod-${Date.now()}.zip`;
      const filePath = path.join(tempDir, fileName);

      console.log("[protocol][download] to:", filePath);

      const protocol = url.startsWith("https") ? https : http;

      const file = fs.createWriteStream(filePath);
      let receivedBytes = 0;
      let totalBytes = 0;

      const requestOptions = new URL(url);
      requestOptions.headers = {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
      };

      // Store download info for cancel
      this.activeDownloads.set(downloadId, {
        request: null, // Will be set after request is created
        file: file,
        filePath: filePath,
        cancelled: false
      });

      const request = protocol.get(requestOptions, (response) => {
        // Update stored request
        const download = this.activeDownloads.get(downloadId);
        if (download) {
          download.request = request;
        }
        
        // Check if cancelled before processing response
        if (download && download.cancelled) {
          response.destroy();
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(new Error('Download cancelled'));
          return;
        }
        
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(
            "[protocol][download] redirect to:",
            response.headers.location
          );
          file.close();
          fs.unlinkSync(filePath);

          this.downloadMod(response.headers.location, downloadId)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);

          reject(
            new Error(`Download failed with status ${response.statusCode}`)
          );
          return;
        }

        totalBytes = parseInt(response.headers["content-length"], 10) || 0;

        response.on("data", (chunk) => {
          // Check if cancelled during download
          const downloadCheck = this.activeDownloads.get(downloadId);
          if (downloadCheck && downloadCheck.cancelled) {
            return;
          }

          receivedBytes += chunk.length;

          if (totalBytes > 0) {
            const progress = Math.round((receivedBytes / totalBytes) * 100);
            this.sendToRenderer("mod-download-progress", {
              downloadId,
              progress,
              receivedBytes,
              totalBytes,
            });
          }
        });

        response.pipe(file);

        file.on("finish", () => {
          // Check if download was cancelled before finishing
          const downloadCheck = this.activeDownloads.get(downloadId);
          if (downloadCheck && downloadCheck.cancelled) {
            console.log("[protocol][download] cancelled during transfer");
            this.activeDownloads.delete(downloadId);
            reject(new Error('Download cancelled'));
            return;
          }
          
          file.close(() => {
            console.log("[protocol][download] complete");
            this.activeDownloads.delete(downloadId);
            resolve(filePath);
          });
        });
      });

      request.on("error", (err) => {
        this.activeDownloads.delete(downloadId);
        file.close();
        fs.unlinkSync(filePath);

        reject(err);
      });

      file.on("error", (err) => {
        this.activeDownloads.delete(downloadId);
        file.close();
        fs.unlinkSync(filePath);

        reject(err);
      });
    });
  }
  async installMod(zipPath, downloadId) {
    // Verify ZIP file exists
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file does not exist: ${zipPath}`);
    }
    
    const modsPath = sharedStore.get("modsPath");

    if (!modsPath) {
      throw new Error("Mods folder not configured. Please set it in Settings.");
    }

    if (!fs.existsSync(modsPath)) {
      throw new Error("Mods folder does not exist");
    }

    console.log("Installing mod to:", modsPath);

    const tempExtractDir = path.join(
      app.getPath("temp"),
      "fightplanner-extract",
      `mod-${Date.now()}`
    );
    if (!fs.existsSync(tempExtractDir)) {
      fs.mkdirSync(tempExtractDir, { recursive: true });
    }

    this.sendToRenderer("mod-extract-start", { downloadId });
    await this.extractZip(zipPath, tempExtractDir);
    this.sendToRenderer("mod-extract-complete", { downloadId });

    const extractedItems = fs.readdirSync(tempExtractDir);
    console.log("Extracted items:", extractedItems);

    let installedModName;
    if (
      extractedItems.length === 1 &&
      fs.statSync(path.join(tempExtractDir, extractedItems[0])).isDirectory()
    ) {
      const modFolderName = extractedItems[0];
      const tempModPath = path.join(tempExtractDir, modFolderName);
      const finalModPath = path.join(modsPath, modFolderName);

      if (fs.existsSync(finalModPath)) {
        console.log("Mod already exists, removing old version");
        fs.rmSync(finalModPath, { recursive: true, force: true });
      }

      console.log("Copying mod from temp to mods folder...");
      this.copyRecursiveSync(tempModPath, finalModPath);
      console.log("Mod installed to:", finalModPath);
      installedModName = modFolderName;
    } else {
      const modFolderName = `mod-${Date.now()}`;
      const finalModPath = path.join(modsPath, modFolderName);
      console.log("Copying multiple items to mods folder...");
      this.copyRecursiveSync(tempExtractDir, finalModPath);
      console.log("Mod installed to:", finalModPath);
      installedModName = modFolderName;
    }

    try {
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn("Failed to cleanup temp directory:", err.message);
    }

    console.log("Mod installed successfully");
    return installedModName;
  }
  copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      fs.readdirSync(src).forEach((childItemName) => {
        this.copyRecursiveSync(
          path.join(src, childItemName),
          path.join(dest, childItemName)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  async extractZip(zipPath, targetPath) {
    try {
      console.log("Extracting ZIP file...");
      console.log("Source:", zipPath);
      console.log("Destination:", targetPath);

      if (!fs.existsSync(zipPath)) {
        throw new Error("ZIP file does not exist: " + zipPath);
      }

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      let extracted = false;
      let lastError = null;

      try {
        await this.extract7Zip(zipPath, targetPath);
        console.log("✓ Extracted using 7-Zip");
        extracted = true;
      } catch (err) {
        console.warn("7-Zip extraction failed:", err.message);
        lastError = err;
      }

      if (!extracted && process.platform !== "win32") {
        try {
          await this.extractUnzip(zipPath, targetPath);
          console.log("✓ Extracted using system unzip");
          extracted = true;
        } catch (err) {
          console.warn("System unzip failed:", err.message);
          lastError = err;
        }
      }

      if (!extracted) {
        try {
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(targetPath, true);
          console.log("✓ Extracted using adm-zip (fallback)");
          extracted = true;
        } catch (err) {
          console.error("adm-zip extraction failed:", err.message);
          lastError = err;
        }
      }

      if (!extracted) {
        throw lastError || new Error("All extraction methods failed");
      }

      const extractedFiles = fs.readdirSync(targetPath);
      console.log("Extracted files/folders:", extractedFiles);

      if (extractedFiles.length === 0) {
        throw new Error("ZIP extraction resulted in no files");
      }
    } catch (error) {
      console.error("ZIP extraction failed:", error);
      throw new Error(`Failed to extract ZIP: ${error.message}`);
    }
  }

  async extract7Zip(zipPath, targetPath) {
    let command;

    if (process.platform === "win32") {
      const bundled7z = path.join(__dirname, "../../tools/7za.exe");

      if (fs.existsSync(bundled7z)) {
        command = `"${bundled7z}" x "${zipPath}" -o"${targetPath}" -y`;
      } else {
        command = `7z x "${zipPath}" -o"${targetPath}" -y`;
      }
    } else {
      command = `7z x "${zipPath}" -o"${targetPath}" -y`;
    }

    console.log("[protocol][extract] 7z command:", command);
    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes("Everything is Ok")) {
      console.warn("7z stderr:", stderr);
    }

    console.log("[protocol][extract] 7z output:", stdout);
  }

  async extractUnzip(zipPath, targetPath) {
    const command = `unzip -o "${zipPath}" -d "${targetPath}"`;
    console.log("[protocol][extract] unzip command:", command);

    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.warn("unzip stderr:", stderr);
    }

    console.log("[protocol][extract] unzip output:", stdout);
  }

  async fetchAndSaveModMetadata(modId, modFolderPath) {
    try {
      console.log(`Fetching metadata for mod ${modId}...`);

      const hasPreview = this.hasPreviewImage(modFolderPath);
      const hasInfoToml = fs.existsSync(path.join(modFolderPath, "info.toml"));

      if (hasPreview && hasInfoToml) {
        console.log(
          "Mod already has preview and info.toml, skipping metadata fetch"
        );
        return;
      }

      const apiUrl = `https://gamebanana.com/apiv11/Mod/${modId}?_csvProperties=%40gbprofile`;
      console.log("API URL:", apiUrl);

      const response = await this.fetchWithTimeout(apiUrl, 10000);
      const data = JSON.parse(response);

      if (
        !hasPreview &&
        data._aPreviewMedia &&
        data._aPreviewMedia._aImages &&
        data._aPreviewMedia._aImages.length > 0
      ) {
        const firstImage = data._aPreviewMedia._aImages[0];
        if (firstImage._sBaseUrl && firstImage._sFile) {
          const imageUrl = firstImage._sBaseUrl + "/" + firstImage._sFile;
          console.log("Downloading preview from:", imageUrl);
          await this.downloadPreviewImage(imageUrl, modFolderPath);
        }
      }

      if (!hasInfoToml) {
        const category =
          data._aSuperCategory && data._aSuperCategory._sName
            ? data._aSuperCategory._sName
            : "";
        const author =
          data._aSubmitter && data._aSubmitter._sName
            ? data._aSubmitter._sName
            : "";
        const version =
          data._aAdditionalInfo && data._aAdditionalInfo._sVersion
            ? data._aAdditionalInfo._sVersion
            : "";

        if (category || author || version) {
          console.log("Creating info.toml...");
          this.createInfoToml(modFolderPath, category, author, version);
        }
      }

      console.log("✓ Metadata saved successfully");
    } catch (error) {
      console.error("Failed to fetch mod metadata:", error.message);
    }
  }

  hasPreviewImage(modFolderPath) {
    try {
      const files = fs.readdirSync(modFolderPath);
      return files.some((file) => file.toLowerCase().startsWith("preview."));
    } catch {
      return false;
    }
  }

  fetchWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : http;
      const requestOptions = new URL(url);
      requestOptions.headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/json, */*;q=0.1",
      };

      const req = protocol.get(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  async downloadPreviewImage(imageUrl, modFolderPath) {
    return new Promise((resolve, reject) => {
      const protocol = imageUrl.startsWith("https") ? https : http;
      const previewPath = path.join(modFolderPath, "preview.webp");
      const file = fs.createWriteStream(previewPath);

      const requestOptions = new URL(imageUrl);
      requestOptions.headers = {
        "User-Agent": USER_AGENT,
        Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
      };

      const request = protocol.get(requestOptions, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            console.log("✓ Preview image saved");
            resolve();
          });
        } else {
          file.close();
          fs.unlinkSync(previewPath);
          reject(new Error(`Failed to download image: ${response.statusCode}`));
        }
      });

      request.on("error", (err) => {
        file.close();
        if (fs.existsSync(previewPath)) {
          fs.unlinkSync(previewPath);
        }
        reject(err);
      });
    });
  }

  createInfoToml(modFolderPath, category, author, version) {
    const tomlPath = path.join(modFolderPath, "info.toml");
    let content = "";

    if (author) {
      content += `authors = "${author}"\n`;
    }
    if (version) {
      content += `version = "${version}"\n`;
    }
    if (category) {
      content += `category = "${category}"\n`;
    }

    fs.writeFileSync(tomlPath, content, "utf8");
    console.log("✓ info.toml created");
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  showError(message) {
    dialog.showErrorBox("FightPlanner - Installation Error", message);
  }

  cancelDownload(downloadId) {
    const download = this.activeDownloads.get(downloadId);
    if (!download) {
      return { success: false, error: 'Download not found' };
    }

    if (download.cancelled) {
      return { success: false, error: 'Download already cancelled' };
    }

    download.cancelled = true;

    // Destroy the request to stop data flow
    if (download.request) {
      download.request.destroy();
      download.request = null;
    }

    // Close and delete the file
    if (download.file) {
      // Ensure file is properly closed
      const filePath = download.filePath;
      try {
        download.file.destroy(); // Force close
      } catch (err) {
        console.warn('Error destroying file stream:', err);
      }
      
      // Try to delete the file
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('[protocol] Deleted cancelled download file:', filePath);
        } catch (err) {
          console.warn('Failed to delete cancelled download file:', err);
        }
      }
    }

    // Keep entry for a short time to catch finish event, then clean up
    setTimeout(() => {
      this.activeDownloads.delete(downloadId);
    }, 1000);

    // Notify renderer immediately
    this.sendToRenderer('mod-install-error', { 
      downloadId, 
      error: 'Download cancelled by user' 
    });

    return { success: true };
  }

}

module.exports = ProtocolHandler;
