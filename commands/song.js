const yts = require('yt-search');
const axios = require('axios');

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

        // Use Keith API for search (more reliable)
        let videos = await apis.keith.search(searchQuery);
        
        // Fallback to yt-search if Keith fails
        if (!videos || videos.length === 0) {
            const ytSearch = await yts(searchQuery);
            videos = ytSearch.videos || [];
            
            // Convert yt-search format to Keith format
            videos = videos.map(video => ({
                title: video.title,
                id: video.videoId,
                url: video.url,
                thumbnail: video.thumbnail,
                views: video.views.toString(),
                duration: `${video.seconds} seconds (${video.timestamp})`,
                published: video.ago
            }));
        }
        
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "Track search returned zero results" 
            }, { quoted: fakeContact });
        }

        const video = videos[0];
        const urlYt = video.url;
        
        console.log(`Searching for: ${searchQuery}, Found: ${video.title}`);

        // Try multiple APIs to get audio URL
        let audioUrl = null;
        let audioData = null;
        
        // Try Keith API first
        audioData = await apis.keith.downloadAudio(urlYt);
        if (audioData?.downloadUrl) {
            audioUrl = audioData.downloadUrl;
            console.log("Using Keith API for download");
        }
        
        // Try y2mate if Keith failed
        if (!audioUrl) {
            audioUrl = await apis.y2mate.downloadAudio(urlYt);
            if (audioUrl) console.log("Using y2mate API for download");
        }
        
        // Try tomp3 as last resort
        if (!audioUrl) {
            audioUrl = await apis.tomp3.downloadAudio(urlYt);
            if (audioUrl) console.log("Using tomp3 API for download");
        }

        if (!audioUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Audio retrieval unsuccessful - all download services failed" 
            }, { quoted: fakeContact });
        }

        const title = video.title;
        const thumbnail = video.thumbnail;
        
        // Sanitize filename
        const sanitizedTitle = title
            .replace(/[^\w\s-]/g, '')
            .substring(0, 100)
            .trim();

        await sock.sendMessage(chatId, { 
            text: `🎵 Now playing: ${title}\n👁️ Views: ${video.views}\n⏱️ Duration: ${video.duration}`
        }, { quoted: fakeContact });

        // Send as document (not audio)
        await sock.sendMessage(chatId, {
            document: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${sanitizedTitle}.mp3`,
            caption: `🎵 ${title}`,
            thumbnail: thumbnail
        }, { quoted: fakeContact });

        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (error) {
        console.error('Error in songCommand:', error);
        
        let errorMsg = "Audio download procedure failed";
        
        if (error.message.includes("timeout")) {
            errorMsg = "Request timed out. Please try again.";
        } else if (error.message.includes("ENOTFOUND") || error.message.includes("network")) {
            errorMsg = "Network error. Please check your connection.";
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMsg 
        }, { quoted: fakeContact });
        
        await sock.sendMessage(chatId, { 
            react: { text: '❌', key: message.key } 
        });
    }
}

module.exports = songCommand;