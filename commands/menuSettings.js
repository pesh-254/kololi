const { getOwnerConfig, setOwnerConfig } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

const DEFAULT_MENU_STYLE = '2';

const MENU_STYLES = {
    '1': 'Document with thumbnail',
    '2': 'Simple text reply',
    '3': 'Text with external ad reply',
    '4': 'Image with caption',
    '5': 'Interactive message',
    '6': 'Payment request format'
};

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

function getMenuStyle() {
    try {
        const config = getOwnerConfig('menuSettings');
        return config?.menuStyle || DEFAULT_MENU_STYLE;
    } catch (error) {
        console.error('Error getting menu style:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return DEFAULT_MENU_STYLE;
    }
}

function setMenuStyle(newStyle) {
    try {
        if (!['1', '2', '3', '4', '5', '6'].includes(newStyle)) {
            return false;
        }
        const config = getOwnerConfig('menuSettings') || {};
        config.menuStyle = newStyle;
        setOwnerConfig('menuSettings', config);
        return true;
    } catch (error) {
        console.error('Error setting menu style:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return false;
    }
}

// NEW: Get menu image from menu settings
function getMenuImage() {
    try {
        const config = getOwnerConfig('menuSettings');
        return config?.menuImage || '';
    } catch (error) {
        console.error('Error getting menu image:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return '';
    }
}

// NEW: Set menu image in menu settings
function setMenuImage(imagePath) {
    try {
        const config = getOwnerConfig('menuSettings') || {};
        config.menuImage = imagePath;
        setOwnerConfig('menuSettings', config);
        return true;
    } catch (error) {
        console.error('Error setting menu image:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return false;
    }
}

function getMenuSettings() {
    try {
        return getOwnerConfig('menuSettings') || {
            menuStyle: DEFAULT_MENU_STYLE,
            menuImage: '',  // NEW: Add menuImage to default settings
            showMemory: true,
            showUptime: true,
            showPluginCount: true,
            showProgressBar: true
        };
    } catch (error) {
        console.error('Error getting menu settings:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return {
            menuStyle: DEFAULT_MENU_STYLE,
            menuImage: '',  // NEW
            showMemory: true,
            showUptime: true,
            showPluginCount: true,
            showProgressBar: true
        };
    }
}

function setMenuSettings(settings) {
    try {
        setOwnerConfig('menuSettings', settings);
        return true;
    } catch (error) {
        console.error('Error setting menu settings:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return false;
    }
}

function toggleMenuSetting(setting) {
    try {
        const config = getMenuSettings();
        if (config.hasOwnProperty(setting)) {
            config[setting] = !config[setting];
            setMenuSettings(config);
            return config[setting];
        }
        return null;
    } catch (error) {
        console.error('Error toggling menu setting:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return null;
    }
}

async function menuConfigCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!await isAuthorized(sock, message)) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nOwner only command!`
            }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const config = getMenuSettings();

        if (!action) {
            let stylesList = '';
            for (const [key, desc] of Object.entries(MENU_STYLES)) {
                const current = key === config.menuStyle ? ' (current)' : '';
                stylesList += `${key}. ${desc}${current}\n`;
            }

            const helpText = `*${botName} MENU SETTINGS*\n\n` +
                `*Current Style:* ${config.menuStyle}\n` +
                `*Menu Image:* ${config.menuImage ? 'Set ✓' : 'Not set'}\n` +
                `*Show Memory:* ${config.showMemory ? 'ON' : 'OFF'}\n` +
                `*Show Uptime:* ${config.showUptime ? 'ON' : 'OFF'}\n` +
                `*Show Plugins:* ${config.showPluginCount ? 'ON' : 'OFF'}\n` +
                `*Progress Bar:* ${config.showProgressBar ? 'ON' : 'OFF'}\n\n` +
                `*Available Styles:*\n${stylesList}\n` +
                `*Commands:*\n` +
                `.menustyle <1-6> - Set menu style\n` +
                `.menustyle setimage - Set menu image (reply to image)\n` +
                `.menustyle removeimage - Remove menu image\n` +
                `.menustyle memory - Toggle memory display\n` +
                `.menustyle uptime - Toggle uptime display\n` +
                `.menustyle plugins - Toggle plugin count\n` +
                `.menustyle progress - Toggle progress bar`;

            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        let responseText = '';

        if (['1', '2', '3', '4', '5', '6'].includes(action)) {
            if (setMenuStyle(action)) {
                responseText = `*${botName}*\nMenu style set to: ${MENU_STYLES[action]}`;
            } else {
                responseText = `*${botName}*\nFailed to set menu style`;
            }
        } else if (action === 'setimage') {
            // Handle setting menu image
            const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (quotedMessage?.imageMessage) {
                try {
                    // You need to import downloadContentFromMessage
                    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
                    const fs = require('fs');
                    const path = require('path');
                    
                    const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }

                    const assetsDir = path.join(__dirname, '..', 'assets', 'menu');
                    if (!fs.existsSync(assetsDir)) {
                        fs.mkdirSync(assetsDir, { recursive: true });
                    }

                    const imagePath = path.join(assetsDir, 'custom-menu.jpg');
                    fs.writeFileSync(imagePath, buffer);

                    if (setMenuImage(imagePath)) {
                        responseText = `*${botName}*\nMenu image has been set successfully!`;
                    } else {
                        responseText = `*${botName}*\nFailed to save menu image setting.`;
                    }
                } catch (error) {
                    console.error('Error setting menu image:', error);
                    responseText = `*${botName}*\nFailed to download image: ${error.message}`;
                }
            } else {
                responseText = `*${botName}*\nPlease reply to an image message!\nUsage: .menustyle setimage (reply to image)`;
            }
        } else if (action === 'removeimage') {
            if (setMenuImage('')) {
                responseText = `*${botName}*\nMenu image has been removed. Using default thumbnails.`;
            } else {
                responseText = `*${botName}*\nFailed to remove menu image.`;
            }
        } else if (action === 'memory') {
            const result = toggleMenuSetting('showMemory');
            responseText = `*${botName}*\nMemory display: ${result ? 'ON' : 'OFF'}`;
        } else if (action === 'uptime') {
            const result = toggleMenuSetting('showUptime');
            responseText = `*${botName}*\nUptime display: ${result ? 'ON' : 'OFF'}`;
        } else if (action === 'plugins') {
            const result = toggleMenuSetting('showPluginCount');
            responseText = `*${botName}*\nPlugin count display: ${result ? 'ON' : 'OFF'}`;
        } else if (action === 'progress') {
            const result = toggleMenuSetting('showProgressBar');
            responseText = `*${botName}*\nProgress bar: ${result ? 'ON' : 'OFF'}`;
        } else {
            responseText = `*${botName}*\nInvalid option! Use: 1-6, setimage, removeimage, memory, uptime, plugins, progress`;
        }

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
    } catch (error) {
        console.error('Error in menu config command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    getMenuStyle,
    setMenuStyle,
    getMenuImage,  // NEW: Export this
    setMenuImage,  // NEW: Export this
    getMenuSettings,
    setMenuSettings,
    toggleMenuSetting,
    menuConfigCommand,
    MENU_STYLES
};