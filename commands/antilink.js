const { getGroupConfig, setGroupConfig, parseToggleCommand, parseActionCommand } = require('../Database/settingsStore');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const isAdmin = require('../lib/isAdmin');

async function handleAntiLinkDetection(sock, m) {
    try {
        console.log('[ANTILINK] Processing message...');
        
        if (!m?.message) return;
        if (m.key.fromMe) return;
        if (!m.key.remoteJid?.endsWith('@g.us')) return;

        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        const config = getGroupConfig(chatId, 'antilink');
        
        console.log(`[ANTILINK] Config for ${chatId}:`, config);
        
        if (!config) {
            console.log(`[ANTILINK] No config found for ${chatId}`);
            return;
        }
        
        if (!config.enabled) {
            console.log(`[ANTILINK] Antilink disabled for ${chatId}`);
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, sender);
        if (adminStatus.isSenderAdmin) {
            console.log(`[ANTILINK] Sender is admin, skipping`);
            return;
        }
        
        if (!adminStatus.isBotAdmin) {
            console.log(`[ANTILINK] Bot is not admin, cannot delete messages`);
            return;
        }

        let text = "";
        if (m.message.conversation) {
            text = m.message.conversation;
        } else if (m.message.extendedTextMessage?.text) {
            text = m.message.extendedTextMessage.text;
        } else if (m.message.imageMessage?.caption) {
            text = m.message.imageMessage.caption;
        } else if (m.message.videoMessage?.caption) {
            text = m.message.videoMessage.caption;
        } else if (m.message.documentMessage?.caption) {
            text = m.message.documentMessage.caption;
        }

        console.log(`[ANTILINK] Extracted text: "${text}"`);
        
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|bit\.ly\/[^\s]+|t\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        const hasLink = urlRegex.test(String(text).toLowerCase());
        
        console.log(`[ANTILINK] Has link? ${hasLink}`);
        
        if (!hasLink) return;

        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: m.key.id,
                    participant: sender,
                },
            });
            console.log(`[ANTILINK] Message deleted`);
        } catch (deleteErr) {
            console.error(`[ANTILINK] Failed to delete message:`, deleteErr.message);
        }

        const username = sender.split('@')[0];
        const action = config.action || 'delete';
        const maxWarnings = config.maxWarnings || 3;

        const botName = getBotName();
        const fake = createFakeContact(sender);

        switch (action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\n@${username}, no links allowed!\nMessage deleted.`,
                    mentions: [sender],
                }, { quoted: fake });
                console.log(`[ANTILINK] Sent delete warning`);
                break;

            case 'warn':
                // For now, use simple warning count. You can implement db.incrementWarning later
                const warningCount = 1; // Temporary - implement your own warning system
                console.log(`[ANTILINK] Warning count: ${warningCount}/${maxWarnings}`);
                
                if (warningCount >= maxWarnings) {
                    try {
                        await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                        await sock.sendMessage(chatId, {
                            text: `*${botName}*\n@${username} kicked after ${maxWarnings} warnings!\nLinks not allowed.`,
                            mentions: [sender],
                        }, { quoted: fake });
                        console.log(`[ANTILINK] User kicked after warnings`);
                    } catch (kickErr) {
                        console.error(`[ANTILINK] Failed to kick user:`, kickErr.message);
                    }
                } else {
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\n@${username}, no links allowed!\nWarning ${warningCount}/${maxWarnings}`,
                        mentions: [sender],
                    }, { quoted: fake });
                    console.log(`[ANTILINK] Sent warning`);
                }
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\n@${username} kicked for posting links.`,
                        mentions: [sender],
                    }, { quoted: fake });
                    console.log(`[ANTILINK] User kicked`);
                } catch (err) {
                    console.error('[ANTILINK] Failed to kick user:', err.message);
                }
                break;
        }
    } catch (err) {
        console.error('[ANTILINK] Error in handleAntiLinkDetection:', err.message);
    }
}

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        console.log(`[ANTILINK CMD] Command received: ${userMessage}`);
        
        const text = message?.message?.conversation || 
                    message?.message?.extendedTextMessage?.text || userMessage;
        
        const args = text.trim().split(/\s+/);
        const subCmd = args[1]?.toLowerCase();
        const botName = getBotName();

        // Admin check - FIXED: Removed db.isSudo reference
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === senderId);
            
            // Check if sender is admin OR if message is from bot itself
            if (!participant?.admin && message && !message.key.fromMe) {
                const fake = createFakeContact(senderId);
                await sock.sendMessage(chatId, { 
                    text: `*${botName}*\n❌ Admin only command!` 
                }, { quoted: fake });
                return;
            }
        } catch (adminErr) {
            console.error('[ANTILINK CMD] Admin check failed:', adminErr.message);
            // If admin check fails, still try to proceed but log the error
        }

        const fake = createFakeContact(senderId);
        const config = getGroupConfig(chatId, 'antilink') || { 
            enabled: false, 
            action: 'delete', 
            maxWarnings: 3 
        };

        console.log(`[ANTILINK CMD] Current config:`, config);

        if (!subCmd || subCmd === 'help') {
            const helpText = `*${botName} ANTILINK*\n\n` +
                            `Status: ${config.enabled ? '✅ ON' : '❌ OFF'}\n` +
                            `Action: ${config.action || 'delete'}\n` +
                            `Max Warnings: ${config.maxWarnings || 3}\n\n` +
                            `*Commands:*\n` +
                            `.antilink on - Enable\n` +
                            `.antilink off - Disable\n` +
                            `.antilink delete - Delete only\n` +
                            `.antilink warn - Warn (max = kick)\n` +
                            `.antilink kick - Delete & kick\n` +
                            `.antilink setwarn <num> - Set max warnings\n` +
                            `.antilink status - Show status`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        if (subCmd === 'status') {
            const status = config.enabled ? '✅ Enabled' : '❌ Disabled';
            const action = config.action || 'delete';

            await sock.sendMessage(chatId, {
                text: `*${botName} ANTILINK STATUS*\n\nStatus: ${status}\nAction: ${action}\nMax Warnings: ${config.maxWarnings || 3}`
            }, { quoted: fake });
            return;
        }

        if (subCmd === 'setwarn') {
            const num = parseInt(args[2]);
            if (num > 0 && num <= 10) {
                const newConfig = { ...config, maxWarnings: num };
                setGroupConfig(chatId, 'antilink', newConfig);
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\n✅ Max warnings set to: ${num}`
                }, { quoted: fake });
            } else {
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\n❌ Invalid number! Use 1-10`
                }, { quoted: fake });
            }
            return;
        }

        let newConfig = { ...config };
        let responseText = '';

        // Simplified toggle parsing
        if (subCmd === 'on') {
            newConfig.enabled = true;
            newConfig.action = newConfig.action || 'delete';
            responseText = `*${botName}*\n✅ AntiLink ENABLED\nAction: ${newConfig.action}`;
        } else if (subCmd === 'off') {
            newConfig.enabled = false;
            responseText = `*${botName}*\n❌ AntiLink DISABLED`;
        } else if (subCmd === 'delete') {
            newConfig.action = 'delete';
            newConfig.enabled = true;
            responseText = `*${botName}*\n✅ Action: DELETE\nLinks will be deleted.`;
        } else if (subCmd === 'warn') {
            newConfig.action = 'warn';
            newConfig.enabled = true;
            responseText = `*${botName}*\n✅ Action: WARN\n${newConfig.maxWarnings || 3} warnings = kick.`;
        } else if (subCmd === 'kick') {
            newConfig.action = 'kick';
            newConfig.enabled = true;
            responseText = `*${botName}*\n✅ Action: KICK\nLink senders will be removed.`;
        } else {
            responseText = `*${botName}*\n❌ Invalid option!\nUse: on, off, delete, warn, kick, setwarn, status, help`;
        }

        if (responseText && !responseText.includes('Invalid')) {
            console.log(`[ANTILINK CMD] Saving config:`, newConfig);
            setGroupConfig(chatId, 'antilink', newConfig);
            await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
        } else if (responseText.includes('Invalid')) {
            await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
        }

    } catch (error) {
        console.error('[ANTILINK CMD] Error:', error.message);
        console.error('[ANTILINK CMD] Stack:', error.stack);
        
        try {
            const botName = getBotName();
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Failed to configure antilink!\nError: ${error.message}`
            });
        } catch (sendErr) {
            console.error('[ANTILINK CMD] Failed to send error message:', sendErr.message);
        }
    }
}

// Backward compatibility functions
async function getAntilink(groupId) {
    const config = getGroupConfig(groupId, 'antilink');
    return config || { enabled: false, action: 'delete', maxWarnings: 3 };
}

async function setAntilink(groupId, type, action) {
    const config = {
        enabled: type === 'on' || type === 'delete' || type === 'kick' || type === 'warn',
        action: action || 'delete',
        maxWarnings: 3
    };
    
    setGroupConfig(groupId, 'antilink', config);
    return true;
}

module.exports = {
    handleAntiLinkDetection,
    handleAntilinkCommand,
    getAntilink,
    setAntilink
};