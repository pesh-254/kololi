const { isSudo } = require('../lib/index');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

function isUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function joinGroupCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const groupLink = args[1];
        
        // Owner/sudo check
        const senderIsSudo = await isSudo(senderId);
        if (!message.key.fromMe && !senderIsSudo) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n📛 Owner only command!`
            }, { quoted: fake });
            return;
        }

        if (!groupLink) {
            await sock.sendMessage(chatId, {
                text: `*${botName} JOIN GROUP*\n\n` +
                      `Make bot join a group via invite link\n\n` +
                      `*Usage:*\n` +
                      `.join https://chat.whatsapp.com/INVITE_CODE\n\n` +
                      `*Note:* Owner/sudo only`
            }, { quoted: fake });
            return;
        }

        if (!isUrl(groupLink) || !groupLink.includes('whatsapp.com')) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Invalid WhatsApp group link!`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n⏳ Joining group...`
        }, { quoted: fake });

        try {
            const inviteCode = groupLink.split('https://chat.whatsapp.com/')[1];
            const response = await sock.groupAcceptInvite(inviteCode);
            
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n✅ Successfully joined the group!`
            }, { quoted: fake });
            
        } catch (error) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Failed to join group: ${error.message}`
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Join group error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Error: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = { joinGroupCommand };