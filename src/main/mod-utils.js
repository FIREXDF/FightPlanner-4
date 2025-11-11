const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CONFLICT_WHITELIST_PATTERNS = [
    'ui_chara_db.prcxml',
    'info.toml',
    'preview.webp',
    'msg_name.xmsbt',
    'config.json',
    'msg_bgm.xmsbt',
    'ui_chara_db.prcx',
    'plugin.nro',
    'victory.toml',
    'README.txt'
];

class ModUtils {

    static getDisabledModsFolder(activeModsPath) {
        const parentDir = path.dirname(activeModsPath);
        return path.join(parentDir, '{disabled_mod}');
    }

    static readModsFromFolder(folderPath, status = 'active') {
        const mods = [];

        if (!fs.existsSync(folderPath)) {
            console.log(`Folder does not exist: ${folderPath}`);
            return mods;
        }

        try {
            const entries = fs.readdirSync(folderPath, { withFileTypes: true });

            entries.forEach(entry => {
                if (entry.isDirectory()) {
                    const modPath = path.join(folderPath, entry.name);
                    mods.push({
                        name: entry.name,
                        path: modPath,
                        status: status
                    });
                }
            });
        } catch (error) {
            console.error(`Error reading folder ${folderPath}:`, error);
        }

        return mods;
    }

    static getPreviewImagePath(modFolderPath) {
        try {
            const previewPath = path.join(modFolderPath, 'preview.webp');

            if (fs.existsSync(previewPath)) {
                return previewPath;
            }

            return null;
        } catch (error) {
            console.error('Error getting preview path:', error);
            return null;
        }
    }

    static pathToFileUrl(filePath) {
        if (!filePath) return null;

        const normalizedPath = filePath.replace(/\\/g, '/');
        return 'file://' + normalizedPath;
    }

    static readModInfo(modFolderPath) {
        try {
            const infoPath = path.join(modFolderPath, 'info.toml');

            if (!fs.existsSync(infoPath)) {
                return null;
            }

            const content = fs.readFileSync(infoPath, 'utf8');

            const info = {};
            const lines = content.split('\n');
            let currentKey = null;
            let multilineValue = '';
            let inMultiline = false;

            lines.forEach((line, index) => {
                const originalLine = line;
                line = line.trim();

                if (!inMultiline && (!line || line.startsWith('#'))) return;

                const tripleQuoteCount = (line.match(/"""/g) || []).length;

                if (tripleQuoteCount > 0) {
                    if (!inMultiline) {
                        const equalsIndex = line.indexOf('=');
                        if (equalsIndex !== -1) {
                            currentKey = line.substring(0, equalsIndex).trim();
                            inMultiline = true;

                            const afterEquals = line.substring(equalsIndex + 1).trim();
                            if (afterEquals === '"""') {

                            } else if (tripleQuoteCount === 2) {

                                const startQuote = afterEquals.indexOf('"""');
                                const endQuote = afterEquals.lastIndexOf('"""');
                                if (startQuote !== -1 && endQuote !== -1 && startQuote !== endQuote) {
                                    info[currentKey] = afterEquals.substring(startQuote + 3, endQuote);
                                    inMultiline = false;
                                    currentKey = null;
                                }
                            }
                        }
                    } else {

                        if (line === '"""' || line.endsWith('"""')) {
                            info[currentKey] = multilineValue.trim();
                            multilineValue = '';
                            inMultiline = false;
                            currentKey = null;
                        }
                    }
                } else if (inMultiline) {

                    multilineValue += originalLine + '\n';
                } else if (line.includes('=')) {

                    const equalsIndex = line.indexOf('=');
                    const key = line.substring(0, equalsIndex).trim();
                    let value = line.substring(equalsIndex + 1).trim();

                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }

                    info[key] = value;
                }
            });

            return info;
        } catch (error) {
            console.error('Error reading mod info:', error);
            return null;
        }
    }

    static readAllMods(activeModsPath) {
        const activeMods = this.readModsFromFolder(activeModsPath, 'active');

        const disabledModsPath = this.getDisabledModsFolder(activeModsPath);
        const disabledMods = this.readModsFromFolder(disabledModsPath, 'disabled');

        console.log(`Found ${activeMods.length} active mods`);
        console.log(`Found ${disabledMods.length} disabled mods`);

        return {
            activeMods,
            disabledMods
        };
    }

    static scanModForSlots(modFolderPath) {
        const slots = {};

        try {
            const slotPattern = /c0[0-7]/gi;

            const scanDirectory = (dirPath, relativePath = '') => {
                if (!fs.existsSync(dirPath)) return;

                const entries = fs.readdirSync(dirPath, { withFileTypes: true });

                entries.forEach(entry => {
                    const fullPath = path.join(dirPath, entry.name);
                    const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

                    if (entry.isDirectory()) {

                        const matches = entry.name.match(slotPattern);
                        if (matches) {

                            const uniqueSlots = new Set();
                            matches.forEach(match => {
                                const slotNum = parseInt(match.toLowerCase().charAt(2));
                                uniqueSlots.add(slotNum);
                            });

                            uniqueSlots.forEach(slotNum => {
                                if (!slots[slotNum]) {
                                    slots[slotNum] = [];
                                }

                                const exists = slots[slotNum].some(item => item.path === relPath);
                                if (!exists) {
                                    slots[slotNum].push({
                                        path: relPath,
                                        type: 'directory',
                                        name: entry.name,
                                        parent: relativePath || '(root)'
                                    });
                                }
                            });
                        }

                        try {
                            scanDirectory(fullPath, relPath);
                        } catch (err) {
                            console.warn(`Cannot scan subdirectory ${relPath}:`, err.message);
                        }
                    } else if (entry.isFile()) {

                        const matches = entry.name.match(slotPattern);
                        if (matches) {
                            const uniqueSlots = new Set();
                            matches.forEach(match => {
                                const slotNum = parseInt(match.toLowerCase().charAt(2));
                                uniqueSlots.add(slotNum);
                            });

                            uniqueSlots.forEach(slotNum => {
                                if (!slots[slotNum]) {
                                    slots[slotNum] = [];
                                }
                                const exists = slots[slotNum].some(item => item.path === relPath);
                                if (!exists) {
                                    slots[slotNum].push({
                                        path: relPath,
                                        type: 'file',
                                        name: entry.name,
                                        parent: relativePath || '(root)'
                                    });
                                }
                            });
                        }
                    }
                });
            };

            console.log(`Scanning mod folder for slots: ${modFolderPath}`);
            scanDirectory(modFolderPath);

            const slotsArray = Object.keys(slots)
                .map(slotNum => ({
                    slot: parseInt(slotNum),
                    files: slots[slotNum].sort((a, b) => {

                        if (a.type !== b.type) {
                            return a.type === 'directory' ? -1 : 1;
                        }
                        return a.path.localeCompare(b.path);
                    })
                }))
                .sort((a, b) => a.slot - b.slot);

            console.log(`Found ${slotsArray.length} different slot(s):`, slotsArray.map(s => `c0${s.slot} (${s.files.length} items)`).join(', '));

            return slotsArray;
        } catch (error) {
            console.error('Error scanning mod for slots:', error);
            return [];
        }
    }

    static applySlotChanges(modFolderPath, changes) {
        try {
            const modificationsMap = new Map();

            changes.modifications.forEach(mod => {
                if (mod.type === 'change') {
                    modificationsMap.set(mod.originalSlot, mod.newSlot);
                }
            });

            const tempPrefix = 'TMPSLOT';
            const renamedPaths = [];

            modificationsMap.forEach((newSlot, originalSlot) => {
                const tempName = `${tempPrefix}_${originalSlot}`;
                const result = this.renameSlotInMod(modFolderPath, `c0${originalSlot}`, tempName);
                renamedPaths.push(...result);
            });

            modificationsMap.forEach((newSlot, originalSlot) => {
                const tempName = `${tempPrefix}_${originalSlot}`;
                this.renameSlotInMod(modFolderPath, tempName, `c0${newSlot}`);
            });

            this.updateConfigJsonSlots(modFolderPath, modificationsMap);

            return { success: true };
        } catch (error) {
            console.error('Error applying slot changes:', error);
            return { success: false, error: error.message };
        }
    }

    static renameSlotInMod(modFolderPath, oldPattern, newPattern) {
        const renamedPaths = [];

        const escapedPattern = oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const oldRegex = new RegExp(escapedPattern, 'gi');

        const renameInDirectory = (dirPath) => {
            if (!fs.existsSync(dirPath)) return;

            let entries;
            try {
                entries = fs.readdirSync(dirPath, { withFileTypes: true });
            } catch (err) {
                console.warn(`Cannot read directory ${dirPath}:`, err.message);
                return;
            }

            const itemsToRename = [];

            entries.forEach(entry => {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {

                    try {
                        renameInDirectory(fullPath);
                    } catch (err) {
                        console.warn(`Error processing subdirectory ${fullPath}:`, err.message);
                    }

                    if (entry.name.match(oldRegex)) {
                        itemsToRename.push({
                            oldPath: fullPath,
                            oldName: entry.name,
                            isDirectory: true
                        });
                    }
                } else if (entry.isFile()) {

                    if (entry.name.match(oldRegex)) {
                        itemsToRename.push({
                            oldPath: fullPath,
                            oldName: entry.name,
                            isDirectory: false
                        });
                    }
                }
            });

            itemsToRename.forEach(item => {

                let newName = item.oldName.replace(oldRegex, newPattern);
                const newPath = path.join(dirPath, newName);

                if (!fs.existsSync(newPath)) {
                    try {
                        fs.renameSync(item.oldPath, newPath);
                        renamedPaths.push({
                            old: item.oldPath,
                            new: newPath,
                            type: item.isDirectory ? 'directory' : 'file'
                        });
                        console.log(`Renamed ${item.isDirectory ? 'folder' : 'file'}: ${item.oldName} -> ${newName}`);
                    } catch (err) {
                        console.error(`Failed to rename ${item.oldPath}:`, err.message);
                    }
                } else {
                    console.warn(`Cannot rename ${item.oldName} to ${newName}: target already exists`);
                }
            });
        };

        console.log(`Renaming pattern "${oldPattern}" to "${newPattern}" in ${modFolderPath}`);
        renameInDirectory(modFolderPath);
        console.log(`Renamed ${renamedPaths.length} item(s)`);
        return renamedPaths;
    }

    static updateConfigJsonSlots(modFolderPath, modificationsMap) {
        const configPath = path.join(modFolderPath, 'config.json');

        if (!fs.existsSync(configPath)) {
            console.log('No config.json found - skipping');
            return;
        }

        try {
            console.log('Updating config.json slot references...');
            const configContent = fs.readFileSync(configPath, 'utf8');
            let updatedContent = configContent;

            modificationsMap.forEach((newSlot, originalSlot) => {
                const oldPattern = `c0${originalSlot}`;
                const newPattern = `c0${newSlot}`;

                updatedContent = updatedContent.replace(new RegExp(oldPattern, 'gi'), newPattern);
                updatedContent = updatedContent.replace(new RegExp(oldPattern.toUpperCase(), 'g'), newPattern.toUpperCase());
            });

            fs.writeFileSync(configPath, updatedContent, 'utf8');
            console.log('config.json updated successfully');
        } catch (error) {
            console.error('Error updating config.json:', error);
        }
    }

    static detectConflicts(activeMods, whitelistPatterns = []) {
        const conflicts = [];
        const fileToMods = new Map();
        
        const allPatterns = [...CONFLICT_WHITELIST_PATTERNS, ...whitelistPatterns];

        activeMods.forEach((mod, modIndex) => {
            if (!mod.path || !fs.existsSync(mod.path)) return;

            const scanMod = (dirPath, relativePath = '') => {
                if (!fs.existsSync(dirPath)) return;

                try {
                    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

                    entries.forEach(entry => {
                        const fullPath = path.join(dirPath, entry.name);
                        const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

                        if (allPatterns.some(pattern => {
                            if (typeof pattern === 'string') {
                                return relPath.includes(pattern);
                            }
                            return false;
                        })) {
                            return;
                        }

                        if (entry.isDirectory()) {
                            try {
                                scanMod(fullPath, relPath);
                            } catch (err) {
                            }
                        } else if (entry.isFile()) {
                            const normalizedPath = relPath.replace(/\\/g, '/');
                            
                            if (!fileToMods.has(normalizedPath)) {
                                fileToMods.set(normalizedPath, []);
                            }
                            fileToMods.get(normalizedPath).push({
                                modIndex,
                                modName: mod.name,
                                modPath: mod.path,
                                filePath: normalizedPath
                            });
                        }
                    });
                } catch (error) {
                    console.warn(`Error scanning directory ${dirPath}:`, error.message);
                }
            };

            scanMod(mod.path);
        });

        fileToMods.forEach((modsList, filePath) => {
            if (modsList.length > 1) {
                conflicts.push({
                    filePath: filePath,
                    mods: modsList.map(m => ({
                        name: m.modName,
                        path: m.modPath
                    }))
                });
            }
        });

        return conflicts;
    }

    static async extractArchive(archivePath, targetPath) {
        try {
            console.log("Extracting archive file...");
            console.log("Source:", archivePath);
            console.log("Destination:", targetPath);

            if (!fs.existsSync(archivePath)) {
                throw new Error("Archive file does not exist: " + archivePath);
            }

            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }

            const ext = path.extname(archivePath).toLowerCase();
            let extracted = false;
            let lastError = null;

            // Try 7-Zip first (supports zip, rar, 7z, etc.)
            if (process.platform === "win32") {
                try {
                    await this.extract7Zip(archivePath, targetPath);
                    console.log("✓ Extracted using 7-Zip");
                    extracted = true;
                } catch (err) {
                    console.warn("7-Zip extraction failed:", err.message);
                    lastError = err;
                }
            }

            // Try system unzip (for zip files on non-Windows)
            if (!extracted && process.platform !== "win32" && (ext === '.zip')) {
                try {
                    await this.extractUnzip(archivePath, targetPath);
                    console.log("✓ Extracted using system unzip");
                    extracted = true;
                } catch (err) {
                    console.warn("System unzip failed:", err.message);
                    lastError = err;
                }
            }

            // Fallback to adm-zip for zip files
            if (!extracted && ext === '.zip') {
                try {
                    const zip = new AdmZip(archivePath);
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
                throw new Error("Archive extraction resulted in no files");
            }
        } catch (error) {
            console.error("Archive extraction failed:", error);
            throw new Error(`Failed to extract archive: ${error.message}`);
        }
    }

    static async extract7Zip(archivePath, targetPath) {
        let command;

        if (process.platform === "win32") {
            const bundled7z = path.join(__dirname, "../../tools/7za.exe");

            if (fs.existsSync(bundled7z)) {
                command = `"${bundled7z}" x "${archivePath}" -o"${targetPath}" -y`;
            } else {
                command = `7z x "${archivePath}" -o"${targetPath}" -y`;
            }
        } else {
            command = `7z x "${archivePath}" -o"${targetPath}" -y`;
        }

        console.log("[extract] 7z command:", command);
        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stderr.includes("Everything is Ok")) {
            console.warn("7z stderr:", stderr);
        }

        console.log("[extract] 7z output:", stdout);
    }

    static async extractUnzip(archivePath, targetPath) {
        const command = `unzip -o "${archivePath}" -d "${targetPath}"`;
        console.log("[extract] unzip command:", command);

        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
            console.warn("unzip stderr:", stderr);
        }

        console.log("[extract] unzip output:", stdout);
    }

    static copyRecursiveSync(src, dest) {
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

    static async installModFromPath(sourcePath, modsPath) {
        try {
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Source path does not exist: ${sourcePath}`);
            }

            if (!modsPath) {
                throw new Error("Mods folder not configured. Please set it in Settings.");
            }

            if (!fs.existsSync(modsPath)) {
                throw new Error("Mods folder does not exist");
            }

            const stats = fs.statSync(sourcePath);
            const isDirectory = stats.isDirectory();
            const ext = path.extname(sourcePath).toLowerCase();
            const isArchive = ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext);

            let tempExtractDir = null;
            let extractedItems = [];
            let modFolderName = null;

            // If it's an archive, extract it first
            if (isArchive) {
                console.log("Installing mod from archive:", sourcePath);
                tempExtractDir = path.join(
                    app.getPath("temp"),
                    "fightplanner-extract",
                    `mod-${Date.now()}`
                );
                if (!fs.existsSync(tempExtractDir)) {
                    fs.mkdirSync(tempExtractDir, { recursive: true });
                }

                await this.extractArchive(sourcePath, tempExtractDir);
                extractedItems = fs.readdirSync(tempExtractDir);
                console.log("Extracted items:", extractedItems);

                // Determine mod folder name
                if (
                    extractedItems.length === 1 &&
                    fs.statSync(path.join(tempExtractDir, extractedItems[0])).isDirectory()
                ) {
                    modFolderName = extractedItems[0];
                } else {
                    modFolderName = path.basename(sourcePath, ext);
                }
            } else if (isDirectory) {
                // If it's a directory, use it directly
                console.log("Installing mod from directory:", sourcePath);
                modFolderName = path.basename(sourcePath);
            } else {
                throw new Error("Source path must be an archive file (.zip, .rar, .7z, etc.) or a directory");
            }

            const finalModPath = path.join(modsPath, modFolderName);

            // Remove existing mod if it exists
            if (fs.existsSync(finalModPath)) {
                console.log("Mod already exists, removing old version");
                fs.rmSync(finalModPath, { recursive: true, force: true });
            }

            // Copy or move the mod
            if (isArchive) {
                const sourceModPath = path.join(tempExtractDir, modFolderName);
                if (fs.existsSync(sourceModPath)) {
                    console.log("Copying mod from temp to mods folder...");
                    this.copyRecursiveSync(sourceModPath, finalModPath);
                } else {
                    // Multiple items extracted, copy all
                    console.log("Copying multiple items to mods folder...");
                    this.copyRecursiveSync(tempExtractDir, finalModPath);
                }
            } else {
                // For directories, move instead of copy to avoid duplication
                console.log("Moving mod directory to mods folder...");
                fs.renameSync(sourcePath, finalModPath);
            }

            // Cleanup temp directory
            if (tempExtractDir && fs.existsSync(tempExtractDir)) {
                try {
                    fs.rmSync(tempExtractDir, { recursive: true, force: true });
                } catch (err) {
                    console.warn("Failed to cleanup temp directory:", err.message);
                }
            }

            // Delete original archive file after successful installation
            if (isArchive && fs.existsSync(sourcePath)) {
                try {
                    fs.unlinkSync(sourcePath);
                    console.log("Deleted original archive file");
                } catch (err) {
                    console.warn("Failed to delete original archive:", err.message);
                }
            }

            console.log("Mod installed successfully to:", finalModPath);
            return { success: true, modPath: finalModPath, modName: modFolderName };
        } catch (error) {
            console.error("Error installing mod from path:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ModUtils;

