const isAdmin = require('../lib/isAdmin');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function tagAllCommand(sock, chatId, senderId, message) {
    const fake = createFakeContact(senderId);
    const botName = getBotName();
    
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        
        if (!isSenderAdmin && !isBotAdmin && !message?.key?.fromMe && !db.isSudo(senderId)) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAdmin only command!`
            }, { quoted: fake });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nNo participants found!` 
            }, { quoted: fake });
            return;
        }

        let profilePictureUrl = null;
        try {
            profilePictureUrl = await sock.profilePictureUrl(chatId, 'image');
        } catch (error) {}

        let textContent = `*${botName} TAGALL*\n\n`;
        textContent += `Group: ${groupMetadata.subject}\n`;
        textContent += `Members: ${participants.length}\n\n`;

        participants.forEach((participant, index) => {
            const number = (index + 1).toString().padStart(2, '0');
            const username = participant.id.split('@')[0];
            const displayName = participant.name || participant.notify || username;
            textContent += `${number}. @${username} (${displayName})\n`;
        });

        const mentions = participants.map(p => p.id);

        if (profilePictureUrl) {
            await sock.sendMessage(chatId, {
                image: { url: profilePictureUrl },
                caption: textContent,
                mentions: mentions
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, {
                text: textContent,
                mentions: mentions
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('TagAll error:', error.message, 'Line:', error.stack?.split('\n')[1]);
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nFailed to tag members.`
        }, { quoted: fake });
    }
}

module.exports = { tagAllCommand };
