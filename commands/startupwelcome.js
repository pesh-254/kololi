const { getOwnerConfig, setOwnerConfig } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

function isStartupWelcomeOn() {
    try {
        const config = getOwnerConfig('startupWelcome');
        return config !== false;
    } catch (error) {
        console.error('Error getting startup welcome:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return true;
    }
}

function setStartupWelcome(enabled) {
    try {
        setOwnerConfig('startupWelcome', enabled);
        return true;
    } catch (error) {
        console.error('Error setting startup welcome:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return false;
    }
}

// FIXED: Added proper toggle parsing function
function parseToggleCommand(action) {
    if (action === 'on' || action === 'enable' || action === 'true' || action === '1' || action === 'yes') {
        return 'on';
    } else if (action === 'off' || action === 'disable' || action === 'false' || action === '0' || action === 'no') {
        return 'off';
    }
    return null;
}

async function startupWelcomeCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    const botName = getBotName();

    try {
        if (!await isAuthorized(sock, message)) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nOwner only command!`
            }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const currentStatus = isStartupWelcomeOn();

        if (!action) {
            await sock.sendMessage(chatId, {
                text: `*${botName} STARTUP WELCOME*\n\n` +
                    `Current Status: ${currentStatus ? '✅ ON' : '❌ OFF'}\n\n` +
                    `*Commands:*\n` +
                    `.startupwelcome on - Enable startup message\n` +
                    `.startupwelcome off - Disable startup message\n\n` +
                    `*Aliases:*\n` +
                    `.startupmessage on/off\n` +
                    `.welcomemessage on/off\n` +
                    `.inboxmessage on/off`
            }, { quoted: fake });
            return;
        }

        const toggle = parseToggleCommand(action);

        if (toggle === 'on') {
            setStartupWelcome(true);
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n✅ Startup welcome message enabled!`
            }, { quoted: fake });
        } else if (toggle === 'off') {
            setStartupWelcome(false);
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Startup welcome message disabled!`
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Invalid option! Use: on/off\n\n` +
                      `Examples:\n` +
                      `.startupwelcome on\n` +
                      `.startupwelcome off\n` +
                      `.startupwenable enable\n` +
                      `.startupwelcome disable`
            }, { quoted: fake });
        }
    } catch (error) {
        console.error('Startup welcome command error:', error.message, 'Line:', error.stack?.split('\n')[1]);
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Command failed: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = { 
    startupWelcomeCommand, 
    isStartupWelcomeOn, 
    setStartupWelcome 
};