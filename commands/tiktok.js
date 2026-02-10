const axios = require('axios');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    const botName = getBotName();

    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: `*${botName}*\nProvide a TikTok link!\n\nUsage: .tiktok <url>` 
            }, { quoted: fake });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: `*${botName}*\nProvide a TikTok link!\n\nUsage: .tiktok <url>` 
            }, { quoted: fake });
        }

        const tiktokPatterns = [/tiktok\.com\//, /vm\.tiktok\.com\//, /vt\.tiktok\.com\//];
        if (!tiktokPatterns.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, { text: `*${botName}*\nInvalid TikTok link!` }, { quoted: fake });
        }

        await sock.sendMessage(chatId, { react: { text: '...', key: message.key } });

        const apiResponse = await axios.get(`https://iamtkm.vercel.app/downloaders/tiktokdl?apikey=tkm&url=${encodeURIComponent(url)}`, { timeout: 15000 });
        const data = apiResponse.data;

        if (!data?.status || !data.result) {
            throw new Error('API failed');
        }

        const videoUrl = data.result.no_watermark || data.result.watermark;
        const audioUrl = data.result.audio;
        const title = data.result.title || 'TikTok Video';

        if (videoUrl) {
            await sock.sendMessage(chatId, {
                video: { url: videoUrl },
                mimetype: "video/mp4",
                caption: `*${botName}*\n${title.substring(0, 100)}\n\nUse .tiktokaudio <url> for audio only`
            }, { quoted: fake });
        } else if (audioUrl) {
            await sock.sendMessage(chatId, {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg"
            }, { quoted: fake });
        } else {
            throw new Error('No download URL found');
        }

        await sock.sendMessage(chatId, { react: { text: '', key: message.key } });

    } catch (error) {
        console.error('TikTok command error:', error.message);
        await sock.sendMessage(chatId, { text: `*${botName}*\nFailed to download. Try again later.` }, { quoted: fake });
    }
}

module.exports = { tiktokCommand };
