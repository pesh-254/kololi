const axios = require("axios");

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

async function googleCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const query = text.split(' ').slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, { 
            text: "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n" +
                  "│ ❒ ERROR\n" +
                  "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n" +
                  "│ 🚫 Please provide a search term!\n" +
                  "│ ❒ Example: .google What is treason\n" +
                  "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈"
        }, { quoted: fake });
    }

    try {
        await sock.sendMessage(chatId, { 
            text: "🔍 Searching Google..."
        }, { quoted: fake });

        let { data } = await axios.get(
            `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=AIzaSyDMbI3nvmQUrfjoCJYLS69Lej1hSXQjnWI&cx=baf9bdb0c631236e5`
        );

        if (!data.items || data.items.length == 0) {
            return sock.sendMessage(chatId, { 
                text: "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n" +
                      "│ ❒ ERROR\n" +
                      "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n" +
                      "│ ❌ Unable to find any results\n" +
                      "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈"
            }, { quoted: fake });
        }

        let tex = "";
        tex += "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n";
        tex += "│ ❒ GOOGLE SEARCH\n";
        tex += "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n";
        tex += "│ 🔍 Search Term: " + query + "\n";
        tex += "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n";

        // Show only first 3 results to avoid message too long
        const results = data.items.slice(0, 3);
        
        for (let i = 0; i < results.length; i++) {
            tex += "│ ❒ Result " + (i + 1) + "\n";
            tex += "│ 🪧 Title: " + results[i].title + "\n";
            tex += "│ 📝 Description: " + results[i].snippet + "\n";
            tex += "│ 🌐 Link: " + results[i].link + "\n";
            tex += "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n";
        }

        tex += `│ 📊 Total Results: ${data.searchInformation?.formattedTotalResults || 'Unknown'}\n`;
        tex += `│ ⚡ Search Time: ${data.searchInformation?.formattedSearchTime || 'Unknown'} seconds\n`;
        tex += "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈";

        return sock.sendMessage(chatId, { 
            text: tex
        }, { quoted: fake });

    } catch (e) {
        console.error("Google Search Error:", e);
        return sock.sendMessage(chatId, { 
            text: "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n" +
                  "│ ❒ ERROR\n" +
                  "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈\n" +
                  "│ ❌ An error occurred: " + e.message + "\n" +
                  "◈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◈"
        }, { quoted: fake });
    }
}

module.exports = googleCommand;