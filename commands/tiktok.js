const { ttdl } = require("ruhend-scraper");
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

        // Clean up old message IDs
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link."
            }, { quoted: fkontak });
        }

        // Extract URL from command
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link."
            }, { quoted: fkontak });
        }

        // Check for TikTok URL formats
        const tiktokPatterns = [
            /tiktok\.com\//,
            /vm\.tiktok\.com\//,
            /vt\.tiktok\.com\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));

        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "Invalid TikTok link."
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔄', key: message.key }
        });

        try {
            // Use API
            const apiUrl = `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`;
            let videoUrl = null;
            let title = null;

            // Call API
            try {
                const response = await axios.get(apiUrl, { 
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                });

                if (response.data?.status) {
                    // Check if the API returned video data
                    if (response.data.data) {
                        // Check for urls array first
                        if (response.data.data.urls && Array.isArray(response.data.data.urls) && response.data.data.urls.length > 0) {
                            videoUrl = response.data.data.urls[0];
                            title = response.data.data.metadata?.title || "TikTok Video";
                        } else if (response.data.data.video_url) {
                            videoUrl = response.data.data.video_url;
                            title = response.data.data.metadata?.title || "TikTok Video";
                        } else if (response.data.data.url) {
                            videoUrl = response.data.data.url;
                            title = response.data.data.metadata?.title || "TikTok Video";
                        }
                    }
                }
            } catch (apiError) {
                console.error('API failed:', apiError.message);
            }

            // If API didn't work, try ttdl method
            if (!videoUrl) {
                try {
                    let downloadData = await ttdl(url);
                    if (downloadData?.data?.length > 0) {
                        const mediaData = downloadData.data;
                        for (let i = 0; i < Math.min(5, mediaData.length); i++) {
                            const media = mediaData[i];
                            const mediaUrl = media.url;

                            // Check if URL is video
                            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || 
                                          media.type === 'video';

                            if (isVideo) {
                                await sock.sendMessage(chatId, {
                                    video: { url: mediaUrl },
                                    mimetype: "video/mp4",
                                    caption: "By DAVE-X Bot"
                                }, { quoted: fkontak });
                            } else {
                                await sock.sendMessage(chatId, {
                                    image: { url: mediaUrl },
                                    caption: "By DAVE-X Bot"
                                }, { quoted: fkontak });
                            }
                        }
                        return;
                    }
                } catch (ttdlError) {
                    console.error("ttdl fallback failed:", ttdlError.message);
                }
            }

            // Send the video if we got a URL
            if (videoUrl) {
                try {
                    // Try URL method first
                    const caption = title ? `${title}\n\nBy DAVE-X Bot` : "By DAVE-X Bot";

                    await sock.sendMessage(chatId, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption: caption
                    }, { quoted: fkontak });

                    return;
                } catch (urlError) {
                    console.error('URL method failed:', urlError.message);
                }
            }

            // If we reach here, no method worked
            return await sock.sendMessage(chatId, { 
                text: "Failed to download video."
            }, { quoted: fkontak });

        } catch (error) {
            console.error('Download error:', error.message);
            await sock.sendMessage(chatId, { 
                text: "Failed to download video."
            }, { quoted: fkontak });
        }

    } catch (error) {
        console.error('Command error:', error.message);
        await sock.sendMessage(chatId, { 
            text: "An error occurred."
        }, { quoted: fkontak });
    }
}

module.exports = tiktokCommand;