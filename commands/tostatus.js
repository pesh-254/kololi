
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

        if (msgType === 'imageMessage') {
            // Download the image from the quoted message
            const buffer = await sock.downloadMediaMessage({
                message: quotedMessage
            });
            
            await sock.sendMessage('status@broadcast', {
                image: buffer,
                caption: quotedMessage.imageMessage?.caption || ""
            });
            
            await sock.sendMessage(chatId, { 
                text: '✅ Image posted to status successfully!'
            }, { quoted: fake });

        } else if (msgType === 'videoMessage') {
            // Download the video from the quoted message
            const buffer = await sock.downloadMediaMessage({
                message: quotedMessage
            });
            
            await sock.sendMessage('status@broadcast', {
                video: buffer,
                caption: quotedMessage.videoMessage?.caption || ""
            });
            
            await sock.sendMessage(chatId, { 
                text: '✅ Video posted to status successfully!'
            }, { quoted: fake });

        } else if (msgType === 'conversation') {
            const statusText = quotedMessage.conversation;
            
            await sock.sendMessage('status@broadcast', {
                text: statusText
            });
            
            await sock.sendMessage(chatId, { 
                text: '✅ Text posted to status successfully!'
            }, { quoted: fake });

        } else if (msgType === 'extendedTextMessage') {
            const statusText = quotedMessage.extendedTextMessage?.text || "";
            
            await sock.sendMessage('status@broadcast', {
                text: statusText
            });
            
            await sock.sendMessage(chatId, { 
                text: '✅ Text posted to status successfully!'
            }, { quoted: fake });

        } else if (msgType === 'stickerMessage') {
            return sock.sendMessage(chatId, { 
                text: '⚠️ Stickers cannot be posted to status. Reply to image, video, or text instead.'
            }, { quoted: fake });

        } else {
            return sock.sendMessage(chatId, { 
                text: `⚠️ Unsupported message type: ${msgType}\n\nPlease reply to image, video, or text.`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Tostatus Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to post status\n\nError: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = tostatusCommand;