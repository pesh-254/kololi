const { getGroupConfig, setGroupConfig } = require('../Database/settingsStore');
const db = require('../Database/database');
const isAdmin = require('../lib/isAdmin');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const { getPrefix } = require('./setprefix');

async function handleAntipromote(sock, groupId, participants, author) {
    try {
        const config = getGroupConfig(groupId, 'antipromote');
        if (!config || !config.enabled) return false;

        const groupMetadata = await sock.groupMetadata(groupId);
        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        const botName = getBotName();

        const isAuthorOwner = author === groupMetadata.owner;
        const isAuthorBot = author === botJid || author === sock.user?.id;
        const isAuthorSudo = db.isSudo(author);

        if (isAuthorOwner || isAuthorBot || isAuthorSudo) {
            await sock.sendMessage(groupId, {
                text: `*${botName} ANTIPROMOTE*\n\n@${participants[0].split('@')[0]} promoted by authorized user.`,
                mentions: [participants[0], author]
            });
            return true;
        }

        const botAdminStatus = await isAdmin(sock, groupId, botJid);
        if (!botAdminStatus.isBotAdmin) {
            await sock.sendMessage(groupId, {
                text: `*${botName}*\nCannot reverse promotion - bot needs admin!`
            });
            return false;
        }

        await sock.groupParticipantsUpdate(groupId, [author, participants[0]], "demote");

        await sock.sendMessage(groupId, {
            text: `*${botName} ANTIPROMOTE*\n\n@${author.split('@')[0]} DEMOTED for unauthorized promotion!\n@${participants[0].split('@')[0]} DEMOTED as well!`,
            mentions: [author, participants[0]]
        });

        return true;
    } catch (error) {
        console.error('Error in handleAntipromote:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return false;
    }
}

async function antipromoteCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        const prefix = getPrefix();

        const userMessage = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || '';
        const args = userMessage.split(' ');
        const subCmd = args[1]?.toLowerCase();

        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nGroup command only!`
            }, { quoted: fake });
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, senderId);
        const isSenderAdmin = adminStatus.isSenderAdmin;
        const isBotAdmin = adminStatus.isBotAdmin;

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nBot needs to be admin!`
            }, { quoted: fake });
            return;
        }

        if (!subCmd || subCmd === 'help') {
            const config = getGroupConfig(chatId, 'antipromote') || { enabled: false };
            await sock.sendMessage(chatId, {
                text: `*${botName} ANTIPROMOTE*\n\nStatus: ${config.enabled ? 'ON' : 'OFF'}\n\n*Commands:*\n${prefix}antipromote on - Enable\n${prefix}antipromote off - Disable\n${prefix}antipromote status - Check status\n\n*What it does:*\nBlocks unauthorized promotions and demotes offenders.`
            }, { quoted: fake });
            return;
        }

        if (subCmd === 'status') {
            const config = getGroupConfig(chatId, 'antipromote') || { enabled: false };
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAntipromote: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}`
            }, { quoted: fake });
            return;
        }

        if (!isSenderAdmin && !message.key.fromMe && !db.isSudo(senderId)) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAdmin only command!`
            }, { quoted: fake });
            return;
        }

        if (subCmd === 'on') {
            setGroupConfig(chatId, 'antipromote', { enabled: true });
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAntipromote ENABLED\nUnauthorized promotions will be reversed!`
            }, { quoted: fake });
        } else if (subCmd === 'off') {
            setGroupConfig(chatId, 'antipromote', { enabled: false });
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAntipromote DISABLED`
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nInvalid option! Use: on, off, status`
            }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antipromoteCommand:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    handleAntipromote,
    antipromoteCommand
};
