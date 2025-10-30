const fs = require('fs');
const path = require('path');
const store = require('./store'); // Use the same store instance!

/**
 * Migrates settings from FightPlanner 3 (config.json) to FightPlanner 4 (electron-store)
 */
async function migrateFromV3() {
    try {
        // Get the store directory path
        const storePath = store.path;
        const storeDir = path.dirname(storePath);
        const oldConfigPath = path.join(storeDir, 'config.json');

        console.log('🔍 Checking for FightPlanner 3 config at:', oldConfigPath);

        // Check if old config exists
        if (!fs.existsSync(oldConfigPath)) {
            console.log('✓ No FightPlanner 3 config found, skipping migration');
            return { migrated: false };
        }

        // Check if migration was already done
        const alreadyMigrated = store.get('migrationCompleted');
        if (alreadyMigrated) {
            console.log('✓ Migration already completed, skipping');
            return { migrated: false, alreadyDone: true };
        }

        console.log('📦 FightPlanner 3 config found! Starting migration...');

        // Read old config
        const oldConfigContent = fs.readFileSync(oldConfigPath, 'utf8');
        const oldConfig = JSON.parse(oldConfigContent);

        console.log('📋 Old config loaded');

        // Migrate relevant settings
        const migratedSettings = {};

        // Essential paths
        if (oldConfig.modsPath) {
            store.set('modsPath', oldConfig.modsPath);
            migratedSettings.modsPath = oldConfig.modsPath;
            console.log('✓ Migrated modsPath:', oldConfig.modsPath);
        }

        if (oldConfig.pluginsPath) {
            store.set('pluginsPath', oldConfig.pluginsPath);
            migratedSettings.pluginsPath = oldConfig.pluginsPath;
            console.log('✓ Migrated pluginsPath:', oldConfig.pluginsPath);
        }

        // Emulator settings (might be useful in the future)
        if (oldConfig.selectedEmulator) {
            store.set('selectedEmulator', oldConfig.selectedEmulator);
            migratedSettings.selectedEmulator = oldConfig.selectedEmulator;
            console.log('✓ Migrated selectedEmulator:', oldConfig.selectedEmulator);
        }

        if (oldConfig.emulatorPath) {
            store.set('emulatorPath', oldConfig.emulatorPath);
            migratedSettings.emulatorPath = oldConfig.emulatorPath;
            console.log('✓ Migrated emulatorPath:', oldConfig.emulatorPath);
        }

        if (oldConfig.gamePath) {
            store.set('gamePath', oldConfig.gamePath);
            migratedSettings.gamePath = oldConfig.gamePath;
            console.log('✓ Migrated gamePath:', oldConfig.gamePath);
        }

        // Protocol settings
        if (typeof oldConfig.protocolConfirmEnabled !== 'undefined') {
            store.set('protocolConfirmEnabled', oldConfig.protocolConfirmEnabled);
            migratedSettings.protocolConfirmEnabled = oldConfig.protocolConfirmEnabled;
            console.log('✓ Migrated protocolConfirmEnabled:', oldConfig.protocolConfirmEnabled);
        }

        // Discord RPC (if we implement it in the future)
        if (typeof oldConfig.discordRpcEnabled !== 'undefined') {
            store.set('discordRpcEnabled', oldConfig.discordRpcEnabled);
            migratedSettings.discordRpcEnabled = oldConfig.discordRpcEnabled;
            console.log('✓ Migrated discordRpcEnabled:', oldConfig.discordRpcEnabled);
        }

        // Volume setting (if we implement audio in the future)
        if (typeof oldConfig.volume !== 'undefined') {
            store.set('volume', oldConfig.volume);
            migratedSettings.volume = oldConfig.volume;
            console.log('✓ Migrated volume:', oldConfig.volume);
        }

        // Mark migration as completed
        store.set('migrationCompleted', true);
        store.set('migratedFrom', 'FightPlanner 3');
        store.set('migrationDate', new Date().toISOString());

        // Backup old config (rename it so we don't re-migrate)
        const backupPath = path.join(storeDir, 'config.v3.backup.json');
        fs.renameSync(oldConfigPath, backupPath);
        console.log('✓ Old config backed up to:', backupPath);

        console.log('✅ Migration completed successfully!');
        console.log('📊 Migrated settings:', Object.keys(migratedSettings));

        return {
            migrated: true,
            settings: migratedSettings,
            backupPath: backupPath
        };
    } catch (error) {
        console.error('❌ Migration error:', error);
        return {
            migrated: false,
            error: error.message
        };
    }
}

/**
 * Get migration status
 */
async function getMigrationStatus() {
    const migrationCompleted = store.get('migrationCompleted');
    const migratedFrom = store.get('migratedFrom');
    const migrationDate = store.get('migrationDate');

    return {
        completed: migrationCompleted || false,
        from: migratedFrom || null,
        date: migrationDate || null
    };
}

module.exports = {
    migrateFromV3,
    getMigrationStatus
};

