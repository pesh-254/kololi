const axios = require('axios');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function geminiCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const question = args.slice(1).join(' ');
        
        if (!question) {
            await sock.sendMessage(chatId, {
                text: `*${botName} GEMINI AI*\n\n` +
                      `Ask questions to Gemini AI\n\n` +
                      `*Usage:*\n` +
                      `.gemini how do I bake a cake?\n` +
                      `.gemini explain quantum physics\n` +
                      `.gemini write a poem about love\n\n` +
                      `Powered by BK9 Gemini API`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n🤖 Processing your question...`
        }, { quoted: fake });

        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        const apiUrl = `https://api.bk9.dev/ai/gemini?q=${encodeURIComponent(question)}`;
        const response = await axios.get(apiUrl);
        const res = response.data;

        if (!res || res.status !== true || !res.BK9) {
            throw new Error('API returned invalid response');
        }

        // Send response
        await sock.sendMessage(chatId, {
            text: `*${botName} GEMINI*\n\n${res.BK9}`
        }, { quoted: fake });

    } catch (error) {
        console.error('Gemini error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Gemini AI error: ${error.message || 'API not responding'}`
        }, { quoted: fake });
    }
}

module.exports = { geminiCommand };