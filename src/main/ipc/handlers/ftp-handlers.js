const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const FTPClient = require('../../ftp-client');
const { handleError, createErrorResponse, ErrorCodes } = require('../../utils/error-handler');

function registerFtpHandlers(ipcMain) {
  ipcMain.handle('send-mods-to-switch', async (event, config) => {
    const ftpClient = new FTPClient();
    let transferredCount = 0;
    
    try {
      let remoteBasePath = (config.switchFtpPath || '/switch').replace(/\\/g, '/');
      if (!remoteBasePath.startsWith('/')) {
        remoteBasePath = '/' + remoteBasePath;
      }
      
      console.log('Starting FTP transfer to Switch:', {
        ip: config.switchIp,
        port: config.switchPort,
        remotePath: remoteBasePath
      });

      await ftpClient.connect(config.switchIp, config.switchPort);

      if (config.recentMods && config.recentMods.length > 0) {
        for (const mod of config.recentMods) {
          try {
            let localModPath = null;
            if (mod.folderPath && fs.existsSync(mod.folderPath)) {
              localModPath = mod.folderPath;
            } else {
              const modFolderName = mod.modName || mod.id;
              localModPath = path.join(config.modsPath, modFolderName);
            }
            
            if (localModPath && fs.existsSync(localModPath) && fs.statSync(localModPath).isDirectory()) {
              const remoteModPath = `${remoteBasePath}/${path.basename(localModPath)}`;
              const count = await ftpClient.uploadDirectory(localModPath, remoteModPath);
              transferredCount += count;
              console.log(`Successfully sent mod: ${path.basename(localModPath)} (${count} files)`);
            } else {
              console.warn(`Mod folder not found: ${localModPath}`);
            }
          } catch (modError) {
            console.error(`Error sending mod ${mod.modName}:`, modError);
          }
        }
      } else {
        if (fs.existsSync(config.modsPath)) {
          const files = fs.readdirSync(config.modsPath);
          for (const file of files) {
            const localModPath = path.join(config.modsPath, file);
            if (fs.statSync(localModPath).isDirectory()) {
              const remoteModPath = `${remoteBasePath}/${file}`;
              const count = await ftpClient.uploadDirectory(localModPath, remoteModPath);
              transferredCount += count;
            }
          }
        }
      }

      await ftpClient.disconnect();
      
      console.log(`Successfully transferred ${transferredCount} files to Switch`);
      return { success: true, transferredCount };
    } catch (error) {
      handleError(error, 'send-mods-to-switch');
      try {
        await ftpClient.disconnect();
      } catch (disconnectError) {
      }
      return createErrorResponse(ErrorCodes.FTP_TRANSFER_ERROR, error.message);
    }
  });
}

module.exports = { registerFtpHandlers };


