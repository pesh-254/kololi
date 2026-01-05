function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function getContextInfo(message) {
    return (
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        message.message?.stickerMessage?.contextInfo ||
        message.message?.documentMessage?.contextInfo ||
        message.message?.audioMessage?.contextInfo
    );
}

async function tostatusCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    if (!message.key.fromMe) {
        return sock.sendMessage(chatId, { 
            text: '⚠️ Owner only command'
        }, { quoted: fake });
    }

    const contextInfo = getContextInfo(message);
    const quotedMessage = contextInfo?.quotedMessage;

    if (!quotedMessage) {
        return sock.sendMessage(chatId, { 
            text: '⚠️ Reply to an image/video/text to post to status'
        }, { quoted: fake });
    }

    try {
        const msgType = Object.keys(quotedMessage)[0];
        let statusMessage = null;

        if (msgType === 'imageMessage') {
            // Download the image
            const buffer = await sock.downloadMediaMessage({
                message: quotedMessage
            });
            
            statusMessage = {
                image: buffer,
                caption: quotedMessage.imageMessage?.caption || ""
            };

        } else if (msgType === 'videoMessage') {
            // Download the video
            const buffer = await sock.downloadMediaMessage({
                message: quotedMessage
            });
            
            statusMessage = {
                video: buffer,
                caption: quotedMessage.videoMessage?.caption || ""
            };

        } else if (msgType === 'conversation') {
            statusMessage = {
                text: quotedMessage.conversation
            };

        } else if (msgType === 'extendedTextMessage') {
            statusMessage = {
                text: quotedMessage.extendedTextMessage?.text || ""
            };

        } else if (msgType === 'stickerMessage') {
            return sock.sendMessage(chatId, { 
                text: '⚠️ Stickers cannot be posted to status. Reply to image, video, or text instead.'
            }, { quoted: fake });

        } else {
            return sock.sendMessage(chatId, { 
                text: `⚠️ Unsupported message type: ${msgType}\n\nPlease reply to image, video, or text.`
            }, { quoted: fake });
        }

        // Post to status using the correct method
        if (statusMessage) {
            const result = await sock.sendMessage('status@broadcast', statusMessage, {
                backgroundColor: '#000000',
                statusJidList: [] // Empty = broadcast to all contacts
            });

            // Wait a moment for the status to post
            await new Promise(resolve => setTimeout(resolve, 1000));

            await sock.sendMessage(chatId, { 
                text: `✅ Successfully posted to status!`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Tostatus Error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to post status\n\nError: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = tostatusCommand;