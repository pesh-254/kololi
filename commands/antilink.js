const isAdmin = require('../lib/isAdmin');
const { getPrefix } = require('./setprefix');
const settings = require('../Database/settingsStore');

// Use the existing getGroupConfig/setGroupConfig from settingsStore
async function getAntilink(chatId) {
    try {
        const config = settings.getGroupConfig(chatId, 'antilink');
        if (config && typeof config === 'object') {
            return {
                enabled: Boolean(config.enabled),
                action: config.action || 'delete'
            };
        }
        return { enabled: false, action: 'delete' };
    } catch (error) {
        console.error('Error getting antilink config:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function setAntilink(chatId, subCmd) {
    try {
        let enabled = true;
        let action = 'delete';
        
        switch(subCmd.toLowerCase()) {
            case 'on':
                enabled = true;
                action = 'delete';
                break;
            case 'off':
                enabled = false;
                action = 'off';
                break;
            case 'delete':
                enabled = true;
                action = 'delete';
                break;
            case 'kick':
            case 'remove':
                enabled = true;
                action = 'kick';
                break;
            default:
                return false;
        }
        
        const config = { enabled, action };
        settings.setGroupConfig(chatId, 'antilink', config);
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}

async function removeAntilink(chatId) {
    try {
        settings.deleteGroupToggle(chatId, 'antilink');
        return true;
    } catch (error) {
        console.error('Error removing antilink config:', error);
        return false;
    }
}

async function handleAntiLinkDetection(sock, m) {
    try {
        if (!m?.message) return;
        if (m.key.fromMe) return;
        if (!m.key.remoteJid?.endsWith('@g.us')) return;

        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        const config = await getAntilink(chatId);
        if (!config.enabled) return;
        if (config.action === 'off') return;

        const adminStatus = await isAdmin(sock, chatId, sender);
        if (adminStatus.isSenderAdmin) return;
        
        const db = require('../Database/database');
        if (db.isSudo(sender)) return;
        
        if (!adminStatus.isBotAdmin) return;

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

        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|bit\.ly\/[^\s]+|t\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        if (!urlRegex.test(String(text).toLowerCase())) return;

        // Delete the message
        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: m.key.id,
                    participant: sender,
                },
            });
        } catch (deleteError) {
            console.error('Failed to delete message:', deleteError);
        }

        const username = sender.split('@')[0];
        await sock.sendMessage(chatId, {
            text: `┌─❖\n│「 ANTI-LINK 」\n└┬❖\n   │✑ @${username}, no links allowed!\n   │✑ Message deleted.\n   └───────────────┈ ⳹`,
            mentions: [sender],
        });

        if (config.action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await sock.sendMessage(chatId, {
                    text: `┌─❖\n│「 ANTI-LINK 」\n└┬❖\n   │✑ @${username} kicked for sending links.\n   └───────────────┈ ⳹`,
                    mentions: [sender],
                });
            } catch (err) {
                console.error('Failed to kick user:', err);
                await sock.sendMessage(chatId, {
                    text: `┌─❖\n│「 ANTI-LINK 」\n└┬❖\n   │✑ Failed to kick @${username}\n   │✑ I need admin permissions!\n   └───────────────┈ ⳹`,
                    mentions: [sender],
                });
            }
        }
    } catch (err) {
        console.error('Error in handleAntiLinkDetection:', err);
    }
}

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        const args = userMessage.split(' ');
        const subCmd = args[1]?.toLowerCase();
        const prefix = getPrefix();

        if (!subCmd || subCmd === 'help') {
            await sock.sendMessage(chatId, {
                text: `┌─❖\n│「 ANTI-LINK 」\n├❖\n│  *Usage:*\n│  • ${prefix}antilink on - Enable anti-link\n│  • ${prefix}antilink off - Disable anti-link\n│  • ${prefix}antilink delete - Delete links only\n│  • ${prefix}antilink kick - Kick users who send links\n│  • ${prefix}antilink status - Check status\n│  • ${prefix}antilink help - Show this help\n└───────────────┈ ⳹`
            });
            return;
        }

        if (subCmd === 'status') {
            const config = await getAntilink(chatId);
            const status = config.enabled ? '✅ Enabled' : '❌ Disabled';
            const action = config.action || 'delete';
            
            await sock.sendMessage(chatId, {
                text: `┌─❖\n│「 ANTI-LINK STATUS 」\n├❖\n│  Status: ${status}\n│  Action: ${action}\n│  Group: ${chatId}\n└───────────────┈ ⳹`
            });
            return;
        }

        // Check permissions
        const db = require('../Database/database');
        if (!isSenderAdmin && !db.isSudo(senderId)) {
            await sock.sendMessage(chatId, {
                text: `┌─❖\n│「 ANTI-LINK 」\n├❖\n│  For Group Admins Only!\n└───────────────┈ ⳹`
            });
            return;
        }

        // Use the parseActionCommand from settingsStore for better command parsing
        const parsedAction = settings.parseActionCommand(subCmd);
        const parsedToggle = settings.parseToggleCommand(subCmd);
        
        let actionToSet = subCmd;
        if (parsedAction) {
            actionToSet = parsedAction;
        } else if (parsedToggle === 'on') {
            actionToSet = 'on';
        } else if (parsedToggle === 'off') {
            actionToSet = 'off';
        }

        const validActions = ['on', 'off', 'delete', 'kick'];
        if (!validActions.includes(actionToSet)) {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid option! Use: on, off, delete, kick, status, or help'
            });
            return;
        }

        const success = await setAntilink(chatId, actionToSet);
        
        if (success) {
            const action = actionToSet === 'on' ? 'delete' : (actionToSet === 'off' ? 'off' : actionToSet);
            const enabled = actionToSet !== 'off';
            
            const actionText = action === 'kick' ? 'Delete + Kick User' : 
                              action === 'delete' ? 'Delete Message Only' : 'Disabled';
            
            await sock.sendMessage(chatId, {
                text: `┌─❖\n│「 ANTI-LINK 」\n├❖\n│  ✅ Anti-link ${enabled ? 'enabled' : 'disabled'}!\n│  Mode: ${actionText}\n└───────────────┈ ⳹`
            });
        } else {
            await sock.sendMessage(chatId, {
                text: '❌ Failed to configure anti-link!'
            });
        }

    } catch (error) {
        console.error('Error in handleAntilinkCommand:', error);
        try {
            await sock.sendMessage(chatId, {
                text: '❌ Failed to configure anti-link!'
            });
        } catch (err) {
            console.error('Failed to send error message:', err);
        }
    }
}

module.exports = {
    handleAntiLinkDetection,
    handleAntilinkCommand,
    getAntilink,
    setAntilink,
    removeAntilink
};