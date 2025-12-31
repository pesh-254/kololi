const gis = require('g-i-s');

// Fake contact creator 😜
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Img Search",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:X;Dave;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:BOT\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function gisSearch(query) {
    return new Promise((resolve, reject) => {
        gis(query, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

async function imageCommand(sock, chatId, senderId, message, userMessage) {
    const fkontak = createFakeContact(message);
    
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `Image Search Command\n\nUsage:\n.image <search_query>\n\nExample:\n.image cat\n.image beautiful sunset\n.image anime characters`
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            text: `Searching images for: "${query}"...`
        }, { quoted: fkontak });

        const results = await gisSearch(query);

        if (!results || results.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `No images found for "${query}"`
            }, { quoted: fkontak });
        }

        const imageUrls = results
            .map(r => r.url)
            .filter(url => url && (url.endsWith('.jpg') || url.endsWith('.png')))
            .slice(0, 5);

        if (imageUrls.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `No valid images found for "${query}"`
            }, { quoted: fkontak });
        }

        const botName = `DAVE-X`;

        for (const url of imageUrls) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url },
                    caption: `Downloaded by ${botName}`
                }, { quoted: fkontak });

                await new Promise(res => setTimeout(res, 500));
            } catch (err) {
                console.error('Error sending image:', err);
            }
        }
    } catch (error) {
        console.error('Image command error:', error);
        await sock.sendMessage(chatId, {
            text: 'An unexpected error occurred. Please try again.'
        }, { quoted: fkontak });
    }
}

module.exports = imageCommand;