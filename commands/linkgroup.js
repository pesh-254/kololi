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

async function linkgroupCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { 
            text: 'Group command only'
        }, { quoted: fake });
    }

    try {
        const code = await sock.groupInviteCode(chatId);
        const metadata = await sock.groupMetadata(chatId);
        
        await sock.sendMessage(chatId, { 
            text: `https://chat.whatsapp.com/${code}\n\nGroup: ${metadata.subject}\n- DAVE X`
        }, { quoted: fake });

    } catch (error) {
        console.error('Linkgroup Error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to get group link'
        }, { quoted: fake });
    }
}

module.exports = linkgroupCommand;