const { BrowserWindow, ipcMain } = require('electron');
const { createTutorialWindow, closeTutorialWindow } = require('../../tutorial-window');
const { handleError, createErrorResponse, ErrorCodes } = require('../../utils/error-handler');

function registerTutorialHandlers(ipcMain) {
  ipcMain.handle('open-tutorial-window', async () => {
    try {
      const windows = BrowserWindow.getAllWindows();
      const mainWindow = windows[0];
      createTutorialWindow(mainWindow || null);
      return { success: true };
    } catch (error) {
      handleError(error, 'open-tutorial-window');
      return createErrorResponse(ErrorCodes.TUTORIAL_WINDOW_ERROR, error.message);
    }
  });

  ipcMain.on('close-tutorial-window', () => {
    console.log('Received close-tutorial-window event');
    closeTutorialWindow();
  });

  ipcMain.on('skip-tutorial', () => {
    console.log('Received skip-tutorial event');
    closeTutorialWindow();
  });
}

module.exports = { registerTutorialHandlers };


