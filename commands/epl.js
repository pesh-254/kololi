const axios = require("axios");

function createFakeContact(message) {
    const participantId = message?.key?.participant?.split('@')[0] || 
                          message?.key?.remoteJid?.split('@')[0] || '0';

    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function eplStandingsCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);

        // Send loading reaction
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const apiUrl = "https://api.dreaded.site/api/standings/PL";
        const response = await axios.get(apiUrl);

        if (!response.data || !response.data.data) {
            await sock.sendMessage(chatId, { 
                text: '❌ Unable to fetch EPL standings. Please try again later.' 
            }, { quoted: fake });
            return;
        }

        const standings = response.data.data;

        // Format the standings
        let standingsList = `⚽ *EPL TABLE STANDINGS* ⚽\n\n`;
        standingsList += `${standings}`;

        // Send the standings
        await sock.sendMessage(chatId, { text: standingsList }, { quoted: fake });

        // Send success reaction
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Error fetching EPL standings:', error);
        const fake = createFakeContact(message);

        // Send error message
        await sock.sendMessage(chatId, { 
            text: '❌ Something went wrong. Unable to fetch EPL standings.' 
        }, { quoted: fake });

        // Send error reaction
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = {
    eplStandingsCommand
};