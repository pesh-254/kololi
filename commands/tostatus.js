const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

function getContextInfo(message) {
    return (
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        message.message?.stickerMessage?.contextInfo ||
        message.message?.documentMessage?.contextInfo ||
        message.message?.audioMessage?.contextInfo
    );
}

async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function tostatusCommand(sock, chatId, message, args) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    const botName = getBotName();

    if (!await isAuthorized(sock, message)) {
        return sock.sendMessage(chatId, { 
            text: `*${botName}*\nOwner only command!` 
        }, { quoted: fake });
    }

    const contextInfo = getContextInfo(message);
    const quotedMessage = contextInfo?.quotedMessage;
    const textArgs = args || '';

    if (!quotedMessage && !textArgs) {
        const helpText = `*${botName} TOSTATUS*\n\n` +
                        `Post content to your status\n\n` +
                        `*Usage:*\n` +
                        `• Reply to a message with .tostatus\n` +
                        `• .tostatus <text> - Post text\n` +
                        `• Reply to image/video with .tostatus\n` +
                        `• Reply to audio with .tostatus`;
        
        return sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
    }

    try {
        const statusJid = 'status@broadcast';
        const statusOptions = { statusJidList: [] };

        if (quotedMessage) {
            const msgType = Object.keys(quotedMessage)[0];

            if (msgType === 'imageMessage') {
                const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
                await sock.sendMessage(statusJid, {
                    image: buffer,
                    caption: quotedMessage.imageMessage?.caption || textArgs || '',
                }, statusOptions);

                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nImage posted to status!`
                }, { quoted: fake });

            } else if (msgType === 'videoMessage') {
                const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
                await sock.sendMessage(statusJid, {
                    video: buffer,
                    caption: quotedMessage.videoMessage?.caption || textArgs || '',
                    gifPlayback: quotedMessage.videoMessage?.gifPlayback || false,
                }, statusOptions);

                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nVideo posted to status!`
                }, { quoted: fake });

            } else if (msgType === 'audioMessage') {
                const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
                await sock.sendMessage(statusJid, {
                    audio: buffer,
                    mimetype: quotedMessage.audioMessage?.mimetype || 'audio/mpeg',
                    ptt: true
                }, statusOptions);

                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nAudio posted to status!`
                }, { quoted: fake });

            } else if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
                const statusText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
                await sock.sendMessage(statusJid, {
                    text: statusText,
                }, statusOptions);

                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nText posted to status!`
                }, { quoted: fake });

            } else if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
                const statusText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
                await sock.sendMessage(statusJid, {
                    text: statusText,
                }, statusOptions);

                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nText posted to status!`
                }, { quoted: fake });

            } else if (msgType === 'stickerMessage') {
                return sock.sendMessage(chatId, { 
                    text: `*${botName}*\nStickers cannot be posted! Reply to image, video, or text.`
                }, { quoted: fake });

            } else {
                return sock.sendMessage(chatId, { 
                    text: `*${botName}*\nUnsupported type: ${msgType}\nUse image, video, audio, or text.`
                }, { quoted: fake });
            }

        } else if (textArgs) {
            await sock.sendMessage(statusJid, {
                text: textArgs,
            }, statusOptions);

            await sock.sendMessage(chatId, {
                text: `*${botName}*\nText posted to status!`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Tostatus Error:', error.message, 'Line:', error.stack?.split('\n')[1]);
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nFailed to post status! ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = { tostatusCommand };
