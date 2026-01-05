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

async function tostatusCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    if (!message.key.fromMe) {
        return sock.sendMessage(chatId, { 
            text: 'Owner only command'
        }, { quoted: fake });
    }

    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quotedMessage) {
        return sock.sendMessage(chatId, { 
            text: 'Reply to an image/video/text'
        }, { quoted: fake });
    }

    try {
        const msgType = Object.keys(quotedMessage)[0];
        
        if (msgType === 'imageMessage') {
            const buffer = await sock.downloadMediaMessage(quotedMessage);
            await sock.sendMessage('status@broadcast', {
                image: buffer,
                caption: quotedMessage.imageMessage?.caption || ""
            });
            await sock.sendMessage(chatId, { 
                text: 'Image posted to status'
            }, { quoted: fake });
        } else if (msgType === 'videoMessage') {
            const buffer = await sock.downloadMediaMessage(quotedMessage);
            await sock.sendMessage('status@broadcast', {
                video: buffer,
                caption: quotedMessage.videoMessage?.caption || ""
            });
            await sock.sendMessage(chatId, { 
                text: 'Video posted to status'
            }, { quoted: fake });
        } else if (msgType === 'extendedTextMessage' || msgType === 'conversation') {
            const statusText = quotedMessage.extendedTextMessage?.text || quotedMessage.conversation || "";
            await sock.sendMessage('status@broadcast', {
                text: statusText
            });
            await sock.sendMessage(chatId, { 
                text: 'Text posted to status'
            }, { quoted: fake });
        } else {
            return sock.sendMessage(chatId, { 
                text: 'Reply to image, video, or text'
            }, { quoted: fake });
        }
        
    } catch (error) {
        console.error('Tostatus Error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to post status'
        }, { quoted: fake });
    }
}

module.exports = tostatusCommand;