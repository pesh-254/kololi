const axios = require('axios');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function episodeDownloaderCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const url = args.slice(1).join(' ');
        
        if (!url) {
            await sock.sendMessage(chatId, {
                text: `*${botName} EPISODE DOWNLOADER*\n\n` +
                      `Download episodes/movies from cineru.lk\n\n` +
                      `*Usage:*\n` +
                      `.episode https://cineru.lk/tv_series/from-2022-s01-sinhala-subtitles/\n` +
                      `.tv https://cineru.lk/tv_series/link\n` +
                      `.movie https://cineru.lk/movie/link\n\n` +
                      `*Powered by:* Arslan API`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n⏳ Fetching movie data... This may take a moment.`
        }, { quoted: fake });

        const apiUrl = `https://arslan-apis.vercel.app/movie/sinhalasub/episode?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        const res = response.data;

        if (!res || res.status !== true || !res.result) {
            throw new Error('Failed to fetch movie');
        }

        const item = res.result;
        const title = item.title || "Movie_File";
        const dlUrl = item.download_url || item.url;

        await sock.sendMessage(chatId, {
            document: { url: dlUrl },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption: `*${botName} EPISODE*\n\n` +
                     `*Title:* ${title}\n` +
                     `*Quality:* Original\n` +
                     `*Source:* cineru.lk`
        }, { quoted: fake });

    } catch (error) {
        console.error('Episode download error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Failed to download: ${error.message || 'Invalid URL'}`
        }, { quoted: fake });
    }
}

module.exports = { episodeDownloaderCommand };