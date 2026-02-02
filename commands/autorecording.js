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

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const config = getOwnerConfig('autorecording') || { enabled: false, duration: 3000, pm: false, group: false };

        if (!action) {
            const helpText = `*${botName} AUTORECORDING*\n\n` +
                `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                `Duration: ${config.duration}ms\n` +
                `PM: ${config.pm ? 'ON' : 'OFF'}\n` +
                `Group: ${config.group ? 'ON' : 'OFF'}\n\n` +
                `*Commands:*\n` +
                `.autorecording on - Enable\n` +
                `.autorecording off - Disable\n` +
                `.autorecording pm - Toggle for PMs\n` +
                `.autorecording group - Toggle for groups\n` +
                `.autorecording duration <ms> - Set duration`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        let newConfig = { ...config };
        let responseText = '';

        const toggle = parseToggleCommand(action);
        if (toggle === 'on') {
            newConfig.enabled = true;
            responseText = `*${botName}*\nAutorecording ENABLED`;
        } else if (toggle === 'off') {
            newConfig.enabled = false;
            responseText = `*${botName}*\nAutorecording DISABLED`;
        } else if (action === 'pm') {
            newConfig.pm = !newConfig.pm;
            responseText = `*${botName}*\nAutorecording for PMs: ${newConfig.pm ? 'ON' : 'OFF'}`;
        } else if (action === 'group') {
            newConfig.group = !newConfig.group;
            responseText = `*${botName}*\nAutorecording for Groups: ${newConfig.group ? 'ON' : 'OFF'}`;
        } else if (action === 'duration' && args[1]) {
            const duration = parseInt(args[1]);
            if (duration >= 1000 && duration <= 10000) {
                newConfig.duration = duration;
                responseText = `*${botName}*\nRecording duration set to ${duration}ms`;
            } else {
                responseText = `*${botName}*\nDuration must be 1000-10000ms`;
            }
        } else {
            responseText = `*${botName}*\nInvalid command! Use: on, off, pm, group, duration`;
        }

        if (responseText && !responseText.includes('Invalid') && !responseText.includes('must be')) {
            setOwnerConfig('autorecording', newConfig);
        }

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
    } catch (error) {
        console.error('Error in autorecording command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

function isAutorecordingEnabled() {
    const config = getOwnerConfig('autorecording');
    return config?.enabled || false;
}

async function safeRecordingPresence(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('recording', chatId);
    } catch (error) {
        console.error('Recording presence error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function handleAutorecordingForMessage(sock, chatId, message) {
    try {
        const config = getOwnerConfig('autorecording');
        if (!config?.enabled) return;
        
        const isGroup = chatId.endsWith('@g.us');
        if (isGroup && !config.group) return;
        if (!isGroup && !config.pm) return;
        
        await safeRecordingPresence(sock, chatId);
    } catch (error) {
        console.error('Autorecording error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function handleAutorecordingForCommand(sock, chatId) {
    try {
        const config = getOwnerConfig('autorecording');
        if (!config?.enabled) return;
        
        await safeRecordingPresence(sock, chatId);
        await new Promise(resolve => setTimeout(resolve, config.duration || 3000));
    } catch (error) {
        console.error('Autorecording error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function showRecordingAfterCommand(sock, chatId) {
    try {
        const config = getOwnerConfig('autorecording');
        if (!config?.enabled) return;
        
        await sock.sendPresenceUpdate('paused', chatId);
    } catch (error) {
        console.error('Autorecording error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    autorecordingCommand,
    isAutorecordingEnabled,
    safeRecordingPresence,
    handleAutorecordingForMessage,
    handleAutorecordingForCommand,
    showRecordingAfterCommand
};
