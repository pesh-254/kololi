const Jimp = require('jimp');
const jsQR = require('jsqr');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function readqrCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        // Check if replying to image
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage || !quotedMessage.imageMessage) {
            await sock.sendMessage(chatId, {
                text: `*${botName} QR CODE READER*\n\n` +
                      `Read QR codes from images\n\n` +
                      `*Usage:* Reply to an image containing QR code with:\n` +
                      `.readqr`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n🔍 Reading QR code...`
        }, { quoted: fake });

        // Download the image
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Read QR code with Jimp
        const image = await Jimp.read(buffer);
        const { data, width, height } = image.bitmap;
        
        const code = jsQR(data, width, height);

        if (!code) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ QR code not found or could not be decoded.`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName} QR CODE RESULT*\n\n` +
                  `📋 *Decoded Data:*\n` +
                  `${code.data}\n\n` +
                  `📍 *Location:* ${code.location ? 'Detected' : 'Unknown'}\n` +
                  `📏 *Size:* ${width}x${height}px`
        }, { quoted: fake });

    } catch (error) {
        console.error('Read QR error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Failed to read QR code: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = {
    readqrCommand
};