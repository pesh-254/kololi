const fetch = require('node-fetch');

function createFakeContact(message) {
    const participantId = message?.key?.participant?.split('@')[0] || 
                          message?.key?.remoteJid?.split('@')[0] || '0';

    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function shorturlCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);

        if (args.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ Please provide a URL to shorten.\n\n*Usage:*\n.shorturl https://example.com\n\n*Example:*\n.shorturl https://github.com/dave-x-bot/whatsapp-bot' 
            }, { quoted: fake });
            return;
        }

        let longUrl = args[0];
        
        // Add https:// if not present
        if (!longUrl.startsWith('http://') && !longUrl.startsWith('https://')) {
            longUrl = 'https://' + longUrl;
        }

        // Validate URL
        try {
            new URL(longUrl);
        } catch (error) {
            await sock.sendMessage(chatId, { 
                text: '❌ Invalid URL format!\n\nPlease provide a valid URL like:\nhttps://example.com' 
            }, { quoted: fake });
            return;
        }

        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        try {
            // Try tinyurl first
            const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const shortUrl = await response.text();

            // Check if it returned an error
            if (shortUrl.includes('error') || shortUrl.includes('Error')) {
                throw new Error('TinyURL API error');
            }

            await sock.sendMessage(chatId, { 
                text: `🔗 *URL SHORTENED*\n\n*Original:*\n${longUrl}\n\n*Shortened:*\n${shortUrl}\n\n*Click to copy:* \`${shortUrl}\`` 
            }, { quoted: fake });

        } catch (tinyError) {
            console.error('TinyURL failed:', tinyError);
            
            // Fallback: Use is.gd
            try {
                const isgdResponse = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`);
                const isgdShortUrl = await isgdResponse.text();
                
                await sock.sendMessage(chatId, { 
                    text: `🔗 *URL SHORTENED (is.gd)*\n\n*Original:*\n${longUrl}\n\n*Shortened:*\n${isgdShortUrl}\n\n*Click to copy:* \`${isgdShortUrl}\`` 
                }, { quoted: fake });
                
            } catch (isgdError) {
                console.error('is.gd failed:', isgdError);
                
                // Final fallback: Show URL and suggest manual shortening
                await sock.sendMessage(chatId, { 
                    text: `❌ Could not shorten URL at the moment.\n\n*Try these services manually:*\n• https://tinyurl.com\n• https://bit.ly\n• https://is.gd\n\n*Your URL:*\n${longUrl}` 
                }, { quoted: fake });
            }
        }

    } catch (error) {
        console.error('Error in shorturl command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while shortening the URL.' 
        }, { quoted: fake });
    }
}

module.exports = {
    shorturlCommand
};