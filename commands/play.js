const fs = require("fs");
const axios = require('axios');
const path = require('path');

// Working APIs based on your Keith pattern
const apis = {
  keith: {
    search: async (query) => {
      try {
        const response = await axios.get(
          `https://apiskeith.vercel.app/search/yts?query=${encodeURIComponent(query)}`,
          { timeout: 10000 }
        );
        return response.data?.result || [];
      } catch (error) {
        console.error("Keith search error:", error.message);
        return [];
      }
    },
    downloadAudio: async (url) => {
      try {
        const response = await axios.get(
          `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(url)}`,
          { timeout: 15000 }
        );
        return response.data?.result;
      } catch (error) {
        console.error("Keith download error:", error.message);
        return null;
      }
    }
  },
  
  y2mate: {
    downloadAudio: async (url) => {
      try {
        const response = await axios.get(
          `https://api.beautyofweb.com/y2mate?url=${encodeURIComponent(url)}&type=mp3`,
          { timeout: 15000 }
        );
        return response.data?.result?.audio?.url;
      } catch (error) {
        console.error("Y2Mate error:", error.message);
        return null;
      }
    }
  },
  
  tomp3: {
    downloadAudio: async (url) => {
      try {
        const endpoints = [
          `https://api.beautyofweb.com/y2mate?url=${encodeURIComponent(url)}&type=mp3`,
          `https://ytdl.sam-powers.workers.dev/?url=${encodeURIComponent(url)}&type=audio`,
          `https://yt5s.com/api/ajaxSearch?q=${encodeURIComponent(url)}&vt=home`
        ];
        
        for (const endpoint of endpoints) {
          try {
            const response = await axios.get(endpoint, { timeout: 10000 });
            if (response.data?.result?.audio?.url) return response.data.result.audio.url;
            if (response.data?.url) return response.data.url;
          } catch (e) {
            continue;
          }
        }
        return null;
      } catch (error) {
        console.error("Tomp3 error:", error.message);
        return null;
      }
    }
  }
};

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

        // Use Keith API for search
        const searchResults = await apis.keith.search(`${query} official`);
        
        if (!searchResults || searchResults.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "Couldn't find that song. Try another one!"
            }, { quoted: fakeContact });
        }

        // Get the first result
        const video = searchResults[0];
        
        // Try to get audio URL from various APIs
        let audioUrl = null;
        let audioData = null;
        
        console.log(`Searching for: ${query}, Found: ${video.title}`);
        
        // Try Keith API first
        audioData = await apis.keith.downloadAudio(video.url);
        if (audioData?.downloadUrl) {
            audioUrl = audioData.downloadUrl;
            console.log("Using Keith API");
        }
        
        // Try y2mate if Keith failed
        if (!audioUrl) {
            audioUrl = await apis.y2mate.downloadAudio(video.url);
            if (audioUrl) console.log("Using y2mate API");
        }
        
        // Try tomp3 as last resort
        if (!audioUrl) {
            audioUrl = await apis.tomp3.downloadAudio(video.url);
            if (audioUrl) console.log("Using tomp3 API");
        }

        if (!audioUrl) {
            throw new Error("All APIs failed to fetch track!");
        }

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download the audio
        const audioResponse = await axios({
            method: "get",
            url: audioUrl,
            responseType: "stream",
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
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

        // Send playing message
        await sock.sendMessage(chatId, {
            text: `🎵 Playing: ${video.title}\n👁️ Views: ${video.views}\n⏱️ Duration: ${video.duration}`
        }, { quoted: fakeContact });

        // Send audio file
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(filePath),
            mimetype: "audio/mpeg",
            fileName: `${video.title.substring(0, 100).replace(/[^\w\s]/gi, '')}.mp3`
        }, { quoted: fakeContact });

        // Clean up
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {
        console.error("Play command error:", error);
        
        let errorMsg = `Error: ${error.message}`;
        
        if (error.message.includes("timeout") || error.message.includes("timed out")) {
            errorMsg = "Request timed out. Please try again later.";
        } else if (error.message.includes("failed to fetch") || error.message.includes("All APIs failed")) {
            errorMsg = "Audio service is temporarily unavailable. Please try another song.";
        } else if (error.message.includes("empty file")) {
            errorMsg = "Download failed. The audio file is empty.";
        }
        
        return await sock.sendMessage(chatId, {
            text: errorMsg
        }, { quoted: fakeContact });
    }
}

module.exports = playCommand;