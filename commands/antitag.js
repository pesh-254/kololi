const { getGroupConfig, setGroupConfig, deleteGroupToggle } = require('../Database/settingsStore');
const isAdmin = require('../lib/isAdmin');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const { getPrefix } = require('./setprefix');

const antitagStats = new Map();

// Silent error logging - only for debugging
const silentLog = (...args) => {
    // Uncomment for debugging only
    // console.log('[ANTITAG DEBUG]', ...args);
};

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
        // Silent error handling - don't log to console
        // Only log critical errors
        if (!error.message.includes('timeout') && 
            !error.message.includes('conn') && 
            !error.message.includes('socket')) {
            silentLog('Command error:', error.message);
        }
    }
}

async function handleTagDetection(sock, message) {
    try {
        // COMPREHENSIVE VALIDATION - Silent return on invalid data
        if (!message || typeof message !== 'object') {
            return false;
        }
        
        if (!message.key || typeof message.key !== 'object') {
            return false;
        }
        
        const chatId = message.key.remoteJid;
        if (!chatId || typeof chatId !== 'string') {
            return false;
        }
        
        // Only process group messages
        if (!chatId.endsWith('@g.us')) return false;
        
        const senderId = message.key.participant || message.key.remoteJid;
        if (!senderId || typeof senderId !== 'string') {
            return false;
        }

        // Check if message has content
        if (!message.message || typeof message.message !== 'object') {
            return false;
        }

        // Get antitag config
        const config = getGroupConfig(chatId, 'antitag');
        if (!config || !config.enabled) return false;

        // Check admin status - silent handling
        let isSenderAdmin = false;
        let isBotAdmin = false;
        try {
            const adminResult = await isAdmin(sock, chatId, senderId);
            if (adminResult && typeof adminResult === 'object') {
                isSenderAdmin = adminResult.isSenderAdmin || false;
                isBotAdmin = adminResult.isBotAdmin || false;
            }
        } catch (adminError) {
            // Silent failure - just return
            return false;
        }

        if (!isBotAdmin || isSenderAdmin || db.isSudo(senderId)) {
            return false;
        }

        // Check for mentions safely
        let mentions = [];
        try {
            if (message.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                mentions = message.message.extendedTextMessage.contextInfo.mentionedJid;
                
                // Ensure mentions is an array
                if (!Array.isArray(mentions)) {
                    mentions = [];
                }
            }
        } catch (e) {
            mentions = [];
        }

        // Only act on mass tagging (5+ mentions)
        if (mentions.length < 5) return false;

        const botName = getBotName();
        const userTag = `@${senderId.split("@")[0]}`;

        // Try to delete the message - silent failure
        try {
            if (message.key.id) {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: message.key.id,
                        participant: senderId
                    }
                });
            }
        } catch (deleteError) {
            // Silent delete failure - continue with action
        }

        // Update stats
        const stats = antitagStats.get(chatId) || { blocked: 0 };
        stats.blocked++;
        antitagStats.set(chatId, stats);

        // Take action based on config
        try {
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
        } catch (actionError) {
            // Silent action failure
            return false;
        }

        return true;
    } catch (error) {
        // COMPLETELY SILENT ERROR HANDLING
        // No console.log at all - just return false
        return false;
    }
}

// Keep detectTagall for backward compatibility
async function detectTagall(sock, chatId, message, senderId) {
    try {
        // Same comprehensive validation
        if (!chatId || !chatId.endsWith('@g.us')) return false;

        const config = getGroupConfig(chatId, 'antitag');
        if (!config || !config.enabled) return false;

        // Check admin status silently
        let isSenderAdmin = false;
        let isBotAdmin = false;
        try {
            const adminResult = await isAdmin(sock, chatId, senderId);
            if (adminResult && typeof adminResult === 'object') {
                isSenderAdmin = adminResult.isSenderAdmin || false;
                isBotAdmin = adminResult.isBotAdmin || false;
            }
        } catch (adminError) {
            return false;
        }

        if (!isBotAdmin || isSenderAdmin || db.isSudo(senderId)) return false;

        // Safe mention extraction
        let mentions = [];
        try {
            if (message?.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                mentions = message.message.extendedTextMessage.contextInfo.mentionedJid;
                if (!Array.isArray(mentions)) mentions = [];
            }
        } catch (e) {
            mentions = [];
        }

        if (mentions.length < 5) return false;

        const botName = getBotName();
        const userTag = `@${senderId.split("@")[0]}`;

        // Try to delete silently
        try {
            if (message?.key?.id) {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: message.key.id,
                        participant: senderId
                    }
                });
            }
        } catch (e) {
            // Silent delete failure
        }

        // Update stats
        const stats = antitagStats.get(chatId) || { blocked: 0 };
        stats.blocked++;
        antitagStats.set(chatId, stats);

        // Take action
        try {
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
        } catch (actionError) {
            return false;
        }

        return true;
    } catch (error) {
        // COMPLETELY SILENT - no logging
        return false;
    }
}

module.exports = {
    handleAntitagCommand,
    handleTagDetection,
    detectTagall,
    antitagStats
};