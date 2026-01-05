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
            text: 'Example: .lyrics Shape one call away\nProvide song name'
        }, { quoted: fake });
    }

    try {
        const res = await axios.get(`https://apiskeith.vercel.app/search/lyrics2?query=${encodeURIComponent(songTitle)}`);
        const data = res.data;

        if (!data.status || !data.result) {
            return sock.sendMessage(chatId, { text: "Lyrics not found" }, { quoted: fake });
        }

        await sock.sendMessage(chatId, { text: data.result }, { quoted: fake });
    } catch (error) {
        console.error('Lyrics Error:', error);
        await sock.sendMessage(chatId, { 
            text: "Failed to fetch lyrics"
        }, { quoted: fake });
    }
}

module.exports = { lyricsCommand };