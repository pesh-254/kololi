const axios = require('axios');

async function pairCommand(sock, chatId, q) {
    try {
        if (!q) {
            return sock.sendMessage(chatId, { text: "❌ Invalid phone number!" });
        }

        const phoneNumber = q.replace(/[^0-9]/g, '');
        const whatsappID = phoneNumber + '@s.whatsapp.net';
        const result = await sock.onWhatsApp(whatsappID);

        if (!result[0]?.exists) {
            return sock.sendMessage(chatId, { text: "❌ Number not on WhatsApp!" });
        }

        const response = await axios.get(`https://session-v35f.onrender.com/code?number=${phoneNumber}`);
        const pairingCode = response.data?.code;

        if (!pairingCode) {
            return sock.sendMessage(chatId, { text: "❌ Failed to get pairing code." });
        }

        await sock.sendMessage(chatId, { text: `*PAIRING CODE*\nPhone: ${phoneNumber}\nCode: ${pairingCode}` });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sock.sendMessage(chatId, { text: pairingCode });

    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, { text: "❌ Error. Try again later." });
    }
}

module.exports = pairCommand;
