const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile, unlink, readdir, stat } = require('fs/promises');
const { getOwnerConfig, setOwnerConfig } = require('../Database/settingsStore');

const statusStore = new Map();
const deletedStatusStore = new Map();
const STATUS_MEDIA_DIR = path.join(__dirname, '../tmp/status_media');

const DEFAULT_STATUS_CONFIG = {
    enabled: true,
    mode: 'private',
    captureMedia: true,
    maxStorageMB: 500,
    cleanupInterval: 60,
    autoCleanup: true,
    maxStatuses: 1000,
    notifyOwner: true,
    cleanRetrieved: true,
    maxAgeHours: 24
};

let statusCleanupInterval = null;
initializeStatusSystem();

function createFakeContact(message) {
    const participantId = message?.key?.participant?.split('@')[0] || 
                         message?.key?.remoteJid?.split('@')[0] || '0';

    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function initializeStatusSystem() {
    ensureStatusMediaDir();
    startStatusCleanupInterval();
}

async function ensureStatusMediaDir() {
    try {
        await fs.promises.mkdir(STATUS_MEDIA_DIR, { recursive: true });
    } catch (err) {}
}

async function getStatusFolderSizeInMB() {
    try {
        const files = await readdir(STATUS_MEDIA_DIR);
        let totalSize = 0;
        for (const file of files) {
            const filePath = path.join(STATUS_MEDIA_DIR, file);
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

async function cleanStatusMediaFolder() {
    try {
        const config = loadStatusConfig();
        const sizeMB = await getStatusFolderSizeInMB();
        if (sizeMB > config.maxStorageMB) {
            const files = await readdir(STATUS_MEDIA_DIR);
            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(STATUS_MEDIA_DIR, file);
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

function loadStatusConfig() {
    try {
        const config = getOwnerConfig('status_antidelete');
        if (!config || typeof config !== 'object') {
            saveStatusConfig(DEFAULT_STATUS_CONFIG);
            return { ...DEFAULT_STATUS_CONFIG };
        }
        return { ...DEFAULT_STATUS_CONFIG, ...config };
    } catch {
        return { ...DEFAULT_STATUS_CONFIG };
    }
}

function saveStatusConfig(config) {
    try {
        setOwnerConfig('status_antidelete', config);
        return true;
    } catch {
        return false;
    }
}

function startStatusCleanupInterval() {
    const config = loadStatusConfig();
    if (statusCleanupInterval) clearInterval(statusCleanupInterval);
    statusCleanupInterval = setInterval(() => {
        cleanStatusMediaFolder().catch(() => {});
    }, config.cleanupInterval * 60 * 1000);
}

async function isStatusAuthorized(message) {
    try {
        const { isSudo } = require('../lib/index');
        const senderId = message.key.participant || message.key.remoteJid;
        return message.key.fromMe || await isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function handleStatusAntideleteCommand(sock, chatId, message, match) {
    if (!await isStatusAuthorized(message)) {
        const fakeContact = createFakeContact(message);
        return sock.sendMessage(chatId, { 
            text: 'Owner only' 
        }, { quoted: fakeContact });
    }

    const fakeContact = createFakeContact(message);
    const config = loadStatusConfig();

    if (!match) {
        return showStatusAntideleteStatus(sock, chatId, fakeContact, config);
    }

    const command = match.toLowerCase().trim();
    return processStatusCommand(sock, chatId, fakeContact, command, config);
}

async function showStatusAntideleteStatus(sock, chatId, fakeContact, config) {
    const sizeMB = await getStatusFolderSizeInMB();

    const text = `Status Antidelete: ${config.enabled ? 'ON' : 'OFF'}\n` +
                `Mode: ${config.mode}\n` +
                `Storage: ${sizeMB.toFixed(1)}MB\n` +
                `Active: ${statusStore.size}\n` +
                `Deleted: ${deletedStatusStore.size}\n\n` +
                `Commands: on/off, private, chat, both, clean, stats, list, settings\n\n` +
                `🎄 Merry Christmas`;

    await sock.sendMessage(chatId, { text }, { quoted: fakeContact });
}

async function processStatusCommand(sock, chatId, fakeContact, command, config) {
    let responseText = '';

    switch (command) {
        case 'on':
            config.enabled = true;
            responseText = 'Status Antidelete ON';
            break;
        case 'off':
            config.enabled = false;
            responseText = 'Status Antidelete OFF';
            break;
        case 'private':
            config.mode = 'private';
            responseText = 'Mode: Private';
            break;
        case 'chat':
            config.mode = 'chat';
            responseText = 'Mode: Chat';
            break;
        case 'both':
            config.mode = 'both';
            responseText = 'Mode: Both';
            break;
        case 'clean':
            const deletedCount = await cleanStatusMediaFolder();
            responseText = `Cleaned: ${deletedCount} files`;
            break;
        case 'stats':
            const sizeMB = await getStatusFolderSizeInMB();
            responseText = `Stats:\nActive: ${statusStore.size}\nDeleted: ${deletedStatusStore.size}\nStorage: ${sizeMB.toFixed(1)}MB`;
            break;
        case 'list':
            const recentStatuses = Array.from(deletedStatusStore.values())
                .slice(-5)
                .reverse();
            
            if (recentStatuses.length === 0) {
                responseText = 'No deleted statuses recorded.';
            } else {
                responseText = 'Recent Deleted Statuses:\n';
                recentStatuses.forEach((status, index) => {
                    const time = new Date(status.timestamp).toLocaleTimeString();
                    const sender = status.sender.split('@')[0];
                    responseText += `${index + 1}. ${sender} (${status.type}) - ${time}\n`;
                });
            }
            break;
        case 'settings':
            const subCmd = command.split(' ')[1];
            if (!subCmd) {
                responseText = `Settings: autoclean, cleanretrieved, maxage, maxstorage\nUse: .sad settings autoclean on`;
            } else {
                responseText = 'Settings updated';
            }
            break;
        default:
            responseText = 'Invalid command';
    }

    if (responseText !== 'Invalid command') {
        saveStatusConfig(config);
        startStatusCleanupInterval();
    }

    await sock.sendMessage(chatId, { text: responseText }, { quoted: fakeContact });
}

async function storeStatusMessage(sock, message) {
    try {
        await ensureStatusMediaDir();
        const config = loadStatusConfig();
        if (!config.enabled) return;

        if (!message.key?.id) return;
        if (message.key.fromMe) return;

        if (message.key.remoteJid !== 'status@broadcast') return;

        if (statusStore.size >= config.maxStatuses) {
            const firstKey = statusStore.keys().next().value;
            const oldStatus = statusStore.get(firstKey);
            statusStore.delete(firstKey);
            if (oldStatus?.mediaPath) {
                unlink(oldStatus.mediaPath).catch(() => {});
            }
        }

        const statusId = message.key.id;
        const sender = message.key.participant || message.key.remoteJid;
        const pushName = message.pushName || 'Unknown';

        const storedStatus = {
            id: statusId,
            sender,
            pushName,
            chatId: message.key.remoteJid,
            type: 'status',
            mediaType: '',
            mediaPath: '',
            content: '',
            timestamp: Date.now(),
            isDeleted: false
        };

        await extractStatusContent(message, storedStatus, config);

        if (storedStatus.content || storedStatus.mediaType) {
            statusStore.set(statusId, storedStatus);
        }

    } catch {}
}

async function extractStatusContent(message, storedStatus, config) {
    try {
        if (!config.captureMedia) return;

        const msg = message.message;

        if (msg.imageMessage) {
            storedStatus.mediaType = 'image';
            storedStatus.content = msg.imageMessage.caption || '';
            storedStatus.mediaPath = await downloadStatusMedia(
                msg.imageMessage, 
                'image', 
                `${storedStatus.timestamp}_status.jpg`
            );
        } else if (msg.videoMessage) {
            storedStatus.mediaType = 'video';
            storedStatus.content = msg.videoMessage.caption || '';
            storedStatus.mediaPath = await downloadStatusMedia(
                msg.videoMessage, 
                'video', 
                `${storedStatus.timestamp}_status.mp4`
            );
        } else if (msg.audioMessage) {
            storedStatus.mediaType = 'audio';
            const mime = msg.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            storedStatus.mediaPath = await downloadStatusMedia(
                msg.audioMessage, 
                'audio', 
                `${storedStatus.timestamp}_status.${ext}`
            );
        } else if (msg.extendedTextMessage?.text) {
            storedStatus.content = msg.extendedTextMessage.text;
            storedStatus.mediaType = 'text';
        } else if (msg.conversation) {
            storedStatus.content = msg.conversation;
            storedStatus.mediaType = 'text';
        }
    } catch {}
}

async function downloadStatusMedia(message, type, fileName) {
    try {
        const stream = await downloadContentFromMessage(message, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        const filePath = path.join(STATUS_MEDIA_DIR, fileName);
        await writeFile(filePath, buffer);
        return filePath;
    } catch {
        return null;
    }
}

async function handleStatusDeletion(sock, update) {
    try {
        const config = loadStatusConfig();
        if (!config.enabled) return;

        const msgKey = update.key;
        if (!msgKey?.id) return;
        if (msgKey.remoteJid !== 'status@broadcast') return;

        const isDeleted = 
            update.message === null ||
            update.update?.status === 6 ||
            update.update?.message === null ||
            update.messageStubType === 7 ||
            update.messageStubType === 8;

        if (!isDeleted) return;

        const statusId = msgKey.id;
        const original = statusStore.get(statusId);
        if (!original) return;

        statusStore.delete(statusId);
        deletedStatusStore.set(statusId, {
            ...original,
            deletedAt: Date.now(),
            isDeleted: true
        });

        if (config.notifyOwner) {
            await sendStatusDeletionNotification(sock, original, config);
        }

        if (config.cleanRetrieved && original.mediaPath) {
            unlink(original.mediaPath).catch(() => {});
        }

    } catch {}
}

async function sendStatusDeletionNotification(sock, status, config) {
    try {
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const senderNumber = status.sender.split('@')[0];
        const time = new Date(status.timestamp).toLocaleString();

        let text = `🗑️ *DELETED STATUS*\n\n`;
        text += `👤 From: ${senderNumber}\n`;
        text += `📛 Name: ${status.pushName}\n`;
        text += `🕒 Time: ${time}\n`;
        text += `📝 Type: ${status.mediaType || 'text'}\n`;
        
        if (status.content) {
            text += `\n💬 Message:\n${status.content.substring(0, 200)}`;
            if (status.content.length > 200) text += '...';
        }

        const targets = [];
        if (config.mode === 'private' || config.mode === 'both') {
            targets.push(ownerNumber);
        }

        for (const target of targets) {
            try {
                if (status.mediaType === 'image' && status.mediaPath && fs.existsSync(status.mediaPath)) {
                    await sock.sendMessage(target, {
                        image: { url: status.mediaPath },
                        caption: text
                    });
                } else if (status.mediaType === 'video' && status.mediaPath && fs.existsSync(status.mediaPath)) {
                    await sock.sendMessage(target, {
                        video: { url: status.mediaPath },
                        caption: text
                    });
                } else if (status.mediaType === 'audio' && status.mediaPath && fs.existsSync(status.mediaPath)) {
                    await sock.sendMessage(target, {
                        audio: { url: status.mediaPath },
                        mimetype: 'audio/mpeg'
                    });
                    await sock.sendMessage(target, { text });
                } else {
                    await sock.sendMessage(target, { text });
                }
            } catch {}
        }

    } catch {}
}

function autoCleanOldStatuses() {
    try {
        const config = loadStatusConfig();
        const maxAge = config.maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();

        for (const [id, status] of statusStore.entries()) {
            if (now - status.timestamp > maxAge) {
                statusStore.delete(id);
                if (status.mediaPath) {
                    unlink(status.mediaPath).catch(() => {});
                }
            }
        }

        for (const [id, status] of deletedStatusStore.entries()) {
            if (now - status.timestamp > maxAge) {
                deletedStatusStore.delete(id);
            }
        }
    } catch {}
}

module.exports = {
    handleStatusAntideleteCommand,
    handleStatusDeletion,
    storeStatusMessage,
    cleanStatusMediaFolder
};