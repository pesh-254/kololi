const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Status",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Status;;;\nFN:DaveX Status\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Status Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function setGroupStatusCommand(sock, chatId, msg) {
    try {
        const fakeContact = createFakeContact(msg);
        
        // Owner check
        const isOwner = msg.key.fromMe;
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: 'Owner only' }, { quoted: fakeContact });
            return;
        }

        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus|tosgroup)\s*/i;

        if (!quotedMessage && (!messageText.trim() || messageText.trim().match(commandRegex))) {
            await sock.sendMessage(chatId, { text: 'Reply to media or add text' }, { quoted: fakeContact });
            return;
        }

        let payload = null;
        let captionText = '';
        
        let textAfterCommand = '';
        if (messageText.trim()) {
            const match = messageText.match(commandRegex);
            if (match) {
                textAfterCommand = messageText.slice(match[0].length).trim();
            }
        }

        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
            
            if (textAfterCommand && payload && (payload.video || payload.image)) {
                if (payload.video) {
                    payload.caption = textAfterCommand + '\n\n🎄 Merry Christmas';
                } else if (payload.image) {
                    payload.caption = textAfterCommand + '\n\n🎄 Merry Christmas';
                }
            }
        } 
        else if (messageText.trim()) {
            if (textAfterCommand) {
                payload = { text: textAfterCommand + '\n\n🎄 Merry Christmas' };
            } else {
                await sock.sendMessage(chatId, { text: 'Reply to media or add text' }, { quoted: fakeContact });
                return;
            }
        }

        if (!payload) {
            await sock.sendMessage(chatId, { text: 'Reply to media or add text' }, { quoted: fakeContact });
            return;
        }

        if (payload.caption && !payload.caption.includes('🎄 Merry Christmas')) {
            payload.caption += '\n\n🎄 Merry Christmas';
        }

        await sendGroupStatus(sock, chatId, payload);

        const mediaType = detectMediaType(quotedMessage);
        let successMsg = `Status sent: ${mediaType}`;
        
        if (payload.caption) {
            successMsg += '\n🎄 Merry Christmas';
        }
        
        await sock.sendMessage(chatId, { text: successMsg }, { quoted: fakeContact });

    } catch (error) {
        console.error('Group status error:', error);
        const fakeContact = createFakeContact(msg);
        await sock.sendMessage(chatId, { text: 'Failed to send' }, { quoted: fakeContact });
    }
}

function detectMediaType(quotedMessage) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.videoMessage) return 'Video';
    if (quotedMessage.imageMessage) return 'Image';
    if (quotedMessage.audioMessage) return 'Audio';
    if (quotedMessage.stickerMessage) return 'Sticker';
    return 'Text';
}

async function buildPayloadFromQuoted(quotedMessage) {
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return { 
            video: buffer, 
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    }
    else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || ''
        };
    }
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
        if (quotedMessage.audioMessage.ptt) {
            const audioVn = await toVN(buffer);
            return { 
                audio: audioVn, 
                mimetype: "audio/ogg; codecs=opus", 
                ptt: true 
            };
        } else {
            return { 
                audio: buffer, 
                mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                ptt: false 
            };
        }
    }
    else if (quotedMessage.stickerMessage) {
        const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
        return { 
            sticker: buffer,
            mimetype: quotedMessage.stickerMessage.mimetype || 'image/webp'
        };
    }
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
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

module.exports = setGroupStatusCommand;