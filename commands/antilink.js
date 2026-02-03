const { getGroupConfig, setGroupConfig, parseToggleCommand, parseActionCommand } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

// Update the getAntilink and setAntilink functions to use database
async function getAntilink(chatId) {
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

async function setAntilink(chatId, subCmd, action) {
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

        const config = getAntilink(chatId);
        if (!config) return;
        if (!config.enabled) return;

        const antilinkMode = config.action || 'delete';
        if (antilinkMode === 'off') return;

        // Check bot admin status and user admin status like antibadword does
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const bot = groupMetadata.participants.find(p => p.id === botId);
            if (!bot?.admin) return;

            const participant = groupMetadata.participants.find(p => p.id === sender);
            if (participant?.admin) return;
            if (db.isSudo(sender)) return;
        } catch (err) {
            console.error('Error checking group metadata:', err);
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
            text: `┌─❖\n│「 ANTI-LINK 」\n└┬❖\n   │✑ @${username}, no links allowed!\n   │✑ Message deleted.\n   └───────────────┈ ⳹`,
            mentions: [sender],
        });

        if (antilinkMode === 'kick' || antilinkMode === 'remove') {
            try {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await sock.sendMessage(chatId, {
                    text: `┌─❖\n│「 ANTI-LINK 」\n└┬❖\n   │✑ @${username} kicked for links.\n   └───────────────┈ ⳹`,
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

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const args = userMessage.split(' ');
        const subCmd = args[1]?.toLowerCase();
        const prefix = getPrefix();
        const botName = getBotName();

        // Check admin permissions like antibadword does
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === senderId);
            if (!participant?.admin && !message.key.fromMe && !db.isSudo(senderId)) {
                const fake = createFakeContact(senderId);
                return sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAdmin only command!` 
                }, { quoted: fake });
            }
        } catch (err) {
            console.error('Error checking admin status:', err);
            const fake = createFakeContact(senderId);
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nError checking permissions!` 
            }, { quoted: fake });
        }

        const fake = createFakeContact(senderId);

        if (!subCmd || subCmd === 'help') {
            await sock.sendMessage(chatId, {
                text: `*${botName} ANTI-LINK*\n\n` +
                     `Usage:\n` +
                     `• ${prefix}antilink on - Enable anti-link\n` +
                     `• ${prefix}antilink off - Disable anti-link\n` +
                     `• ${prefix}antilink delete - Delete links only\n` +
                     `• ${prefix}antilink kick - Kick users who send links\n` +
                     `• ${prefix}antilink status - Check status\n` +
                     `• ${prefix}antilink help - Show this help`
            }, { quoted: fake });
            return;
        }

        if (subCmd === 'status') {
            const config = getAntilink(chatId);
            if (!config) {
                await sock.sendMessage(chatId, {
                    text: `*${botName} ANTI-LINK STATUS*\n\n` +
                         `Status: ❌ Disabled\n` +
                         `Action: delete`
                }, { quoted: fake });
                return;
            }
            
            const status = config.enabled ? '✅ Enabled' : '❌ Disabled';
            const action = config.action || 'delete';
            
            await sock.sendMessage(chatId, {
                text: `*${botName} ANTI-LINK STATUS*\n\n` +
                     `Status: ${status}\n` +
                     `Action: ${action}`
            }, { quoted: fake });
            return;
        }

        // Use enhanced command parsing
        const parsedAction = parseActionCommand(subCmd);
        const parsedToggle = parseToggleCommand(subCmd);
        
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
                text: `*${botName}*\nInvalid option! Use: on, off, delete, kick, status, or help`
            }, { quoted: fake });
            return;
        }

        // Use the setAntilink function
        const action = actionToSet === 'on' ? 'delete' : (actionToSet === 'off' ? 'off' : actionToSet);
        const enabled = actionToSet !== 'off';
        
        const success = setAntilink(chatId, actionToSet, action);
        
        if (success) {
            const actionText = action === 'kick' ? 'Delete + Kick User' : 
                              action === 'delete' ? 'Delete Message Only' : 'Disabled';
            
            await sock.sendMessage(chatId, {
                text: `*${botName} ANTI-LINK*\n\n` +
                     `✅ Anti-link ${enabled ? 'enabled' : 'disabled'}!\n` +
                     `Mode: ${actionText}`
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nFailed to configure anti-link!`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Error in handleAntilinkCommand:', error);
        const fake = createFakeContact(message?.key?.participant);
        const botName = getBotName();
        try {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nFailed to configure anti-link!` 
            }, { quoted: fake });
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