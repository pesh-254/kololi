const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function reportCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const reportText = args.slice(1).join(' ');
        
        if (!reportText) {
            await sock.sendMessage(chatId, {
                text: `*${botName} REPORT*\n\n` +
                      `Report bugs or send requests to owner\n\n` +
                      `*Usage:*\n` +
                      `.bug hi dev play command is not working\n` +
                      `.report feature request for X\n` +
                      `.request can you add Y feature\n\n` +
                      `Reports are sent to: 254104260236`
            }, { quoted: fake });
            return;
        }

        const ownerNumber = '254104260236@s.whatsapp.net';
        const senderNumber = senderId.split('@')[0];
        const senderName = message.pushName || senderNumber;

        // Send report to owner
        await sock.sendMessage(ownerNumber, {
            text: `*⚠️ NEW REPORT/BUG*\n\n` +
                  `*From:* @${senderNumber}\n` +
                  `*Name:* ${senderName}\n` +
                  `*Chat:* ${chatId}\n` +
                  `*Report:* ${reportText}\n\n` +
                  `*Time:* ${new Date().toLocaleString()}`,
            mentions: [senderId]
        });

        // Send confirmation to user
        await sock.sendMessage(chatId, {
            text: `*${botName} REPORT*\n\n` +
                  `✅ Report sent to owner!\n\n` +
                  `*Your Report:* ${reportText}\n` +
                  `*Status:* Forwarded to owner (254104260236)\n` +
                  `*Note:* Please wait for response in your DMs`
        }, { quoted: fake });

    } catch (error) {
        console.error('Report error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Failed to send report: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = {
    reportCommand
};