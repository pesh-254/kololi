const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const fetch = require('node-fetch');
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

async function downloadMediaBuffer(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function setStatusCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!await isAuthorized(sock, message)) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nOwner only command!` 
            }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';
        const caption = text.split(' ').slice(1).join(' ');
        
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMessage) {
            const helpText = `*${botName} SET STATUS*\n\n` +
                `Reply to media with:\n` +
                `.setstatus <caption> - Post to status\n\n` +
                `Supported: Image, Video, Audio`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        let statusContent = null;
        let statusType = null;

        if (quotedMessage.imageMessage) {
            const buffer = await downloadMediaBuffer(quotedMessage.imageMessage, 'image');
            statusContent = { image: buffer, caption: caption || quotedMessage.imageMessage?.caption || '' };
            statusType = 'image';
        } else if (quotedMessage.videoMessage) {
            const buffer = await downloadMediaBuffer(quotedMessage.videoMessage, 'video');
            statusContent = { video: buffer, caption: caption || quotedMessage.videoMessage?.caption || '' };
            statusType = 'video';
        } else if (quotedMessage.audioMessage) {
            const buffer = await downloadMediaBuffer(quotedMessage.audioMessage, 'audio');
            statusContent = { audio: buffer, ptt: true };
            statusType = 'audio';
        } else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
            const textToPost = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;
            statusContent = { text: textToPost };
            statusType = 'text';
        }

        if (!statusContent) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nUnsupported media type for status` 
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage('status@broadcast', statusContent);
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nStatus posted successfully!` 
        }, { quoted: fake });

    } catch (error) {
        console.error('Set status error:', error.message, 'Line:', error.stack?.split('\n')[1]);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nFailed to post status: ${error.message}` 
        }, { quoted: fake });
    }
}

async function viewStatusCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!await isAuthorized(sock, message)) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nOwner only command!` 
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nStatus viewing not available via command.\nUse WhatsApp directly to view statuses.` 
        }, { quoted: fake });

    } catch (error) {
        console.error('View status error:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    setStatusCommand,
    viewStatusCommand
};
