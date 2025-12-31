const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Music",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Music;;;\nFN:Davex Music Player\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Music Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function playCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    
    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🎼', key: message.key }
        });         

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: 'Provide a song name.\nExample: .play Not Like Us'
            }, { quoted: fakeContact });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, { 
                text: 'Song name too long! Maximum 100 characters.'
            }, { quoted: fakeContact });
        }

        const searchResult = await (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return await sock.sendMessage(chatId, { 
                text: "Couldn't find that song. Try another one!"
            }, { quoted: fakeContact });
        }

        const video = searchResult;
        const apiUrl = `https://api.privatezia.biz.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            throw new Error("API failed to fetch track!");
        }

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        const audioResponse = await axios({
            method: "get",
            url: apiData.result.downloadUrl,
            responseType: "stream",
            timeout: 600000
        });
        
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        await sock.sendMessage(chatId, {
            text: `Playing: ${apiData.result.title || video.title}`
        }, { quoted: fakeContact });

        await sock.sendMessage(chatId, {
            document: { url: filePath },
            mimetype: "audio/mpeg",
            fileName: `${(apiData.result.title || video.title).substring(0, 100)}.mp3`
        }, { quoted: fakeContact });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error);
        return await sock.sendMessage(chatId, {
            text: `Error: ${error.message}`
        }, { quoted: fakeContact });
    }
}

module.exports = playCommand;