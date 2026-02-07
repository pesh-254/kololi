const axios = require('axios');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function qcCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const quoteText = args.slice(1).join(' ');
        
        if (!quoteText) {
            await sock.sendMessage(chatId, {
                text: `*${botName} QUOTE STICKER*\n\n` +
                      `Create quote stickers\n\n` +
                      `*Usage:*\n` +
                      `.qc Hello World\n` +
                      `.qc Your text here\n\n` +
                      `*Note:* Max 30 characters`
            }, { quoted: fake });
            return;
        }

        if (quoteText.length > 30) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Text too long! Maximum 30 characters.`
            }, { quoted: fake });
            return;
        }

        const quotedSender = message.message?.extendedTextMessage?.contextInfo?.participant || senderId;
        let profilePicture;
        try {
            profilePicture = await sock.profilePictureUrl(quotedSender, 'image');
        } catch {
            profilePicture = 'https://srv.neoxr.tk/files/z8hI5T.jpg';
        }

        const pushName = message.pushName || quotedSender.split('@')[0];

        const quoteObject = {
            type: "quote",
            format: "png",
            backgroundColor: "#FFFFFF",
            width: 512,
            height: 768,
            scale: 2,
            messages: [{
                entities: [],
                avatar: true,
                from: {
                    id: 1,
                    name: pushName,
                    photo: {
                        url: profilePicture
                    }
                },
                text: quoteText,
                replyMessage: {}
            }]
        };

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n⏳ Creating quote sticker...`
        }, { quoted: fake });

        const response = await axios.post('https://bot.lyo.su/quote/generate', quoteObject, {
            headers: { 'Content-Type': 'application/json' }
        });

        const buffer = Buffer.from(response.data.result.image, 'base64');

        await sock.sendMessage(chatId, {
            sticker: buffer
        }, { quoted: fake });

    } catch (error) {
        console.error('Quote sticker error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Failed to create quote sticker: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = {
    qcCommand
};