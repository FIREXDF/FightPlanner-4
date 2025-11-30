const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const execAsync = promisify(exec);

/**
 * Detect available drives on Windows
 * @returns {Promise<Array<{letter: string, label: string, type: string}>>}
 */
async function detectWindowsDrives() {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    // Use wmic to get drive information
    const { stdout } = await execAsync('wmic logicaldisk get name,volumename,drivetype');
    const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Name'));
    
    const drives = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const letter = parts[0].replace(':', '');
        const label = parts[1] || 'Local Disk';
        const type = parts[parts.length - 1];
        
        // Filter for removable drives (type 2) and fixed drives (type 3)
        // We include both because SD cards can sometimes show as fixed
        if (type === '2' || type === '3') {
          drives.push({
            letter: letter,
            label: label,
            type: type === '2' ? 'removable' : 'fixed',
            path: `${letter}:\\`
          });
        }
      }
    }
    
    return drives;
  } catch (error) {
    console.error('Error detecting drives with wmic:', error);
    
    // Fallback: check common drive letters
    const fallbackDrives = [];
    const driveLetters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    for (const letter of driveLetters) {
      const path = `${letter}:\\`;
      try {
        if (fs.existsSync(path)) {
          fallbackDrives.push({
            letter: letter,
            label: 'Unknown',
            type: 'unknown',
            path: path
          });
        }
      } catch (e) {
        // Drive doesn't exist or isn't accessible
      }
    }
    
    return fallbackDrives;
  }
}

/**
 * Check if a drive path exists and is accessible
 * @param {string} drivePath - Path to check (e.g., "E:\\")
 * @returns {boolean}
 */
function isDriveAccessible(drivePath) {
  try {
    return fs.existsSync(drivePath);
  } catch (error) {
    return false;
  }
}

/**
 * Check if a path contains Switch SD card structure
 * @param {string} basePath - Base path to check
 * @returns {boolean}
 */
function isSwitchSdCard(basePath) {
  try {
    const atmospherePath = `${basePath}atmosphere`;
    const exists = fs.existsSync(atmospherePath);
    return exists;
  } catch (error) {
    return false;
  }
}

module.exports = {
  detectWindowsDrives,
  isDriveAccessible,
  isSwitchSdCard
};


