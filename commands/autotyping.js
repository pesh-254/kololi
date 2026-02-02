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

async function autotypingCommand(sock, chatId, message) {
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

        const config = getOwnerConfig('autotyping') || { enabled: false, duration: 3000, pm: false, group: false };

        if (!action) {
            const helpText = `*${botName} AUTOTYPING*\n\n` +
                `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                `Duration: ${config.duration}ms\n` +
                `PM: ${config.pm ? 'ON' : 'OFF'}\n` +
                `Group: ${config.group ? 'ON' : 'OFF'}\n\n` +
                `*Commands:*\n` +
                `.autotyping on - Enable\n` +
                `.autotyping off - Disable\n` +
                `.autotyping pm - Toggle for PMs\n` +
                `.autotyping group - Toggle for groups\n` +
                `.autotyping duration <ms> - Set duration`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        let newConfig = { ...config };
        let responseText = '';

        const toggle = parseToggleCommand(action);
        if (toggle === 'on') {
            newConfig.enabled = true;
            responseText = `*${botName}*\nAutotyping ENABLED`;
        } else if (toggle === 'off') {
            newConfig.enabled = false;
            responseText = `*${botName}*\nAutotyping DISABLED`;
        } else if (action === 'pm') {
            newConfig.pm = !newConfig.pm;
            responseText = `*${botName}*\nAutotyping for PMs: ${newConfig.pm ? 'ON' : 'OFF'}`;
        } else if (action === 'group') {
            newConfig.group = !newConfig.group;
            responseText = `*${botName}*\nAutotyping for Groups: ${newConfig.group ? 'ON' : 'OFF'}`;
        } else if (action === 'duration' && args[1]) {
            const duration = parseInt(args[1]);
            if (duration >= 1000 && duration <= 10000) {
                newConfig.duration = duration;
                responseText = `*${botName}*\nTyping duration set to ${duration}ms`;
            } else {
                responseText = `*${botName}*\nDuration must be 1000-10000ms`;
            }
        } else {
            responseText = `*${botName}*\nInvalid command! Use: on, off, pm, group, duration`;
        }

        if (responseText && !responseText.includes('Invalid') && !responseText.includes('must be')) {
            setOwnerConfig('autotyping', newConfig);
        }

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
    } catch (error) {
        console.error('Error in autotyping command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

function isAutotypingEnabled() {
    const config = getOwnerConfig('autotyping');
    return config?.enabled || false;
}

async function handleAutotypingForMessage(sock, chatId, message) {
    try {
        const config = getOwnerConfig('autotyping');
        if (!config?.enabled) return;
        
        const isGroup = chatId.endsWith('@g.us');
        if (isGroup && !config.group) return;
        if (!isGroup && !config.pm) return;
        
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
    } catch (error) {
        console.error('Autotyping error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function handleAutotypingForCommand(sock, chatId) {
    try {
        const config = getOwnerConfig('autotyping');
        if (!config?.enabled) return;
        
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, config.duration || 3000));
    } catch (error) {
        console.error('Autotyping error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function showTypingAfterCommand(sock, chatId) {
    try {
        const config = getOwnerConfig('autotyping');
        if (!config?.enabled) return;
        
        await sock.sendPresenceUpdate('paused', chatId);
    } catch (error) {
        console.error('Autotyping error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    autotypingCommand,
    isAutotypingEnabled,
    handleAutotypingForMessage,
    handleAutotypingForCommand,
    showTypingAfterCommand
};
