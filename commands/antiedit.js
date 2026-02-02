const { getOwnerConfig, setOwnerConfig, parseToggleCommand } = require('../Database/settingsStore');
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

async function antieditCommand(sock, chatId, message, match) {
    const botName = getBotName();
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    
    // ONLY OWNER CAN CONTROL ANTEDIT
    if (!await isAuthorized(sock, message)) {
        return sock.sendMessage(chatId, { 
            text: `*${botName}*\nOwner only command!` 
        }, { quoted: fake });
    }

    // Get GLOBAL config from owner settings
    const config = getOwnerConfig('antiedit') || { enabled: false, mode: 'private' };

    if (!match) {
        const text = `*${botName} ANTIEDIT*\n\n` +
                    `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                    `Mode: ${config.mode || 'private'}\n` +
                    `Scope: GLOBAL (all chats)\n` +
                    `Tracked messages: ${originalMessages.size}\n\n` +
                    `*Commands:*\n` +
                    `.antiedit on/off\n` +
                    `.antiedit private - Send to owner only (global)\n` +
                    `.antiedit chat - Send to same chat (global)\n` +
                    `.antiedit both - Send to both (global)\n` +
                    `.antiedit clean - Clear storage\n` +
                    `.antiedit stats - Show statistics`;
        
        await sock.sendMessage(chatId, { text }, { quoted: fake });
        return;
    }

    const command = match.toLowerCase().trim();
    let responseText = '';
    let newConfig = { ...config };

    const toggle = parseToggleCommand(command);
    if (toggle === 'on') {
        newConfig.enabled = true;
        newConfig.mode = newConfig.mode || 'private';
        responseText = `*${botName}*\n✅ AntiEdit ENABLED\nMode: ${newConfig.mode.toUpperCase()}\nScope: GLOBAL`;
    } else if (toggle === 'off') {
        newConfig.enabled = false;
        responseText = `*${botName}*\n❌ AntiEdit DISABLED`;
    } else if (command === 'private' || command === 'prvt' || command === 'priv') {
        newConfig.mode = 'private';
        newConfig.enabled = true;
        responseText = `*${botName}*\n✅ AntiEdit ENABLED\nMode: PRIVATE\nEdited messages sent to OWNER only (from all chats)`;
    } else if (command === 'chat' || command === 'cht') {
        newConfig.mode = 'chat';
        newConfig.enabled = true;
        responseText = `*${botName}*\n✅ AntiEdit ENABLED\nMode: CHAT\nEdited messages sent to SAME CHAT (for all chats)`;
    } else if (command === 'both' || command === 'all') {
        newConfig.mode = 'both';
        newConfig.enabled = true;
        responseText = `*${botName}*\n✅ AntiEdit ENABLED\nMode: BOTH\nEdited messages sent to OWNER + SAME CHAT (for all chats)`;
    } else if (command === 'clean' || command === 'clear') {
        originalMessages.clear();
        responseText = `*${botName}*\n🧹 Cleaned: All tracked messages cleared`;
    } else if (command === 'stats' || command === 'status') {
        const size = originalMessages.size;
        const oldest = Array.from(originalMessages.values()).sort((a, b) => a.timestamp - b.timestamp)[0];
        const newest = Array.from(originalMessages.values()).sort((a, b) => b.timestamp - a.timestamp)[0];
        const avgAge = oldest && newest ? Math.round((newest.timestamp - oldest.timestamp) / (1000 * 60 * 60)) : 0;
        
        responseText = `*${botName} ANTIEDIT STATS*\n\n` +
                      `Messages tracked: ${size}\n` +
                      `Oldest: ${oldest ? new Date(oldest.timestamp).toLocaleTimeString() : 'N/A'}\n` +
                      `Newest: ${newest ? new Date(newest.timestamp).toLocaleTimeString() : 'N/A'}\n` +
                      `Avg age: ${avgAge} hours\n` +
                      `Status: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}\n` +
                      `Mode: ${config.mode || 'private'}\n` +
                      `Scope: GLOBAL`;
    } else {
        responseText = `*${botName}*\n❌ Invalid command!\nUse: on, off, private, chat, both, clean, stats`;
    }

    if (responseText && !responseText.includes('Invalid')) {
        // Save to OWNER config (global setting)
        setOwnerConfig('antiedit', newConfig);
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
        console.error('Error storing original message:', err.message);
    }
}

async function handleEditedMessage(sock, editedMessage) {
    try {
        // Get GLOBAL config
        const config = getOwnerConfig('antiedit') || { enabled: false, mode: 'private' };
        
        if (!config?.enabled) return;

        const chatId = editedMessage.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
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
    const cutoff = Date.now() - 86400000;
    for (const [key, value] of originalMessages.entries()) {
        if (value.timestamp < cutoff) {
            originalMessages.delete(key);
        }
    }
}, 3600000);

module.exports = {
    antieditCommand,
    storeOriginalMessage,
    handleEditedMessage,
    handleMessageUpdate: handleEditedMessage
};