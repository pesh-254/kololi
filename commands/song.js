const yts = require('yt-search');
const axios = require('axios');

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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Music;;;\nFN:Davex Audio Download\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Music Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function songCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    
    try {
        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "Specify track to download" 
            }, { quoted: fakeContact });
        }

        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "Track search returned zero results" 
            }, { quoted: fakeContact });
        }

        const video = videos[0];
        const urlYt = video.url;

        const response = await axios.get(`https://api.privatezia.biz.id/api/downloader/ytmp3?url=${urlYt}`);
        const apiData = response.data;

        if (!apiData || !apiData.status || !apiData.result || !apiData.result.downloadUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Audio retrieval unsuccessful" 
            }, { quoted: fakeContact });
        }

        const audioUrl = apiData.result.downloadUrl;
        const title = apiData.result.title;
        const Thumb = apiData.result.thumbnail;

        await sock.sendMessage(chatId, { 
            text: `Now playing: ${title}` 
        }, { quoted: fakeContact });

        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            Thumbnail: Thumb
        }, { quoted: fakeContact });

        await sock.sendMessage(chatId, { 
            react: { text: '🎺', key: message.key } 
        });

    } catch (error) {
        console.error('Error in songCommand:', error);
        await sock.sendMessage(chatId, { 
            text: "Audio download procedure failed" 
        }, { quoted: fakeContact });
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

module.exports = songCommand;