const path = require('path');
const fs = require('fs');

class ModUtils {
    // Get disabled mods folder path from active mods folder
    static getDisabledModsFolder(activeModsPath) {
        const parentDir = path.dirname(activeModsPath);
        return path.join(parentDir, '{disabled_mod}');
    }

    // Read all mods from a folder
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

    // Get preview image path from mod folder
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

    // Convert file path to file:// URL
    static pathToFileUrl(filePath) {
        if (!filePath) return null;
        
        // Normalize path and convert to forward slashes
        const normalizedPath = filePath.replace(/\\/g, '/');
        return 'file://' + normalizedPath;
    }

    // Read and parse info.toml file from mod folder
    static readModInfo(modFolderPath) {
        try {
            const infoPath = path.join(modFolderPath, 'info.toml');
            
            if (!fs.existsSync(infoPath)) {
                return null;
            }
            
            const content = fs.readFileSync(infoPath, 'utf8');
            
            // Simple TOML parser for our specific format
            const info = {};
            const lines = content.split('\n');
            let currentKey = null;
            let multilineValue = '';
            let inMultiline = false;
            
            lines.forEach((line, index) => {
                const originalLine = line;
                line = line.trim();
                
                // Skip empty lines and comments when not in multiline
                if (!inMultiline && (!line || line.startsWith('#'))) return;
                
                // Check for triple quotes (multiline delimiter)
                const tripleQuoteCount = (line.match(/"""/g) || []).length;
                
                if (tripleQuoteCount > 0) {
                    if (!inMultiline) {
                        // Starting multiline
                        const equalsIndex = line.indexOf('=');
                        if (equalsIndex !== -1) {
                            currentKey = line.substring(0, equalsIndex).trim();
                            inMultiline = true;
                            
                            // Check if closing """ is on same line
                            const afterEquals = line.substring(equalsIndex + 1).trim();
                            if (afterEquals === '"""') {
                                // Empty multiline on same line, do nothing yet
                            } else if (tripleQuoteCount === 2) {
                                // Single line multiline: key = """value"""
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
                        // Ending multiline
                        if (line === '"""' || line.endsWith('"""')) {
                            info[currentKey] = multilineValue.trim();
                            multilineValue = '';
                            inMultiline = false;
                            currentKey = null;
                        }
                    }
                } else if (inMultiline) {
                    // Inside multiline string - preserve original spacing
                    multilineValue += originalLine + '\n';
                } else if (line.includes('=')) {
                    // Regular key-value pair
                    const equalsIndex = line.indexOf('=');
                    const key = line.substring(0, equalsIndex).trim();
                    let value = line.substring(equalsIndex + 1).trim();
                    
                    // Remove surrounding quotes
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

    // Read all mods (active + disabled)
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

    // Scan mod folder for slot patterns (c00-c07)
    static scanModForSlots(modFolderPath) {
        const slots = {};
        
        try {
            const slotPattern = /c0[0-7]/gi;
            
            // Recursive function to scan directories
            const scanDirectory = (dirPath, relativePath = '') => {
                if (!fs.existsSync(dirPath)) return;
                
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                
                entries.forEach(entry => {
                    const fullPath = path.join(dirPath, entry.name);
                    const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                    
                    if (entry.isDirectory()) {
                        // Check if directory name contains c0X pattern
                        const matches = entry.name.match(slotPattern);
                        if (matches) {
                            // Use Set to avoid duplicates
                            const uniqueSlots = new Set();
                            matches.forEach(match => {
                                const slotNum = parseInt(match.toLowerCase().charAt(2));
                                uniqueSlots.add(slotNum);
                            });
                            
                            uniqueSlots.forEach(slotNum => {
                                if (!slots[slotNum]) {
                                    slots[slotNum] = [];
                                }
                                // Check if not already added (avoid duplicates)
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
                        
                        // Always recursively scan subdirectories to find nested c0X files/folders
                        try {
                            scanDirectory(fullPath, relPath);
                        } catch (err) {
                            console.warn(`Cannot scan subdirectory ${relPath}:`, err.message);
                        }
                    } else if (entry.isFile()) {
                        // Check if filename contains c0X pattern
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
            
            // Convert to array format and sort
            const slotsArray = Object.keys(slots)
                .map(slotNum => ({
                    slot: parseInt(slotNum),
                    files: slots[slotNum].sort((a, b) => {
                        // Sort directories first, then by path
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

    // Apply slot changes to mod folder
    static applySlotChanges(modFolderPath, changes) {
        try {
            const modificationsMap = new Map();
            
            // Process modifications
            changes.modifications.forEach(mod => {
                if (mod.type === 'change') {
                    modificationsMap.set(mod.originalSlot, mod.newSlot);
                }
            });
            
            // To avoid conflicts when swapping slots, we need to rename in stages
            // Use a unique temporary prefix that won't match c0X pattern
            const tempPrefix = 'TMPSLOT';
            const renamedPaths = [];
            
            // Phase 1: Rename all to temporary names (c0X -> TMPSLOT_X)
            modificationsMap.forEach((newSlot, originalSlot) => {
                const tempName = `${tempPrefix}_${originalSlot}`;
                const result = this.renameSlotInMod(modFolderPath, `c0${originalSlot}`, tempName);
                renamedPaths.push(...result);
            });
            
            // Phase 2: Rename from temporary names to final names (TMPSLOT_X -> c0Y)
            modificationsMap.forEach((newSlot, originalSlot) => {
                const tempName = `${tempPrefix}_${originalSlot}`;
                this.renameSlotInMod(modFolderPath, tempName, `c0${newSlot}`);
            });
            
            // Update config.json if it exists
            this.updateConfigJsonSlots(modFolderPath, modificationsMap);
            
            return { success: true };
        } catch (error) {
            console.error('Error applying slot changes:', error);
            return { success: false, error: error.message };
        }
    }

    // Rename slot references in mod folder
    static renameSlotInMod(modFolderPath, oldPattern, newPattern) {
        const renamedPaths = [];
        
        // Escape special regex characters in the pattern
        const escapedPattern = oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Create regex - match the pattern globally (case insensitive)
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
            
            // Collect items to rename (process after recursion to avoid path issues)
            const itemsToRename = [];
            
            // Process files and directories
            entries.forEach(entry => {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively process subdirectory FIRST (depth-first)
                    try {
                        renameInDirectory(fullPath);
                    } catch (err) {
                        console.warn(`Error processing subdirectory ${fullPath}:`, err.message);
                    }
                    
                    // Then check if directory itself needs renaming
                    if (entry.name.match(oldRegex)) {
                        itemsToRename.push({
                            oldPath: fullPath,
                            oldName: entry.name,
                            isDirectory: true
                        });
                    }
                } else if (entry.isFile()) {
                    // Check if file needs renaming
                    if (entry.name.match(oldRegex)) {
                        itemsToRename.push({
                            oldPath: fullPath,
                            oldName: entry.name,
                            isDirectory: false
                        });
                    }
                }
            });
            
            // Now rename collected items (after subdirectory processing)
            itemsToRename.forEach(item => {
                // Use a function to replace only the first occurrence or all if needed
                // But protect already replaced patterns
                let newName = item.oldName.replace(oldRegex, newPattern);
                const newPath = path.join(dirPath, newName);
                
                // Only rename if target doesn't exist
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

    // Update config.json with new slot references
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
            
            // Replace slot references in config.json (case-insensitive)
            modificationsMap.forEach((newSlot, originalSlot) => {
                const oldPattern = `c0${originalSlot}`;
                const newPattern = `c0${newSlot}`;
                
                // Replace both lowercase and uppercase versions
                updatedContent = updatedContent.replace(new RegExp(oldPattern, 'gi'), newPattern);
                updatedContent = updatedContent.replace(new RegExp(oldPattern.toUpperCase(), 'g'), newPattern.toUpperCase());
            });
            
            // Write updated config back
            fs.writeFileSync(configPath, updatedContent, 'utf8');
            console.log('config.json updated successfully');
        } catch (error) {
            console.error('Error updating config.json:', error);
        }
    }
}

module.exports = ModUtils;

