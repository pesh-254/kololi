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
            // Use new API
            const apiUrl = `https://apiskeith.vercel.app/download/tiktokdl3?url=${encodeURIComponent(url)}`;
            let videoUrl = null;
            let title = null;
            let audioUrl = null;
            let thumbnailUrl = null;

            // Call API
            try {
                const response = await axios.get(apiUrl, { 
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                console.log('API response received');
                
                if (response.data?.status) {
                    const apiResult = response.data.result;
                    
                    // Get title
                    if (apiResult.title) {
                        title = apiResult.title;
                    }
                    
                    // Get thumbnail
                    if (apiResult.thumbnailUrl) {
                        thumbnailUrl = apiResult.thumbnailUrl;
                    }
                    
                    // Get video URL - prefer HD, fallback to normal
                    if (apiResult.downloadUrls) {
                        if (apiResult.downloadUrls.mp4HD && apiResult.downloadUrls.mp4HD.length > 0) {
                            videoUrl = apiResult.downloadUrls.mp4HD[0];
                            console.log('Using HD video');
                        } else if (apiResult.downloadUrls.mp4 && apiResult.downloadUrls.mp4.length > 0) {
                            videoUrl = apiResult.downloadUrls.mp4[0];
                            console.log('Using standard video');
                        }
                        
                        // Get audio URL if available
                        if (apiResult.downloadUrls.mp3 && apiResult.downloadUrls.mp3.length > 0) {
                            audioUrl = apiResult.downloadUrls.mp3[0];
                            console.log('Audio URL available');
                        }
                    }
                } else {
                    throw new Error('API returned false status');
                }
            } catch (apiError) {
                console.error('New API failed:', apiError.message);
                throw new Error('Download service unavailable');
            }

            if (!videoUrl) {
                throw new Error('No video URL found');
            }

            console.log('Video URL found');

            // Send video
            const caption = title ? `${title}\n\nBy DAVE-X Bot` : "By DAVE-X Bot";

            // Try URL method first
            try {
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: fkontak });
                console.log('Video sent via URL method');

                // Send audio separately if available
                if (audioUrl) {
                    setTimeout(async () => {
                        try {
                            await sock.sendMessage(chatId, {
                                audio: { url: audioUrl },
                                mimetype: "audio/mpeg",
                                fileName: "audio.mp3"
                            }, { quoted: fkontak });
                            console.log('Audio sent');
                        } catch (audioError) {
                            console.error('Failed to send audio:', audioError.message);
                        }
                    }, 1000);
                }

                return;

            } catch (urlError) {
                console.error('URL method failed:', urlError.message);
                throw new Error('Failed to send video');
            }

        } catch (error) {
            console.error('Download error:', error.message);
            
            let errorMessage = "Failed to download video.";
            
            if (error.message.includes('Download service')) {
                errorMessage = "Download service unavailable.";
            } else if (error.message.includes('No video URL')) {
                errorMessage = "Video not found.";
            } else if (error.message.includes('timeout')) {
                errorMessage = "Request timeout.";
            }

            await sock.sendMessage(chatId, { 
                text: errorMessage
            }, { quoted: fkontak });
        }

    } catch (error) {
        console.error('Command error:', error.message);
        await sock.sendMessage(chatId, { 
            text: "An error occurred."
        }, { quoted: fkontak });
    } finally {
        // Remove message from processed set
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 1000);
    }
}

module.exports = tiktokCommand;