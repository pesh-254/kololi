const { getOwnerConfig, setOwnerConfig, getGroupConfig, setGroupConfig, parseToggleCommand } = require('../Database/settingsStore');
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

async function antieditCommand(sock, chatId, message, args) {
    const isGroup = chatId.endsWith('@g.us');
    const senderId = message.key.participant || message.key.remoteJid;
    const botName = getBotName();
    const fake = createFakeContact(senderId);
    
    if (isGroup) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === senderId);
            if (!participant?.admin && !message.key.fromMe && !db.isSudo(senderId)) {
                return sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAdmin only command!` 
                }, { quoted: fake });
            }
        } catch {}
    } else {
        if (!await isAuthorized(sock, message)) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nOwner only command!` 
            }, { quoted: fake });
        }
    }

    const config = isGroup ? getGroupConfig(chatId, 'antiedit') : getOwnerConfig('antiedit');
    const sub = (args || '').trim().toLowerCase();

    if (!sub) {
        const mode = config.mode || 'private';
        const helpText = `*${botName} ANTIEDIT*\n\n` +
                        `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                        `Mode: ${mode.toUpperCase()}\n` +
                        `Tracked messages: ${originalMessages.size}\n\n` +
                        `*Commands:*\n` +
                        `.antiedit on - Enable\n` +
                        `.antiedit off - Disable\n` +
                        `.antiedit private - Send to owner only\n` +
                        `.antiedit chat - Send to same chat\n` +
                        `.antiedit both - Send to both\n` +
                        `.antiedit status - Show status`;
        
        await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
        return;
    }

    let newConfig = { ...config };
    let responseText = '';

    if (sub === 'status') {
        const mode = config.mode || 'private';
        responseText = `*${botName} ANTIEDIT STATUS*\n\n` +
                      `Status: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}\n` +
                      `Mode: ${mode.toUpperCase()}\n` +
                      `Tracked: ${originalMessages.size} messages`;
    } else if (sub === 'private' || sub === 'prvt' || sub === 'priv') {
        newConfig.mode = 'private';
        newConfig.enabled = true;
        responseText = `*${botName}*\nMode: PRIVATE\nEdited messages sent to owner only.`;
    } else if (sub === 'chat' || sub === 'cht') {
        newConfig.mode = 'chat';
        newConfig.enabled = true;
        responseText = `*${botName}*\nMode: CHAT\nEdited messages sent to same chat.`;
    } else if (sub === 'both' || sub === 'all') {
        newConfig.mode = 'both';
        newConfig.enabled = true;
        responseText = `*${botName}*\nMode: BOTH\nEdited messages sent to owner and chat.`;
    } else {
        const toggle = parseToggleCommand(sub);
        if (toggle === 'on') {
            newConfig.enabled = true;
            if (!newConfig.mode) newConfig.mode = 'private';
            responseText = `*${botName}*\nAntiEdit ENABLED\nMode: ${newConfig.mode.toUpperCase()}`;
        } else if (toggle === 'off') {
            newConfig.enabled = false;
            responseText = `*${botName}*\nAntiEdit DISABLED`;
        } else {
            responseText = `*${botName}*\nInvalid command!\nUse: on, off, private, chat, both, status`;
        }
    }

    if (responseText && !responseText.includes('Invalid')) {
        if (isGroup) {
            setGroupConfig(chatId, 'antiedit', newConfig);
        } else {
            setOwnerConfig('antiedit', newConfig);
        }
    }

    await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
}

function storeOriginalMessage(message) {
    try {
        if (!message?.key?.id) return;
        
        const chatId = message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const config = isGroup ? getGroupConfig(chatId, 'antiedit') : getOwnerConfig('antiedit');
        
        if (!config?.enabled) return;
        
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
        const chatId = editedMessage.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const config = isGroup ? getGroupConfig(chatId, 'antiedit') : getOwnerConfig('antiedit');
        
        if (!config?.enabled) return;
        
        let messageId = editedMessage.key.id;
        
        const msg = editedMessage.message;
        if (msg?.protocolMessage?.key?.id) {
            messageId = msg.protocolMessage.key.id;
        }
        
        const original = originalMessages.get(messageId);
        if (!original) return;
        
        // Make sure the edit happened in the same chat as the original message
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
        
        // Determine where to send the notification based on mode
        const targets = [];
        
        if (mode === 'private' || mode === 'both') {
            targets.push(ownerNumber);
        }
        
        if ((mode === 'chat' || mode === 'both') && chatId !== ownerNumber) {
            targets.push(chatId);
        }
        
        if (targets.length === 0) return;
        
        await sendEditNotification(sock, original, newText, editedMessage, targets);
        
        // Update stored message with new text
        originalMessages.set(messageId, {
            ...original,
            text: newText,
            timestamp: Date.now()
        });
        
    } catch (err) {
        console.error('Error handling edited message:', err.message);
    }
}

async function sendEditNotification(sock, original, newText, editedMessage, targets) {
    try {
        const botName = getBotName();
        const senderNumber = original.sender.split('@')[0];
        const time = new Date().toLocaleString('en-US', {
            hour12: true, hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        
        const fake = createFakeContact(original.sender);
        
        // Get group name if in group
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
}, 3600000);

module.exports = {
    antieditCommand,
    storeOriginalMessage,
    handleEditedMessage,
    handleMessageUpdate: handleEditedMessage
};