const { getGroupConfig, setGroupConfig } = require('../Database/settingsStore');
const db = require('../Database/database');
const isAdmin = require('../lib/isAdmin');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const { getPrefix } = require('./setprefix');

async function handleAntidemote(sock, groupId, participants, author) {
    try {
        const config = getGroupConfig(groupId, 'antidemote');
        if (!config || !config.enabled) return false;

        const groupMetadata = await sock.groupMetadata(groupId);
        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        const botName = getBotName();

        const isAuthorOwner = author === groupMetadata.owner;
        const isAuthorBot = author === botJid || author === sock.user?.id;
        const isAuthorSudo = db.isSudo(author);

        if (isAuthorOwner || isAuthorBot || isAuthorSudo) {
            await sock.sendMessage(groupId, {
                text: `*${botName} ANTIDEMOTE*\n\n@${participants[0].split('@')[0]} demoted by authorized user.`,
                mentions: [participants[0], author]
            });
            return true;
        }

        const botAdminStatus = await isAdmin(sock, groupId, botJid);
        if (!botAdminStatus.isBotAdmin) {
            await sock.sendMessage(groupId, {
                text: `*${botName}*\nCannot reverse demotion - bot needs admin!`
            });
            return false;
        }

        await sock.groupParticipantsUpdate(groupId, [author], "demote");
        await sock.groupParticipantsUpdate(groupId, participants, "promote");

        await sock.sendMessage(groupId, {
            text: `*${botName} ANTIDEMOTE*\n\n@${author.split('@')[0]} DEMOTED for unauthorized demotion!\n@${participants[0].split('@')[0]} PROMOTED back!`,
            mentions: [author, participants[0]]
        });

        return true;
    } catch (error) {
        console.error('Error in handleAntidemote:', error.message, 'Line:', error.stack?.split('\n')[1]);
        return false;
    }
}

async function antidemoteCommand(sock, chatId, message, senderId) {
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
            const config = getGroupConfig(chatId, 'antidemote') || { enabled: false };
            await sock.sendMessage(chatId, {
                text: `*${botName} ANTIDEMOTE*\n\nStatus: ${config.enabled ? 'ON' : 'OFF'}\n\n*Commands:*\n${prefix}antidemote on - Enable\n${prefix}antidemote off - Disable\n${prefix}antidemote status - Check status\n\n*What it does:*\nBlocks unauthorized demotions and re-promotes victims.`
            }, { quoted: fake });
            return;
        }

        if (subCmd === 'status') {
            const config = getGroupConfig(chatId, 'antidemote') || { enabled: false };
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAntidemote: ${config.enabled ? 'ACTIVE' : 'INACTIVE'}`
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
            setGroupConfig(chatId, 'antidemote', { enabled: true });
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAntidemote ENABLED\nUnauthorized demotions will be reversed!`
            }, { quoted: fake });
        } else if (subCmd === 'off') {
            setGroupConfig(chatId, 'antidemote', { enabled: false });
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nAntidemote DISABLED`
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\nInvalid option! Use: on, off, status`
            }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antidemoteCommand:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = {
    handleAntidemote,
    antidemoteCommand
};
