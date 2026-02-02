const { getGroupConfig, setGroupConfig, deleteGroupToggle } = require('../Database/settingsStore');
const isAdmin = require('../lib/isAdmin');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const { getPrefix } = require('./setprefix');

const antitagStats = new Map();

async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        const prefix = getPrefix();
        
        if (!isSenderAdmin && !message?.key?.fromMe && !db.isSudo(senderId)) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nAdmin only command!` }, { quoted: fake });
            return;
        }

        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const config = getGroupConfig(chatId, 'antitag') || { enabled: false };
            const currentAction = config.enabled ? (config.action || 'delete') : 'off';
            const usage = `*${botName} ANTITAG*\n\nStatus: ${config.enabled ? 'ON' : 'OFF'}\nAction: ${currentAction}\n\n*Commands:*\n${prefix}antitag on - Enable\n${prefix}antitag off - Disable\n${prefix}antitag set delete|kick - Set action\n${prefix}antitag stats - View stats`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = getGroupConfig(chatId, 'antitag');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: `*${botName}*\nAntitag already ON!` }, { quoted: fake });
                    return;
                }
                setGroupConfig(chatId, 'antitag', { enabled: true, action: 'delete' });
                await sock.sendMessage(chatId, { text: `*${botName}*\nAntitag ENABLED` }, { quoted: fake });
                break;

            case 'off':
                deleteGroupToggle(chatId, 'antitag');
                await sock.sendMessage(chatId, { text: `*${botName}*\nAntitag DISABLED` }, { quoted: fake });
                break;

            case 'set':
                const mode = args[1];
                if (!mode || !['delete', 'kick'].includes(mode)) {
                    await sock.sendMessage(chatId, { text: `*${botName}*\nUse: ${prefix}antitag set delete|kick` }, { quoted: fake });
                    return;
                }
                setGroupConfig(chatId, 'antitag', { enabled: true, action: mode });
                await sock.sendMessage(chatId, { text: `*${botName}*\nAntitag action: ${mode.toUpperCase()}` }, { quoted: fake });
                break;

            case 'stats':
                const stats = antitagStats.get(chatId) || { blocked: 0 };
                await sock.sendMessage(chatId, {
                    text: `*${botName} ANTITAG STATS*\n\nBlocked: ${stats.blocked} tagalls`
                }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { text: `*${botName}*\nUnknown option!` }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in handleAntitagCommand:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

async function detectTagall(sock, chatId, message, senderId) {
    try {
        if (!chatId.endsWith('@g.us')) return;

        const config = getGroupConfig(chatId, 'antitag');
        if (!config || !config.enabled) return;

        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin || isSenderAdmin || db.isSudo(senderId)) return;

        const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentions.length < 5) return;

        const botName = getBotName();
        const userTag = `@${senderId.split("@")[0]}`;

        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: message.key.id,
                    participant: senderId
                }
            });
        } catch (e) {
            console.error("[ANTITAG] Delete failed:", e.message);
            return;
        }

        const stats = antitagStats.get(chatId) || { blocked: 0 };
        stats.blocked++;
        antitagStats.set(chatId, stats);

        if (config.action === 'kick') {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n\n${userTag} kicked for mass tagging!`,
                mentions: [senderId]
            });
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
        } else {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n\n${userTag}, mass tagging is not allowed!`,
                mentions: [senderId]
            });
        }
    } catch (error) {
        console.error('Error in detectTagall:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    handleAntitagCommand,
    detectTagall,
    antitagStats
};
