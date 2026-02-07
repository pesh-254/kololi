const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function removebgCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        // Check if replying to image
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage || !quotedMessage.imageMessage) {
            await sock.sendMessage(chatId, {
                text: `*${botName} REMOVE BACKGROUND*\n\n` +
                      `Remove background from images\n\n` +
                      `*Usage:* Reply to an image with:\n` +
                      `.removebg\n` +
                      `.nobg\n\n` +
                      `*Note:* Requires remove.bg API key`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n🎨 Removing background...`
        }, { quoted: fake });

        // Download the image
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const base64 = buffer.toString('base64');
        const apiKey = '1akxyLM8h64QuKxbjTqXoNaU'; // Your remove.bg API key
        
        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body: JSON.stringify({
                image_file_b64: base64,
                size: 'auto',
                format: 'png'
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.arrayBuffer();
        const resultBuffer = Buffer.from(result);

        await sock.sendMessage(chatId, {
            image: resultBuffer,
            caption: `*${botName}*\n✨ Background removed successfully!`
        }, { quoted: fake });

    } catch (error) {
        console.error('RemoveBG error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        let errorMsg = `❌ Failed to remove background: ${error.message}`;
        if (error.message.includes('API error: 402') || error.message.includes('402')) {
            errorMsg = `❌ API limit reached or invalid API key.\nGet free API key from: remove.bg`;
        } else if (error.message.includes('API error: 401') || error.message.includes('401')) {
            errorMsg = `❌ Invalid API key. Please update the API key in removebg.js`;
        }
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n${errorMsg}`
        }, { quoted: fake });
    }
}

module.exports = {
    removebgCommand
};