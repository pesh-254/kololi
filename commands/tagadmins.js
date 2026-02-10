const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function tagAdminsCommand(sock, chatId, senderId, message, fullArgs) {
    try {
        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants;
        const botName = getBotName();
        const fake = createFakeContact(message);

        const superAdmins = [];
        const admins = [];

        for (const p of participants) {
            if (p.admin === 'superadmin') {
                superAdmins.push(p.id);
            } else if (p.admin === 'admin') {
                admins.push(p.id);
            }
        }

        const allAdmins = [...superAdmins, ...admins];

        if (allAdmins.length === 0) {
            await sock.sendMessage(chatId, { text: 'No admins found in this group!' }, { quoted: fake });
            return;
        }

        const mentions = [...allAdmins, senderId];

        let text = `*${botName} TAG ADMINS*\n\n`;

        if (fullArgs && fullArgs.trim()) {
            text += `*Message:* ${fullArgs.trim()}\n\n`;
        }

        text += `*Tagged By:* @${senderId.split('@')[0].split(':')[0]}\n\n`;
        text += `*Admins:*\n`;

        for (const id of superAdmins) {
            text += `@${id.split('@')[0].split(':')[0]}\n`;
        }
        for (const id of admins) {
            text += `@${id.split('@')[0].split(':')[0]}\n`;
        }

        await sock.sendMessage(chatId, {
            text: text.trim(),
            mentions
        }, { quoted: fake });
    } catch (error) {
        console.error('Tagadmins error:', error);
        await sock.sendMessage(chatId, { text: `Failed to tag admins: ${error.message}` });
    }
}

module.exports = tagAdminsCommand;
