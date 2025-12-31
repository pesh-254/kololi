const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

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

async function tiktokCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);
    
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }

        // Add message ID to processed set
        processedMessages.add(message.key.id);

        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Provide TikTok URL."
            }, { quoted: fkontak });
        }

        // Extract URL from command
        const url = text.replace(/^tt\s+/i, '').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Provide TikTok URL."
            }, { quoted: fkontak });
        }

        // Check for various TikTok URL formats
        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));

        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Invalid TikTok link."
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });

        try {
            // Use API
            const apiUrl = `https://apis-sandarux.zone.id/api/tiktok/tiktokdl?url=${encodeURIComponent(url)}`;

            const response = await axios.get(apiUrl, { 
                timeout: 15000,
                headers: {
                    'accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const data = response.data;

            if (!data || !data.status || !data.result) {
                return await sock.sendMessage(chatId, { 
                    text: "Failed to fetch TikTok."
                }, { quoted: fkontak });
            }

            const res = data.result;

            // Check if video URL exists
            if (!res.nowm) {
                return await sock.sendMessage(chatId, { 
                    text: "No video found."
                }, { quoted: fkontak });
            }

            const caption = `TikTok Download\n\nTitle: ${res.title || "-"}\nAuthor: ${res.caption || "-"}\nDuration: ${res.duration || "-"}s\nViews: ${res.stats?.views || "-"}\nLikes: ${res.stats?.likes || "-"}`;

            try {
                // Try to download video as buffer
                const videoResponse = await axios.get(res.nowm, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    maxContentLength: 100 * 1024 * 1024,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'video/mp4,video/*,*/*;q=0.9',
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                });

                const videoBuffer = Buffer.from(videoResponse.data);

                if (videoBuffer.length === 0) {
                    throw new Error("Video buffer empty");
                }

                await sock.sendMessage(chatId, {
                    video: videoBuffer,
                    caption: caption,
                    mimetype: "video/mp4"
                }, { quoted: fkontak });

            } catch (downloadError) {
                // Fallback to URL method
                await sock.sendMessage(chatId, {
                    video: { url: res.nowm },
                    caption: caption,
                    mimetype: "video/mp4"
                }, { quoted: fkontak });
            }

        } catch (error) {
            console.error("TikTok Error:", error);

            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { 
                    text: "Request timeout. Try again."
                }, { quoted: fkontak });
            } else if (error.response?.status === 404) {
                await sock.sendMessage(chatId, { 
                    text: "Video not found."
                }, { quoted: fkontak });
            } else {
                await sock.sendMessage(chatId, { 
                    text: "Failed to fetch TikTok."
                }, { quoted: fkontak });
            }
        }
    } catch (error) {
        console.error('TikTok command error:', error);
        await sock.sendMessage(chatId, { 
            text: "Error occurred."
        }, { quoted: fkontak });
    }
}

module.exports = tiktokCommand;