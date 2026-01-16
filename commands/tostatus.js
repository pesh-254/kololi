const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');


function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
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

async function tostatusCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    if (!message.key.fromMe) {
        return sock.sendMessage(chatId, { 
            text: '⚠️ Owner only command'
        }, { quoted: fake });
    }

    const contextInfo = getContextInfo(message);
    const quotedMessage = contextInfo?.quotedMessage;

    if (!quotedMessage) {
        return sock.sendMessage(chatId, { 
            text: '⚠️ Reply to an image/video/text to post to status'
        }, { quoted: fake });
    }

    try {
        const msgType = Object.keys(quotedMessage)[0];
        let statusMessage = null;

        if (msgType === 'imageMessage') {
            const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
            
            statusMessage = {
                image: buffer,
                caption: quotedMessage.imageMessage?.caption || ""
            };

        } else if (msgType === 'videoMessage') {
            const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
            
            statusMessage = {
                video: buffer,
                caption: quotedMessage.videoMessage?.caption || "",
                gifPlayback: quotedMessage.videoMessage?.gifPlayback || false
            };

        } else if (msgType === 'conversation') {
            statusMessage = {
                text: quotedMessage.conversation
            };

        } else if (msgType === 'extendedTextMessage') {
            statusMessage = {
                text: quotedMessage.extendedTextMessage?.text || ""
            };

        } else if (msgType === 'stickerMessage') {
            return sock.sendMessage(chatId, { 
                text: '⚠️ Stickers cannot be posted to status. Reply to image, video, or text instead.'
            }, { quoted: fake });

        } else {
            return sock.sendMessage(chatId, { 
                text: `⚠️ Unsupported message type: ${msgType}\n\nPlease reply to image, video, or text.`
            }, { quoted: fake });
        }

        // Post to status
        if (statusMessage) {
            await sock.sendMessage('status@broadcast', statusMessage, {
                backgroundColor: '#000000',
                statusJidList: []
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            await sock.sendMessage(chatId, { 
                text: `✅ Successfully posted to status!`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Tostatus Error:', error);
        console.error('Error message:', error.message);
        
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to post status\n\nError: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = tostatusCommand;