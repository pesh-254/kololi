const { getOwnerConfig, setOwnerConfig } = require('../Database/settingsStore');

const defaultConfig = {
    botName: 'KOLOLI',
    menuImage: '',
    ownerName: 'Owner',
    welcomeMessage: 'Welcome to the group!',
    goodbyeMessage: 'Goodbye!',
    antideletePrivate: true
};

function initConfig() {
    try {
        const stored = getOwnerConfig('botconfig');
        if (stored && typeof stored === 'object') {
            return { ...defaultConfig, ...stored };
        }
        return defaultConfig;
    } catch (error) {
        return defaultConfig;
    }
}

function saveConfig(config) {
    setOwnerConfig('botconfig', config);
}

function getBotName() {
    return initConfig().botName;
}

function setBotName(name) {
    const config = initConfig();
    config.botName = name;
    saveConfig(config);
}

function getMenuImage() {
    return initConfig().menuImage;
}

function setMenuImage(url) {
    const config = initConfig();
    config.menuImage = url;
    saveConfig(config);
}

function getOwnerName() {
    return initConfig().ownerName;
}

function setOwnerName(name) {
    const config = initConfig();
    config.ownerName = name;
    saveConfig(config);
}

function isAntideletePrivateEnabled() {
    return initConfig().antideletePrivate !== false;
}

function setAntideletePrivate(enabled) {
    const config = initConfig();
    config.antideletePrivate = enabled;
    saveConfig(config);
}

function getConfig() {
    return initConfig();
}

function updateConfig(updates) {
    const config = initConfig();
    Object.assign(config, updates);
    saveConfig(config);
}

module.exports = {
    getBotName,
    setBotName,
    getMenuImage,
    setMenuImage,
    getOwnerName,
    setOwnerName,
    isAntideletePrivateEnabled,
    setAntideletePrivate,
    getConfig,
    updateConfig
};
