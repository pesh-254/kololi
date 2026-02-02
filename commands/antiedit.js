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
        const helpText = `*${botName} ANTIEDIT*\n\n` +
                        `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                        `Mode: ${config.mode || 'private'}\n` +
                        `Tracked messages: ${originalMessages.size}\n\n` +
                        `*Commands:*\n` +
                        `.antiedit private - Enable (send to your DM)\n` +
                        `.antiedit chat - Enable (send to current chat)\n` +
                        `.antiedit both - Enable (send to both)\n` +
                        `.antiedit off - Disable\n` +
                        `.antiedit status - Show status`;
        
        await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
        return;
    }

    let newConfig = { ...config };
    let responseText = '';

    // Handle specific commands first
    if (sub === 'status') {
        responseText = `*${botName} ANTIEDIT STATUS*\n\n` +
                      `Status: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}\n` +
                      `Mode: ${config.mode || 'private'}\n` +
                      `Tracked: ${originalMessages.size} messages`;
    } else if (sub === 'private') {
        newConfig.enabled = true;
        newConfig.mode = 'private';
        responseText = `*${botName}*\nAntiEdit ENABLED\nMode: private\nNotifications will be sent to your DM.`;
    } else if (sub === 'chat') {
        newConfig.enabled = true;
        newConfig.mode = 'chat';
        responseText = `*${botName}*\nAntiEdit ENABLED\nMode: chat\nNotifications will be sent to current chat.`;
    } else if (sub === 'both') {
        newConfig.enabled = true;
        newConfig.mode = 'both';
        responseText = `*${botName}*\nAntiEdit ENABLED\nMode: both\nNotifications will be sent to both DM and current chat.`;
    } else if (sub === 'off' || sub === 'disable') {
        newConfig.enabled = false;
        responseText = `*${botName}*\nAntiEdit DISABLED`;
    } else {
        responseText = `*${botName}*\nInvalid command!\nUse: private, chat, both, off, status`;
    }

    // Save config if valid command
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
        console.error('Error storing original message:', err.message, 'Line:', err.stack?.split('\n')[1]);
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
        
        const botName = getBotName();
        const senderNumber = original.sender.split('@')[0];
        const time = new Date().toLocaleString('en-US', {
            hour12: true, hour: '2-digit', minute: '2-digit'
        });
        
        const notificationText = `*${botName} - MESSAGE EDITED*\n\n` +
                                `By: @${senderNumber}\n` +
                                `Name: ${original.pushName}\n` +
                                `Time: ${time}\n\n` +
                                `*ORIGINAL MESSAGE:*\n${original.text.substring(0, 500)}${original.text.length > 500 ? '...' : ''}\n\n` +
                                `*EDITED TO:*\n${newText.substring(0, 500)}${newText.length > 500 ? '...' : ''}`;
        
        const fake = createFakeContact(original.sender);
        const mode = config.mode || 'private'; // Default to private
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        // Send based on mode
        if (mode === 'private') {
            // Send to owner's DM only
            await sock.sendMessage(ownerNumber, {
                text: notificationText,
                mentions: [original.sender]
            }, { quoted: fake });
        } else if (mode === 'chat') {
            // Send to current chat only
            await sock.sendMessage(chatId, {
                text: notificationText,
                mentions: [original.sender]
            }, { quoted: fake });
        } else if (mode === 'both') {
            // Send to both
            await sock.sendMessage(ownerNumber, {
                text: notificationText,
                mentions: [original.sender]
            }, { quoted: fake });
            
            await sock.sendMessage(chatId, {
                text: notificationText,
                mentions: [original.sender]
            }, { quoted: fake });
        }
        
        originalMessages.set(messageId, {
            ...original,
            text: newText,
            timestamp: Date.now()
        });
        
    } catch (err) {
        console.error('Error handling edited message:', err.message, 'Line:', err.stack?.split('\n')[1]);
    }
}

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