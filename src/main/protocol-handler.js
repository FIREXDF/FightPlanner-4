// Protocol Handler for fightplanner:// deep links
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const AdmZip = require('adm-zip');

class ProtocolHandler {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.downloadInProgress = false;
    }

    /**
     * Register the fightplanner:// protocol
     */
    static registerProtocol() {
        // Windows: explicit registration + registry
        if (process.platform === 'win32') {
            // Check if running in development mode (npm start / electron .)
            if (process.defaultApp) {
                if (process.argv.length >= 2) {
                    app.setAsDefaultProtocolClient('fightplanner', process.execPath, [path.resolve(process.argv[1])]);
                    console.log('✓ FightPlanner protocol registered (dev mode)');
                }
            } else {
                // Production mode (packaged .exe)
                app.setAsDefaultProtocolClient('fightplanner');
                console.log('✓ FightPlanner protocol registered (production)');
            }
            
            // Also manually register in Windows Registry for better reliability
            this.registerProtocolInRegistry();
        } else if (process.platform === 'darwin' || process.platform === 'linux') {
            // In production, electron-builder registers using package.json build.protocols
            // Here we also register in dev so deep links work during development
            try {
                if (process.defaultApp && process.argv.length >= 2) {
                    app.setAsDefaultProtocolClient('fightplanner', process.execPath, [path.resolve(process.argv[1])]);
                    console.log('✓ FightPlanner protocol registered (dev mode, ' + process.platform + ')');
                } else {
                    app.setAsDefaultProtocolClient('fightplanner');
                    console.log('✓ FightPlanner protocol ensured (' + process.platform + ')');
                }
            } catch (e) {
                console.warn('Protocol registration skipped (' + process.platform + '):', e.message);
            }
        }
    }

    /**
     * Manually register protocol in Windows Registry
     */
    static registerProtocolInRegistry() {
        if (process.platform !== 'win32') return;

        try {
            const { exec } = require('child_process');
            
            // Build the command based on dev/production mode
            let commandString;
            if (process.defaultApp) {
                // Development mode - include the script path
                const exePath = process.execPath.replace(/\\/g, '\\\\');
                const scriptPath = path.resolve(process.argv[1]).replace(/\\/g, '\\\\');
                commandString = `\\"${exePath}\\" \\"${scriptPath}\\" \\"%1\\"`;
                console.log('Registering protocol in registry (dev mode)...');
            } else {
                // Production mode - just the exe
                const exePath = process.execPath.replace(/\\/g, '\\\\');
                commandString = `\\"${exePath}\\" \\"%1\\"`;
                console.log('Registering protocol in registry (production)...');
            }
            
            console.log('Command string:', commandString);

            // Use reg.exe command to register protocol (more reliable than winreg module)
            const commands = [
                // Create main protocol key
                `reg add "HKCU\\Software\\Classes\\fightplanner" /ve /d "URL:FightPlanner Protocol" /f`,
                // Add URL Protocol value
                `reg add "HKCU\\Software\\Classes\\fightplanner" /v "URL Protocol" /t REG_SZ /d "" /f`,
                // Create DefaultIcon key
                `reg add "HKCU\\Software\\Classes\\fightplanner\\DefaultIcon" /ve /d "${process.execPath.replace(/\\/g, '\\\\')},0" /f`,
                // Create shell\\open\\command key with the command
                `reg add "HKCU\\Software\\Classes\\fightplanner\\shell\\open\\command" /ve /d "${commandString}" /f`
            ];

            // Execute all commands
            let commandsExecuted = 0;
            commands.forEach((cmd, index) => {
                exec(cmd, (error, stdout, stderr) => {
                    commandsExecuted++;
                    
                    if (error) {
                        console.error(`Registry command ${index + 1} failed:`, error.message);
                    } else {
                        console.log(`✓ Registry command ${index + 1} executed successfully`);
                    }

                    // When all commands are done
                    if (commandsExecuted === commands.length) {
                        console.log('Protocol registration in registry completed!');
                        
                        // Verify registration
                        exec('reg query "HKCU\\Software\\Classes\\fightplanner\\shell\\open\\command"', (error, stdout, stderr) => {
                            if (!error) {
                                console.log('✓ Protocol verified in registry:');
                                console.log(stdout);
                            }
                        });
                    }
                });
            });

        } catch (error) {
            console.error('Registry registration failed:', error);
            console.error('You may need to run the app as Administrator once.');
        }
    }

    /**
     * Handle deep link URL
     * Format: fightplanner:https://gamebanana.com/mmdl/1549678,Mod,630054,zip
     * Converts to: https://gamebanana.com/dl/1549678
     */
    async handleDeepLink(url) {
        console.log('Handling deep link:', url);

        try {
            // Remove the fightplanner: prefix
            const cleanUrl = url.replace('fightplanner:', '');
            
            // Extract mod ID from URL for API call
            const modId = this.extractModId(cleanUrl);
            
            // Parse the GameBanana URL
            const downloadUrl = this.parseGameBananaUrl(cleanUrl);
            
            if (!downloadUrl) {
                this.showError('Invalid URL format');
                return;
            }

            console.log('Download URL:', downloadUrl);
            console.log('Mod ID:', modId);

            // Show notification to user
            this.sendToRenderer('mod-install-start', { url: downloadUrl });

            // Download the mod
            const filePath = await this.downloadMod(downloadUrl);
            
            if (!filePath) {
                this.showError('Download failed');
                return;
            }

            console.log('Downloaded to:', filePath);

            // Install the mod
            const modName = await this.installMod(filePath);

            // Clean up downloaded file
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.warn('Failed to delete temp file:', err);
            }

            // Fetch and save mod metadata from GameBanana API if modId is available
            if (modId && modName) {
                const Store = require('electron-store');
                const store = new Store();
                const modsPath = store.get('modsPath');
                
                if (modsPath) {
                    const modFolderPath = path.join(modsPath, modName);
                    await this.fetchAndSaveModMetadata(modId, modFolderPath);
                }
            }

            // Notify success
            this.sendToRenderer('mod-install-success', { url: downloadUrl, modName: modName });

        } catch (error) {
            console.error('Error handling deep link:', error);
            this.showError(`Installation failed: ${error.message}`);
            this.sendToRenderer('mod-install-error', { error: error.message });
        }
    }

    /**
     * Extract Mod ID from GameBanana URL
     * Input: https://gamebanana.com/mmdl/1549678,Mod,630054,zip
     * Output: 630054
     */
    extractModId(url) {
        try {
            // Format: mmdl/{downloadId},Mod,{modId},{extension}
            const mmdlMatch = url.match(/mmdl\/\d+,Mod,(\d+)/);
            if (mmdlMatch && mmdlMatch[1]) {
                return mmdlMatch[1];
            }
            return null;
        } catch (error) {
            console.error('Error extracting mod ID:', error);
            return null;
        }
    }

    /**
     * Parse GameBanana URL
     * Input: https://gamebanana.com/mmdl/1549678,Mod,630054,zip
     * Output: https://gamebanana.com/dl/1549678
     */
    parseGameBananaUrl(url) {
        try {
            // Extract the mod ID from mmdl URL
            const mmdlMatch = url.match(/mmdl\/(\d+)/);
            if (mmdlMatch && mmdlMatch[1]) {
                const modId = mmdlMatch[1];
                return `https://gamebanana.com/dl/${modId}`;
            }

            // If it's already a dl/ URL, return as is
            if (url.includes('/dl/')) {
                return url;
            }

            return null;
        } catch (error) {
            console.error('Error parsing URL:', error);
            return null;
        }
    }

    /**
     * Download mod from URL
     */
    async downloadMod(url) {
        return new Promise((resolve, reject) => {
            if (this.downloadInProgress) {
                reject(new Error('A download is already in progress'));
                return;
            }

            this.downloadInProgress = true;

            // Create temp directory
            const tempDir = path.join(app.getPath('temp'), 'fightplanner-downloads');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generate filename
            const fileName = `mod-${Date.now()}.zip`;
            const filePath = path.join(tempDir, fileName);

            console.log('Downloading to:', filePath);

            const protocol = url.startsWith('https') ? https : http;

            const file = fs.createWriteStream(filePath);
            let receivedBytes = 0;
            let totalBytes = 0;

            const request = protocol.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    console.log('Redirect to:', response.headers.location);
                    file.close();
                    fs.unlinkSync(filePath);
                    this.downloadInProgress = false;
                    
                    // Follow redirect
                    this.downloadMod(response.headers.location)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(filePath);
                    this.downloadInProgress = false;
                    reject(new Error(`Download failed with status ${response.statusCode}`));
                    return;
                }

                totalBytes = parseInt(response.headers['content-length'], 10) || 0;

                response.on('data', (chunk) => {
                    receivedBytes += chunk.length;
                    
                    // Send progress update
                    if (totalBytes > 0) {
                        const progress = Math.round((receivedBytes / totalBytes) * 100);
                        this.sendToRenderer('mod-download-progress', { 
                            progress, 
                            receivedBytes, 
                            totalBytes 
                        });
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close(() => {
                        this.downloadInProgress = false;
                        console.log('Download complete');
                        resolve(filePath);
                    });
                });
            });

            request.on('error', (err) => {
                file.close();
                fs.unlinkSync(filePath);
                this.downloadInProgress = false;
                reject(err);
            });

            file.on('error', (err) => {
                file.close();
                fs.unlinkSync(filePath);
                this.downloadInProgress = false;
                reject(err);
            });
        });
    }

    /**
     * Install downloaded mod
     */
    async installMod(zipPath) {
        const Store = require('electron-store');
        const store = new Store();
        const modsPath = store.get('modsPath');

        if (!modsPath) {
            throw new Error('Mods folder not configured. Please set it in Settings.');
        }

        if (!fs.existsSync(modsPath)) {
            throw new Error('Mods folder does not exist');
        }

        console.log('Installing mod to:', modsPath);

        // Create a temporary extraction folder
        const tempExtractDir = path.join(app.getPath('temp'), 'fightplanner-extract', `mod-${Date.now()}`);
        if (!fs.existsSync(tempExtractDir)) {
            fs.mkdirSync(tempExtractDir, { recursive: true });
        }

        // Extract ZIP to temp folder
        await this.extractZip(zipPath, tempExtractDir);

        // Find the mod folder inside
        const extractedItems = fs.readdirSync(tempExtractDir);
        console.log('Extracted items:', extractedItems);

        // If there's only one folder, use it as the mod folder
        let installedModName;
        if (extractedItems.length === 1 && fs.statSync(path.join(tempExtractDir, extractedItems[0])).isDirectory()) {
            const modFolderName = extractedItems[0];
            const tempModPath = path.join(tempExtractDir, modFolderName);
            const finalModPath = path.join(modsPath, modFolderName);

            // Check if mod already exists
            if (fs.existsSync(finalModPath)) {
                console.log('Mod already exists, removing old version');
                fs.rmSync(finalModPath, { recursive: true, force: true });
            }

            // Copy to mods folder (instead of rename to support cross-device)
            console.log('Copying mod from temp to mods folder...');
            this.copyRecursiveSync(tempModPath, finalModPath);
            console.log('Mod installed to:', finalModPath);
            installedModName = modFolderName;
        } else {
            // Multiple files/folders - create a new folder for them
            const modFolderName = `mod-${Date.now()}`;
            const finalModPath = path.join(modsPath, modFolderName);
            console.log('Copying multiple items to mods folder...');
            this.copyRecursiveSync(tempExtractDir, finalModPath);
            console.log('Mod installed to:', finalModPath);
            installedModName = modFolderName;
        }

        // Cleanup temp directory
        try {
            if (fs.existsSync(tempExtractDir)) {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
            }
        } catch (err) {
            console.warn('Failed to cleanup temp directory:', err.message);
        }

        console.log('Mod installed successfully');
        return installedModName;
    }

    /**
     * Recursively copy directory (supports cross-device)
     */
    copyRecursiveSync(src, dest) {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();

        if (isDirectory) {
            // Create destination directory if it doesn't exist
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            
            // Copy all contents
            fs.readdirSync(src).forEach((childItemName) => {
                this.copyRecursiveSync(
                    path.join(src, childItemName),
                    path.join(dest, childItemName)
                );
            });
        } else {
            // Copy file
            fs.copyFileSync(src, dest);
        }
    }

    /**
     * Extract ZIP file - Cross-platform solution
     * Priority: Native 7z > System unzip > adm-zip fallback
     */
    async extractZip(zipPath, targetPath) {
        try {
            console.log('Extracting ZIP file...');
            console.log('Source:', zipPath);
            console.log('Destination:', targetPath);
            
            // Check if zip file exists
            if (!fs.existsSync(zipPath)) {
                throw new Error('ZIP file does not exist: ' + zipPath);
            }
            
            // Create target directory if it doesn't exist
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }

            // Try extraction methods in order of preference
            let extracted = false;
            let lastError = null;

            // Method 1: Try native 7-Zip (best for all platforms)
            try {
                await this.extract7Zip(zipPath, targetPath);
                console.log('✓ Extracted using 7-Zip');
                extracted = true;
            } catch (err) {
                console.warn('7-Zip extraction failed:', err.message);
                lastError = err;
            }

            // Method 2: Try system unzip (Linux/Mac)
            if (!extracted && process.platform !== 'win32') {
                try {
                    await this.extractUnzip(zipPath, targetPath);
                    console.log('✓ Extracted using system unzip');
                    extracted = true;
                } catch (err) {
                    console.warn('System unzip failed:', err.message);
                    lastError = err;
                }
            }

            // Method 3: Fallback to adm-zip (slowest but always works)
            if (!extracted) {
                try {
                    const zip = new AdmZip(zipPath);
                    zip.extractAllTo(targetPath, true);
                    console.log('✓ Extracted using adm-zip (fallback)');
                    extracted = true;
                } catch (err) {
                    console.error('adm-zip extraction failed:', err.message);
                    lastError = err;
                }
            }

            if (!extracted) {
                throw lastError || new Error('All extraction methods failed');
            }
            
            // Verify extraction
            const extractedFiles = fs.readdirSync(targetPath);
            console.log('Extracted files/folders:', extractedFiles);
            
            if (extractedFiles.length === 0) {
                throw new Error('ZIP extraction resulted in no files');
            }
            
        } catch (error) {
            console.error('ZIP extraction failed:', error);
            throw new Error(`Failed to extract ZIP: ${error.message}`);
        }
    }

    /**
     * Extract using 7-Zip (Windows: 7za.exe, Linux/Mac: 7z command)
     */
    async extract7Zip(zipPath, targetPath) {
        let command;
        
        if (process.platform === 'win32') {
            // Windows: Use bundled 7za.exe or system 7z
            const bundled7z = path.join(__dirname, '../../tools/7za.exe');
            
            if (fs.existsSync(bundled7z)) {
                // Use bundled 7za.exe
                command = `"${bundled7z}" x "${zipPath}" -o"${targetPath}" -y`;
            } else {
                // Try system 7z (if installed)
                command = `7z x "${zipPath}" -o"${targetPath}" -y`;
            }
        } else {
            // Linux/Mac: Use system 7z (installed via brew/apt)
            command = `7z x "${zipPath}" -o"${targetPath}" -y`;
        }
        
        console.log('Running 7z command:', command);
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stderr.includes('Everything is Ok')) {
            console.warn('7z stderr:', stderr);
        }
        
        console.log('7z output:', stdout);
    }

    /**
     * Extract using system unzip (Linux/Mac)
     */
    async extractUnzip(zipPath, targetPath) {
        const command = `unzip -o "${zipPath}" -d "${targetPath}"`;
        console.log('Running unzip command:', command);
        
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr) {
            console.warn('unzip stderr:', stderr);
        }
        
        console.log('unzip output:', stdout);
    }

    /**
     * Fetch and save mod metadata from GameBanana API
     */
    async fetchAndSaveModMetadata(modId, modFolderPath) {
        try {
            console.log(`Fetching metadata for mod ${modId}...`);
            
            // Check if mod already has preview or info.toml
            const hasPreview = this.hasPreviewImage(modFolderPath);
            const hasInfoToml = fs.existsSync(path.join(modFolderPath, 'info.toml'));
            
            if (hasPreview && hasInfoToml) {
                console.log('Mod already has preview and info.toml, skipping metadata fetch');
                return;
            }
            
            // Fetch from GameBanana API
            const apiUrl = `https://gamebanana.com/apiv11/Mod/${modId}?_csvProperties=%40gbprofile`;
            console.log('API URL:', apiUrl);
            
            const response = await this.fetchWithTimeout(apiUrl, 10000);
            const data = JSON.parse(response);
            
            // Download preview image if needed
            if (!hasPreview && data._aPreviewMedia && data._aPreviewMedia._aImages && data._aPreviewMedia._aImages.length > 0) {
                const firstImage = data._aPreviewMedia._aImages[0];
                if (firstImage._sBaseUrl && firstImage._sFile) {
                    const imageUrl = firstImage._sBaseUrl + '/' + firstImage._sFile;
                    console.log('Downloading preview from:', imageUrl);
                    await this.downloadPreviewImage(imageUrl, modFolderPath);
                }
            }
            
            // Create info.toml if needed
            if (!hasInfoToml) {
                const category = data._aSuperCategory && data._aSuperCategory._sName ? data._aSuperCategory._sName : '';
                const author = data._aSubmitter && data._aSubmitter._sName ? data._aSubmitter._sName : '';
                const version = data._aAdditionalInfo && data._aAdditionalInfo._sVersion ? data._aAdditionalInfo._sVersion : '';
                
                if (category || author || version) {
                    console.log('Creating info.toml...');
                    this.createInfoToml(modFolderPath, category, author, version);
                }
            }
            
            console.log('✓ Metadata saved successfully');
        } catch (error) {
            console.error('Failed to fetch mod metadata:', error.message);
            // Don't throw - metadata is optional
        }
    }

    /**
     * Check if mod folder has a preview image
     */
    hasPreviewImage(modFolderPath) {
        try {
            const files = fs.readdirSync(modFolderPath);
            return files.some(file => file.toLowerCase().startsWith('preview.'));
        } catch {
            return false;
        }
    }

    /**
     * Fetch with timeout
     */
    fetchWithTimeout(url, timeout) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const req = protocol.get(url, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.setTimeout(timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Download preview image
     */
    async downloadPreviewImage(imageUrl, modFolderPath) {
        return new Promise((resolve, reject) => {
            const protocol = imageUrl.startsWith('https') ? https : http;
            const previewPath = path.join(modFolderPath, 'preview.webp');
            const file = fs.createWriteStream(previewPath);
            
            const request = protocol.get(imageUrl, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log('✓ Preview image saved');
                        resolve();
                    });
                } else {
                    file.close();
                    fs.unlinkSync(previewPath);
                    reject(new Error(`Failed to download image: ${response.statusCode}`));
                }
            });
            
            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(previewPath)) {
                    fs.unlinkSync(previewPath);
                }
                reject(err);
            });
        });
    }

    /**
     * Create info.toml file
     */
    createInfoToml(modFolderPath, category, author, version) {
        const tomlPath = path.join(modFolderPath, 'info.toml');
        let content = '';
        
        if (author) {
            content += `authors = "${author}"\n`;
        }
        if (version) {
            content += `version = "${version}"\n`;
        }
        if (category) {
            content += `category = "${category}"\n`;
        }
        
        fs.writeFileSync(tomlPath, content, 'utf8');
        console.log('✓ info.toml created');
    }

    /**
     * Send message to renderer
     */
    sendToRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    /**
     * Show error dialog
     */
    showError(message) {
        dialog.showErrorBox('FightPlanner - Installation Error', message);
    }
}

module.exports = ProtocolHandler;

