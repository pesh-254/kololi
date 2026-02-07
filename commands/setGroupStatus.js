const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const fetch = require('node-fetch');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

// Simple sticker conversion function
async function convertStickerToImage(stickerBuffer) {
    return stickerBuffer; // Return original, just change mimetype
}

async function setGroupStatusCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        // Check if it's a group
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nThis command can only be used in groups!` 
            }, { quoted: fake });
        }

        // Group admin check
        const groupMetadata = await sock.groupMetadata(chatId);
        const participant = groupMetadata.participants.find(p => p.id === senderId);
        const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

        if (!isAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nOnly group admins can use this command!` 
            }, { quoted: fake });
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Show help if no content
        if (!quotedMessage && !text.trim()) {
            const helpText = `*${botName} GROUP STATUS*\n\n` +
                           `Send media/text as group status\n\n` +
                           `*Commands:*\n` +
                           `.togroupstatus <text>\n` +
                           `.tosgroup <text>\n\n` +
                           `*Usage:*\n` +
                           `• .tosgroup Hello World\n` +
                           `• Reply to video/image/sticker with .tosgroup\n` +
                           `• Add caption after command`;
            
            return sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
        }

        let payload = null;
        let caption = '';

        // Extract caption from command text
        if (text.trim()) {
            const args = text.trim().split(' ');
            caption = args.slice(1).join(' ');
        }

        // Handle quoted message
        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
            
            // Add caption if provided
            if (caption && payload) {
                if (payload.video || payload.image) {
                    payload.caption = caption;
                }
            }
        } 
        // Handle plain text
        else if (text.trim()) {
            const args = text.trim().split(' ');
            payload = { text: args.slice(1).join(' ') || args[0] };
        }

        if (!payload) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\n❌ No content to send as status!` 
            }, { quoted: fake });
        }

        // Send group status
        await sendGroupStatus(sock, chatId, payload);

        // Determine media type for success message
        let mediaType = 'Text';
        if (quotedMessage) {
            if (quotedMessage.videoMessage) mediaType = 'Video';
            else if (quotedMessage.imageMessage) mediaType = 'Image';
            else if (quotedMessage.audioMessage) mediaType = 'Audio';
            else if (quotedMessage.stickerMessage) mediaType = 'Sticker (converted)';
        }

        let successMsg = `*${botName}*\n✅ ${mediaType} status sent successfully!`;
        if (caption) {
            successMsg += `\nCaption: "${caption}"`;
        }

        await sock.sendMessage(chatId, { text: successMsg }, { quoted: fake });

    } catch (error) {
        console.error('Group status error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\n❌ Failed: ${error.message}` 
        }, { quoted: fake });
    }
}

/* ------------------ Helper Functions ------------------ */

async function buildPayloadFromQuoted(quotedMessage) {
    // Handle video
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return { 
            video: buffer, 
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false
        };
    }
    // Handle image
    else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || ''
        };
    }
    // Handle audio
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
        if (quotedMessage.audioMessage.ptt) {
            const audioVn = await toVN(buffer);
            return { 
                audio: audioVn, 
                ptt: true 
            };
        } else {
            return { 
                audio: buffer, 
                ptt: false 
            };
        }
    }
    // Handle sticker - convert to image
    else if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        const imageBuffer = await convertStickerToImage(buffer);
        return { 
            image: imageBuffer, 
            mimetype: 'image/png'
        };
    }
    // Handle text
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const text = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: text };
    }
    return null;
}

async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function sendGroupStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);

    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
    }, {});

    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough();
        inStream.end(inputBuffer);
        const outStream = new PassThrough();
        const chunks = [];

        ffmpeg(inStream)
            .noVideo()
            .audioCodec("libopus")
            .format("ogg")
            .audioBitrate("48k")
            .audioChannels(1)
            .audioFrequency(48000)
            .on("error", reject)
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(outStream, { end: true });

        outStream.on("data", chunk => chunks.push(chunk));
    });
}

module.exports = {
    setGroupStatusCommand
};