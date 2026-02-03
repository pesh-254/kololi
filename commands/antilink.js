const { getGroupConfig, setGroupConfig, deleteGroupToggle } = require('../Database/settingsStore');
const { getAntilink: getAntilinkSetting, incrementWarningCount, resetWarningCount } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const { getPrefix } = require('./setprefix');

// Use this function from your existing lib/antilink.js
const { containsURL } = require('../lib/antilink');

const WARN_COUNT = 3; // Default warning count

async function handleAntiLinkDetection(sock, message) {
    try {
        if (!message || !message.message) return;
        if (message.key.fromMe) return;
        if (!message.key.remoteJid?.endsWith('@g.us')) return;

        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // Get antilink config
        const config = getGroupConfig(chatId, 'antilink');
        if (!config || !config.enabled) return;

        // Check if bot is admin
        const { isBotAdmin } = await isAdmin(sock, chatId, sender);
        if (!isBotAdmin) return;

        // Check if sender is admin or sudo
        const { isSenderAdmin } = await isAdmin(sock, chatId, sender);
        if (isSenderAdmin || db.isSudo(sender)) return;

        // Extract message text
        let text = "";
        if (message.message.conversation) {
            text = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
            text = message.message.extendedTextMessage.text;
        } else if (message.message.imageMessage?.caption) {
            text = message.message.imageMessage.caption;
        } else if (message.message.videoMessage?.caption) {
            text = message.message.videoMessage.caption;
        } else if (message.message.documentMessage?.caption) {
            text = message.message.documentMessage.caption;
        }

        if (!containsURL(text.trim())) return;

        const botName = getBotName();
        const fake = createFakeContact(sender);

        // Delete the message
        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: message.key.id,
                    participant: sender,
                },
            });
        } catch (deleteError) {
            // Silent delete failure
        }

        const username = sender.split('@')[0];
        const action = config.action || 'delete';
        const maxWarnings = config.maxWarnings || WARN_COUNT;

        // Take action based on config
        switch (action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\n@${username}, links are not allowed here!\nMessage deleted.`,
                    mentions: [sender],
                }, { quoted: fake });
                break;

            case 'warn':
                // Initialize warnings for this group if not exists
                if (!global.antilinkWarnings[chatId]) {
                    global.antilinkWarnings[chatId] = {};
                }
                
                const currentWarnings = global.antilinkWarnings[chatId][sender] || 0;
                const newWarnings = currentWarnings + 1;
                global.antilinkWarnings[chatId][sender] = newWarnings;
                
                if (newWarnings >= maxWarnings) {
                    try {
                        await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                        delete global.antilinkWarnings[chatId][sender];
                        await sock.sendMessage(chatId, {
                            text: `*${botName}*\n@${username} kicked after ${maxWarnings} warnings!\nLinks not allowed.`,
                            mentions: [sender],
                        }, { quoted: fake });
                    } catch (kickError) {
                        // Silent kick failure
                    }
                } else {
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\n@${username}, links are not allowed!\nWarning ${newWarnings}/${maxWarnings}`,
                        mentions: [sender],
                    }, { quoted: fake });
                }
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\n@${username} kicked for posting links.`,
                        mentions: [sender],
                    }, { quoted: fake });
                } catch (kickError) {
                    // Silent kick failure
                }
                break;
        }
    } catch (error) {
        // Silent error handling
        return;
    }
}

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const prefix = getPrefix();
        const botName = getBotName();
        const fake = createFakeContact(senderId);

        // Admin check - FIXED: message parameter is now passed
        if (!isSenderAdmin && message && !message.key?.fromMe && !db.isSudo(senderId)) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nAdmin only command!` 
            }, { quoted: fake });
            return;
        }

        // Parse command - remove prefix
        const cmdText = userMessage.trim();
        const args = cmdText.slice(prefix.length).trim().split(/\s+/);
        
        // First arg should be 'antilink'
        if (args[0]?.toLowerCase() !== 'antilink') {
            console.log(`[ANTILINK DEBUG] Command parsing failed. args[0] = ${args[0]}, userMessage = ${userMessage}`);
            return;
        }
        
        const action = args[1]?.toLowerCase();

        const config = getGroupConfig(chatId, 'antilink') || { 
            enabled: false, 
            action: 'delete', 
            maxWarnings: WARN_COUNT 
        };

        // Show help if no action
        if (!action || action === 'help') {
            const helpText = `*${botName} ANTILINK*\n\n` +
                            `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                            `Action: ${config.action || 'delete'}\n` +
                            `Max Warnings: ${config.maxWarnings || WARN_COUNT}\n\n` +
                            `*Commands:*\n` +
                            `${prefix}antilink on - Enable\n` +
                            `${prefix}antilink off - Disable\n` +
                            `${prefix}antilink delete - Delete only\n` +
                            `${prefix}antilink warn - Warn (max = kick)\n` +
                            `${prefix}antilink kick - Delete & kick\n` +
                            `${prefix}antilink setwarn <num> - Set max warnings\n` +
                            `${prefix}antilink status - Show status`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        console.log(`[ANTILINK DEBUG] Action received: ${action}, args: ${JSON.stringify(args)}`);

        // Handle different actions
        switch (action) {
            case 'status':
                const status = config.enabled ? 'Enabled' : 'Disabled';
                const actionType = config.action || 'delete';
                const maxWarn = config.maxWarnings || WARN_COUNT;
                
                await sock.sendMessage(chatId, {
                    text: `*${botName} ANTILINK STATUS*\n\n` +
                          `Status: ${status}\n` +
                          `Action: ${actionType}\n` +
                          `Max Warnings: ${maxWarn}`
                }, { quoted: fake });
                return;

            case 'setwarn':
                if (args.length < 3) {
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\nPlease specify a number: ${prefix}antilink setwarn 3`
                    }, { quoted: fake });
                    return;
                }
                
                const num = parseInt(args[2]);
                if (isNaN(num) || num < 1 || num > 10) {
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\nInvalid number! Use 1-10`
                    }, { quoted: fake });
                    return;
                }
                
                const newWarnConfig = { 
                    ...config, 
                    maxWarnings: num,
                    enabled: true 
                };
                setGroupConfig(chatId, 'antilink', newWarnConfig);
                
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nMax warnings set to: ${num}`
                }, { quoted: fake });
                return;

            case 'on':
                if (config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: `*${botName}*\nAntilink already ON!` 
                    }, { quoted: fake });
                    return;
                }
                
                const onConfig = { 
                    enabled: true, 
                    action: config.action || 'delete', 
                    maxWarnings: config.maxWarnings || WARN_COUNT 
                };
                setGroupConfig(chatId, 'antilink', onConfig);
                
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAntilink ENABLED\nAction: ${onConfig.action}` 
                }, { quoted: fake });
                return;

            case 'off':
                deleteGroupToggle(chatId, 'antilink');
                // Clear warnings for this group
                if (global.antilinkWarnings && global.antilinkWarnings[chatId]) {
                    delete global.antilinkWarnings[chatId];
                }
                
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAntilink DISABLED` 
                }, { quoted: fake });
                return;

            case 'delete':
                const deleteConfig = { 
                    enabled: true, 
                    action: 'delete', 
                    maxWarnings: config.maxWarnings || WARN_COUNT 
                };
                setGroupConfig(chatId, 'antilink', deleteConfig);
                
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAction: DELETE\nLinks will be deleted.` 
                }, { quoted: fake });
                return;

            case 'warn':
                const warnConfig = { 
                    enabled: true, 
                    action: 'warn', 
                    maxWarnings: config.maxWarnings || WARN_COUNT 
                };
                setGroupConfig(chatId, 'antilink', warnConfig);
                
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAction: WARN\n${warnConfig.maxWarnings} warnings = kick.` 
                }, { quoted: fake });
                return;

            case 'kick':
                const kickConfig = { 
                    enabled: true, 
                    action: 'kick', 
                    maxWarnings: config.maxWarnings || WARN_COUNT 
                };
                setGroupConfig(chatId, 'antilink', kickConfig);
                
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAction: KICK\nLink senders will be removed.` 
                }, { quoted: fake });
                return;

            default:
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\nInvalid option!\nUse: ${prefix}antilink help` 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Antilink command error:', error.message, error.stack);
    }
}

// Export functions
module.exports = {
    handleAntiLinkDetection,
    handleAntilinkCommand
};