const axios = require('axios');
const fetch = require('node-fetch');

function createFakeContact(message) {
    const phone = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${phone}:${phone}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function ytmp4Command(sock, chatId, senderId, message, userMessage) {
    const fkontak = createFakeContact(message);
    
    const url = userMessage.split(' ')[1];
    if (!url) {
        return sock.sendMessage(chatId, {
            text: `YouTube MP4 Download\nUsage: .ytmp4 <url>`
        }, { quoted: fkontak });
    }

    await sock.sendMessage(chatId, { 
        text: `Downloading MP4: ${url}...` 
    }, { quoted: fkontak });

    try {
        const { data } = await axios.get(`https://iamtkm.vercel.app/downloaders/ytmp4?apikey=tkm&url=${encodeURIComponent(url)}`);
        const dlLink = data?.data?.url 
            || data?.data?.media?.find(item => item.Type === "video" && item.format === "mp4")?.download_link;

        if (!dlLink) throw new Error("No video link");

        const videoBuffer = await (await fetch(dlLink)).arrayBuffer();
        await sock.sendMessage(chatId, {
            video: Buffer.from(videoBuffer),
            caption: `${data.data.title || 'YouTube Video'}`,
            mimetype: "video/mp4"
        }, { quoted: fkontak });

    } catch (err) {
        await sock.sendMessage(chatId, { 
            text: 'Failed to download video.' 
        }, { quoted: fkontak });
    }
}

async function ytmp3Command(sock, chatId, senderId, message, userMessage) {
    const fkontak = createFakeContact(message);
    
    const url = userMessage.split(' ')[1];
    if (!url) {
        return sock.sendMessage(chatId, {
            text: `YouTube MP3 Download\nUsage: .ytmp3 <url>`
        }, { quoted: fkontak });
    }

    await sock.sendMessage(chatId, { 
        text: `Downloading MP3: ${url}...` 
    }, { quoted: fkontak });

    try {
        const { data } = await axios.get(`https://iamtkm.vercel.app/downloaders/ytmp3?apikey=tkm&url=${encodeURIComponent(url)}`);
        const dlLink = data?.data?.url 
            || data?.data?.media?.find(item => item.Type === "audio" && item.format === "mp3")?.download_link;

        if (!dlLink) throw new Error("No audio link");

        await sock.sendMessage(chatId, {
            document: { url: dlLink },
            mimetype: "audio/mpeg",
            fileName: `${data.data.title || 'audio'}.mp3`
        }, { quoted: fkontak });

    } catch {
        await sock.sendMessage(chatId, { 
            text: 'Failed to download audio.' 
        }, { quoted: fkontak });
    }
}

module.exports = { ytmp4Command, ytmp3Command };