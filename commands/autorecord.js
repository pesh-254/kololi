const { getOwnerConfig, setOwnerConfig, parseToggleCommand } = require('../Database/settingsStore');
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

async function autorecordingCommand(sock, chatId, message) {
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

        const args = message.message?.conversation?.trim().split(' ').slice(1) || 
                     message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || 
                     [];

        const config = getOwnerConfig('autorecord') || { enabled: false };

        if (args.length > 0) {
            const action = args[0].toLowerCase();
            const toggle = parseToggleCommand(action);
            
            if (toggle === 'on') {
                setOwnerConfig('autorecord', { enabled: true });
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nAutorecording ENABLED`
                }, { quoted: fake });
            } else if (toggle === 'off') {
                setOwnerConfig('autorecord', { enabled: false });
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nAutorecording DISABLED`
                }, { quoted: fake });
            } else {
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nInvalid option! Use: on or off`
                }, { quoted: fake });
            }
        } else {
            const newState = !config.enabled;
            setOwnerConfig('autorecord', { enabled: newState });
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAutorecording ${newState ? 'ENABLED' : 'DISABLED'}`
            }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in autorecording command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

function isAutorecordingEnabled() {
    const config = getOwnerConfig('autorecord');
    return config?.enabled || false;
}

async function handleAutorecording(sock, chatId) {
    try {
        if (!isAutorecordingEnabled()) return;
        
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('recording', chatId);
    } catch (error) {
        console.error('Autorecording error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    autorecordingCommand,
    isAutorecordingEnabled,
    handleAutorecording
};
