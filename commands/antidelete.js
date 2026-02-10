const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile, unlink, readdir, stat } = require('fs/promises');
const { getOwnerConfig, setOwnerConfig, getGroupConfig, setGroupConfig, parseToggleCommand } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

async function ensureTempDir() {
    try {
        await fs.promises.mkdir(TEMP_MEDIA_DIR, { recursive: true });
    } catch {}
}

async function getFolderSizeInMB(folderPath) {
    try {
        const files = await readdir(folderPath);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const stats = await stat(filePath);
                if (stats.isFile()) totalSize += stats.size;
            } catch {}
        }
        return totalSize / (1024 * 1024);
    } catch {
        return 0;
    }
}

async function cleanTempFolder(maxStorageMB = 200) {
    try {
        const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
        if (sizeMB > maxStorageMB) {
            const files = await readdir(TEMP_MEDIA_DIR);
            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(TEMP_MEDIA_DIR, file);
                try {
                    await unlink(filePath);
                    deletedCount++;
                } catch {}
            }
            return deletedCount;
        }
        return 0;
    } catch {
        return 0;
    }
}

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function handleAntideleteCommand(sock, chatId, message, match) {
    const botName = getBotName();
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    
    if (!await isAuthorized(sock, message)) {
        return sock.sendMessage(chatId, { 
            text: `*${botName}*\nOwner only command!` 
        }, { quoted: fake });
    }

    const isGroup = chatId.endsWith('@g.us');
    const config = isGroup ? getGroupConfig(chatId, 'antidelete') : getOwnerConfig('antidelete');

    if (!match) {
        const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
        const msgCount = db.getMessageCount();
        
        const text = `*${botName} ANTIDELETE*\n\n` +
                    `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                    `Mode: ${config.mode || 'private'}\n` +
                    `Storage: ${sizeMB.toFixed(1)}MB\n` +
                    `Messages: ${msgCount}\n\n` +
                    `*Commands:*\n` +
                    `.antidelete on/off\n` +
                    `.antidelete private - Send to owner only\n` +
                    `.antidelete chat - Send to same chat\n` +
                    `.antidelete both - Send to both\n` +
                    `.antidelete clean - Clear storage\n` +
                    `.antidelete stats - Show statistics`;
        
        await sock.sendMessage(chatId, { text }, { quoted: fake });
        return;
    }

    const command = match.toLowerCase().trim();
    let responseText = '';
    let newConfig = { ...config };

    const toggle = parseToggleCommand(command);
    if (toggle === 'on') {
        newConfig.enabled = true;
        if (!newConfig.mode) newConfig.mode = 'private';
        responseText = `*${botName}*\nAntidelete ENABLED (${newConfig.mode})\nDeleted messages will be recovered.`;
    } else if (toggle === 'off') {
        newConfig.enabled = false;
        responseText = `*${botName}*\nAntidelete DISABLED`;
    } else if (command === 'private' || command === 'prvt' || command === 'priv') {
        newConfig.mode = 'private';
        newConfig.enabled = true;
        responseText = `*${botName}*\nMode: PRIVATE\nDeleted messages sent to owner only.`;
    } else if (command === 'chat' || command === 'cht') {
        newConfig.mode = 'chat';
        newConfig.enabled = true;
        responseText = `*${botName}*\nMode: CHAT\nDeleted messages sent to same chat.`;
    } else if (command === 'both' || command === 'all') {
        newConfig.mode = 'both';
        newConfig.enabled = true;
        responseText = `*${botName}*\nMode: BOTH\nDeleted messages sent to owner and chat.`;
    } else if (command === 'clean' || command === 'clear') {
        const deleted = await cleanTempFolder(0);
        const cleaned = db.cleanOldMessages(0);
        responseText = `*${botName}*\nCleaned: ${deleted} files, ${cleaned} messages`;
    } else if (command === 'stats' || command === 'status') {
        const sizeMB = await getFolderSizeInMB(TEMP_MEDIA_DIR);
        const msgCount = db.getMessageCount();
        responseText = `*${botName} ANTIDELETE STATS*\n\nMessages stored: ${msgCount}\nStorage used: ${sizeMB.toFixed(1)}MB\nStatus: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}`;
    } else {
        responseText = `*${botName}*\nInvalid command!\nUse: on, off, private, chat, both, clean, stats`;
    }

    if (responseText && !responseText.includes('Invalid')) {
        if (isGroup) {
            setGroupConfig(chatId, 'antidelete', newConfig);
        } else {
            setOwnerConfig('antidelete', newConfig);
        }
    }

    await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
}

async function storeMessage(sock, message) {
    try {
        await ensureTempDir();
        
        const chatId = message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const config = isGroup ? getGroupConfig(chatId, 'antidelete') : getOwnerConfig('antidelete');
        
        if (!config.enabled) return;
        if (!message.key?.id) return;

        const messageId = message.key.id;
        const sender = message.key.participant || message.key.remoteJid;
        const pushName = message.pushName || 'Unknown';
        
        let content = '';
        let mediaType = null;
        let mediaPath = null;
        let isViewOnce = false;

        const msg = message.message;
        if (!msg) return;

        const viewOnceContainer = msg.viewOnceMessageV2?.message || msg.viewOnceMessage?.message;
        
        if (viewOnceContainer) {
            isViewOnce = true;
            if (viewOnceContainer.imageMessage) {
                mediaType = 'image';
                content = viewOnceContainer.imageMessage.caption || '';
                mediaPath = await downloadMedia(viewOnceContainer.imageMessage, 'image', `${Date.now()}_viewonce.jpg`);
            } else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                mediaPath = await downloadMedia(viewOnceContainer.videoMessage, 'video', `${Date.now()}_viewonce.mp4`);
            }
        } else {
            if (msg.conversation) {
                content = msg.conversation;
            } else if (msg.extendedTextMessage?.text) {
                content = msg.extendedTextMessage.text;
            } else if (msg.imageMessage) {
                mediaType = 'image';
                content = msg.imageMessage.caption || '';
                mediaPath = await downloadMedia(msg.imageMessage, 'image', `${Date.now()}.jpg`);
            } else if (msg.videoMessage) {
                mediaType = 'video';
                content = msg.videoMessage.caption || '';
                mediaPath = await downloadMedia(msg.videoMessage, 'video', `${Date.now()}.mp4`);
            } else if (msg.stickerMessage) {
                mediaType = 'sticker';
                mediaPath = await downloadMedia(msg.stickerMessage, 'sticker', `${Date.now()}.webp`);
            } else if (msg.audioMessage) {
                mediaType = 'audio';
                const ext = msg.audioMessage.mimetype?.includes('ogg') ? 'ogg' : 'mp3';
                mediaPath = await downloadMedia(msg.audioMessage, 'audio', `${Date.now()}.${ext}`);
            } else if (msg.documentMessage) {
                mediaType = 'document';
                content = msg.documentMessage.fileName || 'Document';
                mediaPath = await downloadMedia(msg.documentMessage, 'document', `${Date.now()}_${msg.documentMessage.fileName || 'file'}`);
            }
        }

        if (content || mediaType) {
            db.storeMessage(messageId, chatId, sender, content, mediaType, mediaPath, isViewOnce, pushName);
            
            if (isViewOnce && mediaPath) {
                await handleViewOnceForward(sock, config, { messageId, chatId, sender, content, mediaType, mediaPath, isViewOnce, pushName });
            }
        }

    } catch (err) {
        console.error('Error storing message:', err.message, 'Line:', err.stack?.split('\n')[1]);
    }
}

async function downloadMedia(message, type, fileName) {
    try {
        const stream = await downloadContentFromMessage(message, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        const filePath = path.join(TEMP_MEDIA_DIR, fileName);
        await writeFile(filePath, buffer);
        return filePath;
    } catch {
        return null;
    }
}

async function handleViewOnceForward(sock, config, storedMessage) {
    try {
        if (!storedMessage.mediaPath || !fs.existsSync(storedMessage.mediaPath)) return;

        const botName = getBotName();
        const senderName = storedMessage.sender.split('@')[0];
        const fake = createFakeContact(storedMessage.sender);
        
        const mediaOptions = {
            caption: `*${botName} - VIEW ONCE*\n\nFrom: @${senderName}\nName: ${storedMessage.pushName}\nType: ${storedMessage.mediaType}`,
            mentions: [storedMessage.sender]
        };

        const targets = getNotificationTargets(sock, storedMessage.chatId, config);
        
        for (const target of targets) {
            try {
                if (storedMessage.mediaType === 'image') {
                    await sock.sendMessage(target, { image: { url: storedMessage.mediaPath }, ...mediaOptions }, { quoted: fake });
                } else if (storedMessage.mediaType === 'video') {
                    await sock.sendMessage(target, { video: { url: storedMessage.mediaPath }, ...mediaOptions }, { quoted: fake });
                }
            } catch {}
        }

    } catch {}
}

function getNotificationTargets(sock, chatId, config) {
    const targets = [];
    const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    if (config.mode === 'private' || config.mode === 'both') {
        targets.push(ownerNumber);
    }
    
    if ((config.mode === 'chat' || config.mode === 'both') && chatId !== ownerNumber) {
        targets.push(chatId);
    }
    
    return targets;
}

async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const chatId = revocationMessage.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const config = isGroup ? getGroupConfig(chatId, 'antidelete') : getOwnerConfig('antidelete');
        
        if (!config.enabled) return;

        const messageId = revocationMessage.message?.protocolMessage?.key?.id;
        if (!messageId) return;

        const deletedBy = revocationMessage.participant || revocationMessage.key.participant || revocationMessage.key.remoteJid;
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber) return;

        const original = db.getMessage(messageId);
        if (!original) return;

        const targets = getNotificationTargets(sock, original.chat_jid, config);
        if (targets.length === 0) return;

        await sendDeletionNotification(sock, original, deletedBy, targets);
        
        db.deleteMessage(messageId);
        if (original.media_path && fs.existsSync(original.media_path)) {
            unlink(original.media_path).catch(() => {});
        }

    } catch (err) {
        console.error('Error handling revocation:', err.message, 'Line:', err.stack?.split('\n')[1]);
    }
}

async function sendDeletionNotification(sock, original, deletedBy, targets) {
    try {
        const botName = getBotName();
        const senderName = original.sender_jid.split('@')[0];
        const deleterName = deletedBy.split('@')[0];
        const fake = createFakeContact(original.sender_jid);
        
        let groupName = '';
        if (original.chat_jid.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(original.chat_jid);
                groupName = metadata.subject;
            } catch {}
        }

        const time = new Date(original.timestamp * 1000).toLocaleString('en-US', {
            hour12: true, hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        let text = `*${botName} - MESSAGE DELETED*\n\n`;
        text += `Deleted by: @${deleterName}\n`;
        text += `Original sender: @${senderName}\n`;
        text += `Name: ${original.push_name || 'Unknown'}\n`;
        text += `Time: ${time}\n`;
        if (groupName) text += `Group: ${groupName}\n`;
        if (original.is_view_once) text += `Type: View Once\n`;
        if (original.content) {
            text += `\n*DELETED MESSAGE:*\n${original.content.substring(0, 500)}${original.content.length > 500 ? '...' : ''}`;
        }

        const textMessage = {
            text,
            mentions: [deletedBy, original.sender_jid]
        };

        for (const target of targets) {
            try {
                await sock.sendMessage(target, textMessage, { quoted: fake });
            } catch {}
        }

        if (original.media_type && original.media_path && fs.existsSync(original.media_path)) {
            await sendMediaNotification(sock, original, targets);
        }

    } catch {}
}

async function sendMediaNotification(sock, original, targets) {
    const botName = getBotName();
    const senderName = original.sender_jid.split('@')[0];
    const fake = createFakeContact(original.sender_jid);
    
    const mediaOptions = {
        caption: `*${botName} - DELETED ${original.media_type.toUpperCase()}*\n\nFrom: @${senderName}`,
        mentions: [original.sender_jid]
    };

    for (const target of targets) {
        try {
            switch (original.media_type) {
                case 'image':
                    await sock.sendMessage(target, { image: { url: original.media_path }, ...mediaOptions }, { quoted: fake });
                    break;
                case 'sticker':
                    await sock.sendMessage(target, { sticker: { url: original.media_path } });
                    break;
                case 'video':
                    await sock.sendMessage(target, { video: { url: original.media_path }, ...mediaOptions }, { quoted: fake });
                    break;
                case 'audio':
                    await sock.sendMessage(target, { audio: { url: original.media_path }, mimetype: 'audio/mpeg', ptt: false });
                    break;
                case 'document':
                    await sock.sendMessage(target, { document: { url: original.media_path }, fileName: path.basename(original.media_path), ...mediaOptions }, { quoted: fake });
                    break;
            }
        } catch {}
    }
}

setInterval(() => {
    db.cleanOldMessages(86400);
    cleanTempFolder(200);
}, 3600000);

module.exports = {
    handleAntideleteCommand,
    handleMessageRevocation,
    storeMessage,
    cleanTempFolder
};
