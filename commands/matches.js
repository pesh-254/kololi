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

async function matchesCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);

        // Send loading reaction
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Fetch all league matches in parallel
        const [plData, laligaData, bundesligaData, serieAData, ligue1Data] = await Promise.all([
            axios.get('https://api.dreaded.site/api/matches/PL'),
            axios.get('https://api.dreaded.site/api/matches/PD'),
            axios.get('https://api.dreaded.site/api/matches/BL1'),
            axios.get('https://api.dreaded.site/api/matches/SA'),
            axios.get('https://api.dreaded.site/api/matches/FR')
        ]);

        const pl = plData.data?.data || "No matches scheduled";
        const laliga = laligaData.data?.data || "No matches scheduled";
        const bundesliga = bundesligaData.data?.data || "No matches scheduled";
        const serieA = serieAData.data?.data || "No matches scheduled";
        const ligue1 = ligue1Data.data?.data || "No matches scheduled";

        let messageText = `⚽ *Today's Football Matches* ⚽\n\n`;

        // Helper function to format matches
        const formatMatches = (matches, leagueName, emoji) => {
            if (typeof matches === 'string') {
                return `${emoji} ${leagueName}:\n${matches}\n\n`;
            } else if (Array.isArray(matches) && matches.length > 0) {
                const matchesList = matches.map(match => {
                    const { game, date, time } = match;
                    return `• ${game}\n  📅 ${date} | 🕐 ${time} (EAT)`;
                }).join('\n');
                return `${emoji} ${leagueName}:\n${matchesList}\n\n`;
            } else {
                return `${emoji} ${leagueName}: No matches scheduled\n\n`;
            }
        };

        // Add each league's matches
        messageText += formatMatches(pl, "Premier League", "🇬🇧");
        messageText += formatMatches(laliga, "La Liga", "🇪🇸");
        messageText += formatMatches(bundesliga, "Bundesliga", "🇩🇪");
        messageText += formatMatches(serieA, "Serie A", "🇮🇹");
        messageText += formatMatches(ligue1, "Ligue 1", "🇫🇷");

        messageText += "🕐 Times are in East African Timezone (EAT)";

        // Split message if too long (WhatsApp has message length limits)
        if (messageText.length > 4096) {
            // Split into chunks
            const chunks = [];
            let currentChunk = '';
            const lines = messageText.split('\n');
            
            for (const line of lines) {
                if (currentChunk.length + line.length + 1 > 4096) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }
            if (currentChunk) chunks.push(currentChunk);
            
            // Send first chunk with quote
            await sock.sendMessage(chatId, { text: chunks[0] }, { quoted: fake });
            
            // Send remaining chunks without quote
            for (let i = 1; i < chunks.length; i++) {
                await sock.sendMessage(chatId, { text: chunks[i] });
            }
        } else {
            await sock.sendMessage(chatId, { text: messageText }, { quoted: fake });
        }

        // Send success reaction
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Error fetching matches:', error);
        const fake = createFakeContact(message);

        // Send error message
        await sock.sendMessage(chatId, { 
            text: '❌ Something went wrong. Unable to fetch matches.' 
        }, { quoted: fake });

        // Send error reaction
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = {
    matchesCommand
};