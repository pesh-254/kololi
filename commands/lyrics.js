const axios = require("axios");

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

async function lyricsCommand(sock, chatId, songTitle, message) {
    const fake = createFakeContact(message);

    if (!songTitle) {
        return sock.sendMessage(chatId, { 
            text: 'Example: .lyrics shape of you\nProvide song name'
        }, { quoted: fake });
    }

    try {
        const apiUrl = `https://meta-api.zone.id/search/lyricsv2?title=${encodeURIComponent(songTitle)}`;
        const res = await axios.get(apiUrl);
        const data = res.data;

        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            return sock.sendMessage(chatId, { text: "Lyrics not found" }, { quoted: fake });
        }

        const firstResult = data.data[0];
        const lyrics = firstResult.plainLyrics || "No lyrics available";
        
        const responseText = `🎵 *${firstResult.trackName || songTitle}*\n👤 *Artist:* ${firstResult.artistName || 'Unknown'}\n💿 *Album:* ${firstResult.albumName || 'Unknown'}\n⏱️ *Duration:* ${firstResult.duration || 0}s\n\n📜 *Lyrics:*\n\n${lyrics}`;

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
    } catch (error) {
        console.error('Lyrics Error:', error);
        await sock.sendMessage(chatId, { 
            text: "Failed to fetch lyrics. Try again."
        }, { quoted: fake });
    }
}

module.exports = { lyricsCommand };