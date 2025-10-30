// Main Process - Protocol Setup
// Add this to your main.js file

const { app } = require('electron');
const ProtocolHandler = require('./protocol-handler');

let protocolHandler = null;
let mainWindow = null;

// Register protocol BEFORE app is ready (platform-aware)
// Windows: we register explicitly; macOS/Linux: electron-builder handles in production
// but we still register in dev so deep links work during development
ProtocolHandler.registerProtocol();

/**
 * Initialize protocol handling
 * Call this in your main.js after creating the window
 */
function initializeProtocol(window) {
    mainWindow = window;
    
    // Create protocol handler instance
    protocolHandler = new ProtocolHandler(mainWindow);
    
    console.log('🔗 Protocol handler initialized');
    
    // Handle protocol URL on app start
    // Windows & Linux: URL is passed in process.argv
    if (process.platform === 'win32' || process.platform === 'linux') {
        const args = process.argv.slice(1);
        const protocolUrl = args.find(arg => typeof arg === 'string' && arg.startsWith('fightplanner:'));
        if (protocolUrl) {
            console.log('🚀 Opening with protocol URL (argv):', protocolUrl);
            window.webContents.once('did-finish-load', () => {
                setTimeout(() => protocolHandler.handleDeepLink(protocolUrl), 300);
            });
        }
    }
    
    // Handle protocol URL when app is already running (macOS)
    app.on('open-url', (event, url) => {
        event.preventDefault();
        console.log('🔗 Received protocol URL (open-url):', url);
        
        if (protocolHandler && url.startsWith('fightplanner:')) {
            // Focus the window
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
            protocolHandler.handleDeepLink(url);
        }
    });
    
    // Handle second instance (Windows/Linux) - when app is already running
    app.on('second-instance', (event, commandLine) => {
        console.log('🔗 Second instance launched with:', commandLine);
        
        // Find protocol URL in command line
        const protocolUrl = commandLine.find(arg => typeof arg === 'string' && arg.startsWith('fightplanner:'));
        
        if (protocolUrl && protocolHandler) {
            console.log('🚀 Processing protocol URL from second instance:', protocolUrl);
            
            // Focus the window
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
            
            // Handle the deep link
            protocolHandler.handleDeepLink(protocolUrl);
        }
    });
}

module.exports = { initializeProtocol };

