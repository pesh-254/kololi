const { getOwnerConfig, setOwnerConfig } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

const originalMessages = new Map();
const MAX_STORED_MESSAGES = 10000;

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function antieditCommand(sock, chatId, message, senderId) {
    const botName = getBotName();
    const fake = createFakeContact(senderId);

    // ONLY OWNER CAN CONTROL ANTEDIT
    if (!await isAuthorized(sock, message)) {
        return sock.sendMessage(chatId, { 
            text: `*${botName}*\nOwner only command!` 
        }, { quoted: fake });
    }

    // Get message text
    const userMessage = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';
    
    // Parse command arguments
    const args = userMessage.trim().split(/\s+/);
    const command = args[1]?.toLowerCase(); // args[0] is "antiedit", args[1] is the action

    // Get GLOBAL config from owner settings
    const config = getOwnerConfig('antiedit') || { enabled: false, mode: 'private' };

    if (!command) {
        const text = `*${botName} ANTIEDIT*\n\n` +
                    `Status: ${config.enabled ? '✅ ON' : '❌ OFF'}\n` +
                    `Mode: ${config.mode || 'private'}\n` +
                    `Scope: GLOBAL (all chats)\n` +
                    `Tracked messages: ${originalMessages.size}\n\n` +
                    `*Commands:*\n` +
                    `.antiedit on - Enable antiedit\n` +
                    `.antiedit off - Disable antiedit\n` +
                    `.antiedit private - Send to owner only\n` +
                    `.antiedit chat - Send to same chat\n` +
                    `.antiedit both - Send to both\n` +
                    `.antiedit clean - Clear storage\n` +
                    `.antiedit stats - Show statistics`;

        await sock.sendMessage(chatId, { text }, { quoted: fake });
        return;
    }

    let responseText = '';
    let newConfig = { ...config };

    switch (command) {
        case 'on':
            if (config.enabled) {
                responseText = `*${botName}*\n❌ AntiEdit already ON!\nCurrent mode: ${config.mode || 'private'}`;
            } else {
                newConfig.enabled = true;
                newConfig.mode = newConfig.mode || 'private';
                setOwnerConfig('antiedit', newConfig);
                responseText = `*${botName}*\n✅ AntiEdit ENABLED\nMode: ${newConfig.mode.toUpperCase()}\nScope: GLOBAL`;
            }
            break;

        case 'off':
            if (!config.enabled) {
                responseText = `*${botName}*\n❌ AntiEdit already OFF!`;
            } else {
                newConfig.enabled = false;
                setOwnerConfig('antiedit', newConfig);
                responseText = `*${botName}*\n✅ AntiEdit DISABLED`;
            }
            break;

        case 'private':
            newConfig.enabled = true;
            newConfig.mode = 'private';
            setOwnerConfig('antiedit', newConfig);
            responseText = `*${botName}*\n✅ Mode: PRIVATE\nEdited messages sent to OWNER only (from all chats)`;
            break;

        case 'chat':
            newConfig.enabled = true;
            newConfig.mode = 'chat';
            setOwnerConfig('antiedit', newConfig);
            responseText = `*${botName}*\n✅ Mode: CHAT\nEdited messages sent to SAME CHAT (for all chats)`;
            break;

        case 'both':
            newConfig.enabled = true;
            newConfig.mode = 'both';
            setOwnerConfig('antiedit', newConfig);
            responseText = `*${botName}*\n✅ Mode: BOTH\nEdited messages sent to OWNER + SAME CHAT (for all chats)`;
            break;

        case 'clean':
        case 'clear':
            originalMessages.clear();
            responseText = `*${botName}*\n🧹 Cleaned: All tracked messages cleared`;
            break;

        case 'stats':
        case 'status':
            const size = originalMessages.size;
            const messages = Array.from(originalMessages.values());
            const oldest = messages.sort((a, b) => a.timestamp - b.timestamp)[0];
            const newest = messages.sort((a, b) => b.timestamp - a.timestamp)[0];
            const avgAge = oldest && newest ? Math.round((newest.timestamp - oldest.timestamp) / (1000 * 60 * 60)) : 0;

            responseText = `*${botName} ANTIEDIT STATS*\n\n` +
                          `Messages tracked: ${size}\n` +
                          `Oldest: ${oldest ? new Date(oldest.timestamp).toLocaleTimeString() : 'N/A'}\n` +
                          `Newest: ${newest ? new Date(newest.timestamp).toLocaleTimeString() : 'N/A'}\n` +
                          `Avg age: ${avgAge} hours\n` +
                          `Status: ${config.enabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n` +
                          `Mode: ${config.mode || 'private'}\n` +
                          `Scope: GLOBAL`;
            break;

        case 'prvt':
        case 'priv':
            // Alias for private
            newConfig.enabled = true;
            newConfig.mode = 'private';
            setOwnerConfig('antiedit', newConfig);
            responseText = `*${botName}*\n✅ Mode: PRIVATE\nEdited messages sent to OWNER only (from all chats)`;
            break;

        case 'cht':
            // Alias for chat
            newConfig.enabled = true;
            newConfig.mode = 'chat';
            setOwnerConfig('antiedit', newConfig);
            responseText = `*${botName}*\n✅ Mode: CHAT\nEdited messages sent to SAME CHAT (for all chats)`;
            break;

        case 'all':
            // Alias for both
            newConfig.enabled = true;
            newConfig.mode = 'both';
            setOwnerConfig('antiedit', newConfig);
            responseText = `*${botName}*\n✅ Mode: BOTH\nEdited messages sent to OWNER + SAME CHAT (for all chats)`;
            break;

        default:
            responseText = `*${botName}*\n❌ Invalid command!\n\n` +
                          `Use: on, off, private, chat, both, clean, stats`;
            break;
    }

    await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
}

function storeOriginalMessage(message) {
    try {
        if (!message?.key?.id) return;

        // Get GLOBAL config (not per chat)
        const config = getOwnerConfig('antiedit') || { enabled: false };

        if (!config?.enabled) return;

        const chatId = message.key.remoteJid;

        let text = '';
        const msg = message.message;
        if (!msg) return;

        if (msg.conversation) {
            text = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            text = msg.extendedTextMessage.text;
        } else if (msg.imageMessage?.caption) {
            text = msg.imageMessage.caption;
        } else if (msg.videoMessage?.caption) {
            text = msg.videoMessage.caption;
        } else if (msg.documentMessage?.caption) {
            text = msg.documentMessage.caption;
        }

        if (!text) return;

        if (originalMessages.size >= MAX_STORED_MESSAGES) {
            const firstKey = originalMessages.keys().next().value;
            originalMessages.delete(firstKey);
        }

        originalMessages.set(message.key.id, {
            text,
            sender: message.key.participant || message.key.remoteJid,
            chatId,
            timestamp: Date.now(),
            pushName: message.pushName || 'Unknown'
        });

    } catch (err) {
        // Silent error
        console.error('Error storing original message:', err.message);
    }
}

async function handleEditedMessage(sock, editedMessage) {
    try {
        // Get GLOBAL config
        const config = getOwnerConfig('antiedit') || { enabled: false, mode: 'private' };

        if (!config?.enabled) return;

        const chatId = editedMessage.key.remoteJid;

        let messageId = editedMessage.key.id;

        const msg = editedMessage.message;
        if (msg?.protocolMessage?.key?.id) {
            messageId = msg.protocolMessage.key.id;
        }

        const original = originalMessages.get(messageId);
        if (!original) return;

        if (original.chatId !== chatId) return;

        let newText = '';

        if (msg?.protocolMessage?.editedMessage) {
            const edited = msg.protocolMessage.editedMessage;
            if (edited.conversation) {
                newText = edited.conversation;
            } else if (edited.extendedTextMessage?.text) {
                newText = edited.extendedTextMessage.text;
            }
        } else if (msg?.editedMessage) {
            if (msg.editedMessage.message?.conversation) {
                newText = msg.editedMessage.message.conversation;
            } else if (msg.editedMessage.message?.extendedTextMessage?.text) {
                newText = msg.editedMessage.message.extendedTextMessage.text;
            }
        }

        if (!newText || newText === original.text) return;

        const mode = config.mode || 'private';
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Get notification targets based on GLOBAL mode
        const targets = [];

        if (mode === 'private' || mode === 'both') {
            targets.push(ownerNumber);
        }

        if ((mode === 'chat' || mode === 'both') && chatId !== ownerNumber) {
            targets.push(chatId);
        }

        if (targets.length === 0) return;

        await sendEditNotification(sock, original, newText, targets);

        // Update stored message
        originalMessages.set(messageId, {
            ...original,
            text: newText,
            timestamp: Date.now()
        });

    } catch (err) {
        console.error('Error handling edited message:', err.message);
    }
}

async function sendEditNotification(sock, original, newText, targets) {
    try {
        const botName = getBotName();
        const senderNumber = original.sender.split('@')[0];
        const time = new Date(original.timestamp).toLocaleString('en-US', {
            hour12: true, hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const fake = createFakeContact(original.sender);

        let groupName = '';
        if (original.chatId.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(original.chatId);
                groupName = metadata.subject;
            } catch {}
        }

        const notificationText = `*${botName} - MESSAGE EDITED*\n\n` +
                                `By: @${senderNumber}\n` +
                                `Name: ${original.pushName}\n` +
                                `Time: ${time}\n` +
                                (groupName ? `Group: ${groupName}\n\n` : '\n') +
                                `*ORIGINAL MESSAGE:*\n${original.text.substring(0, 500)}${original.text.length > 500 ? '...' : ''}\n\n` +
                                `*EDITED TO:*\n${newText.substring(0, 500)}${newText.length > 500 ? '...' : ''}`;

        for (const target of targets) {
            try {
                await sock.sendMessage(target, {
                    text: notificationText,
                    mentions: [original.sender]
                }, { quoted: fake });
            } catch {}
        }

    } catch (err) {
        console.error('Error sending edit notification:', err.message);
    }
}

// Clean old messages periodically
setInterval(() => {
    const cutoff = Date.now() - 86400000; // 24 hours
    for (const [key, value] of originalMessages.entries()) {
        if (value.timestamp < cutoff) {
            originalMessages.delete(key);
        }
    }
}, 3600000); // Every hour

module.exports = {
    antieditCommand,
    storeOriginalMessage,
    handleEditedMessage,
    handleMessageUpdate: handleEditedMessage
};