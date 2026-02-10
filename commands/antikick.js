const { getGroupConfig, setGroupConfig, parseToggleCommand } = require('../Database/settingsStore');
const db = require('../Database/database');
const isAdmin = require('../lib/isAdmin');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

function participantToString(p) {
    if (typeof p === 'string') return p;
    if (p && p.id) return p.id;
    return String(p);
}

async function antikickCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!isSenderAdmin && !message.key.fromMe && !db.isSudo(senderId)) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nAdmin only command!` }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        const config = getGroupConfig(chatId, 'antikick') || { enabled: false };

        if (!action) {
            const helpText = `*${botName} ANTIKICK*\n\n` +
                `Status: ${config.enabled ? 'ON' : 'OFF'}\n\n` +
                `*Commands:*\n` +
                `.antikick on - Enable\n` +
                `.antikick off - Disable\n` +
                `.antikick status - Show status`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        let responseText = '';

        if (action === 'status') {
            responseText = `*${botName}*\nAntikick: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}`;
        } else {
            const toggle = parseToggleCommand(action);
            if (toggle === 'on') {
                setGroupConfig(chatId, 'antikick', { enabled: true });
                responseText = `*${botName}*\nAntikick ENABLED\nRemoved members will be re-added.`;
            } else if (toggle === 'off') {
                setGroupConfig(chatId, 'antikick', { enabled: false });
                responseText = `*${botName}*\nAntikick DISABLED`;
            } else {
                responseText = `*${botName}*\nInvalid command! Use: on, off, status`;
            }
        }

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
    } catch (error) {
        console.error('Error in antikick command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function handleAntikick(sock, chatId, participants) {
    try {
        const config = getGroupConfig(chatId, 'antikick');
        if (!config?.enabled) return;

        const botName = getBotName();
        const fake = createFakeContact();
        
        for (const participant of participants) {
            try {
                const participantJid = participantToString(participant);
                await sock.groupParticipantsUpdate(chatId, [participantJid], 'add');
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\n@${participantJid.split('@')[0]} was re-added by antikick.`,
                    mentions: [participantJid]
                }, { quoted: fake });
            } catch (addError) {
                console.error('Antikick re-add failed:', addError.message);
            }
        }
    } catch (error) {
        console.error('Error in antikick handler:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

function getGroupConfigExport(chatId) {
    return getGroupConfig(chatId, 'antikick') || { enabled: false };
}

module.exports = {
    antikickCommand,
    handleAntikick,
    getGroupConfig: getGroupConfigExport
};
