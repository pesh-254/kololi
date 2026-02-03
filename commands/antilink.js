const isAdmin = require('../lib/isAdmin');
const { getPrefix } = require('./setprefix');
const { getGroupConfig, setGroupConfig, parseToggleCommand, parseActionCommand } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

// Keep the same function signatures but make them synchronous
function getAntilink(chatId) {
    try {
        const config = getGroupConfig(chatId, 'antilink');
        if (config && typeof config === 'object') {
            return {
                enabled: Boolean(config.enabled),
                action: config.action || 'delete'
            };
        }
        // Return default values if no config found
        return { enabled: false, action: 'delete' };
    } catch (error) {
        console.error('Error getting antilink config:', error);
        return { enabled: false, action: 'delete' };
    }
}

function setAntilink(chatId, subCmd, action) {
    try {
        let enabled = true;
        let finalAction = 'delete';
        
        if (!action) {
            // Handle the old style: subCmd determines everything
            switch(subCmd.toLowerCase()) {
                case 'on':
                    enabled = true;
                    finalAction = 'delete';
                    break;
                case 'off':
                    enabled = false;
                    finalAction = 'off';
                    break;
                case 'delete':
                    enabled = true;
                    finalAction = 'delete';
                    break;
                case 'kick':
                case 'remove':
                    enabled = true;
                    finalAction = 'kick';
                    break;
                default:
                    return false;
            }
        } else {
            // New style: action is provided
            enabled = !(subCmd === 'off');
            finalAction = action;
        }
        
        const config = { enabled, action: finalAction };
        setGroupConfig(chatId, 'antilink', config);
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error);
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

        const config = getAntilink(chatId); // REMOVED AWAIT
        // Fix: Handle null return by providing default values
        if (!config) return;
        if (!config.enabled) return;

        const antilinkMode = config.action || 'delete';
        if (antilinkMode === 'off') return;

        const adminStatus = await isAdmin(sock, chatId, sender);
        if (adminStatus.isSenderAdmin) return;
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

        await sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                fromMe: false,
                id: m.key.id,
                participant: sender,
            },
        });

        const username = sender.split('@')[0];
        await sock.sendMessage(chatId, {
            text: `┌─❖\n│「 DAVE-X Antilink 」\n└┬❖\n   │✑ @${username}, no links allowed!\n   │✑ Message deleted.\n   └───────────────┈ ⳹`,
            mentions: [sender],
        });

        if (antilinkMode === 'kick' || antilinkMode === 'remove') {
            try {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await sock.sendMessage(chatId, {
                    text: `┌─❖\n│「 DAVE-X 」\n└┬❖\n   │✑ @${username} kicked for links.\n   └───────────────┈ ⳹`,
                    mentions: [sender],
                });
            } catch (err) {
                console.error('Failed to kick user:', err);
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
                text: `┌─❖\n│「 DAVE-X Anti-Link 」\n├❖\n│  *Usage:*\n│  • ${prefix}antilink on - Enable anti-link\n│  • ${prefix}antilink off - Disable anti-link\n│  • ${prefix}antilink delete - Delete links only\n│  • ${prefix}antilink kick - Kick users who send links\n│  • ${prefix}antilink status - Check status\n│  • ${prefix}antilink help - Show this help\n└───────────────┈ ⳹`
            });
            return;
        }

        if (subCmd === 'status') {
            const config = getAntilink(chatId); // REMOVED AWAIT
            // Fix: Handle null config
            if (!config) {
                await sock.sendMessage(chatId, {
                    text: `┌─❖\n│「 DAVE-X Anti-Link Status 」\n├❖\n│  Status: ❌ Disabled\n│  Action: delete\n└───────────────┈ ⳹`
                });
                return;
            }
            
            const status = config.enabled ? '✅ Enabled' : '❌ Disabled';
            const action = config.action || 'delete';
            
            await sock.sendMessage(chatId, {
                text: `┌─❖\n│「 DAVE-X Anti-Link Status 」\n├❖\n│  Status: ${status}\n│  Action: ${action}\n└───────────────┈ ⳹`
            });
            return;
        }

        const validActions = ['on', 'off', 'delete', 'kick', 'remove'];
        if (!validActions.includes(subCmd)) {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid option! Use: on, off, delete, kick, status, or help'
            });
            return;
        }

        // Use the setAntilink function
        const action = subCmd === 'on' ? 'delete' : (subCmd === 'off' ? 'off' : subCmd);
        const enabled = subCmd === 'on' || subCmd === 'delete' || subCmd === 'kick' || subCmd === 'remove';
        
        const success = setAntilink(chatId, subCmd, action); // REMOVED AWAIT
        
        if (success) {
            await sock.sendMessage(chatId, {
                text: `┌─❖\n│「 DAVE-X Anti-Link 」\n├❖\n│  ✅ Anti-link ${enabled ? 'enabled' : 'disabled'}!\n│  Action: ${action}\n└───────────────┈ ⳹`
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
    setAntilink
};