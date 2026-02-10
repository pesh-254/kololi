const fetch = require('node-fetch');

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

async function defineCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);

        let word = '';

        // Check if user replied to a message
        const quotedText = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
                          message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;

        if (quotedText) {
            // Get the first word from quoted message
            word = quotedText.split(' ')[0].trim();
        } else if (args.length > 0) {
            word = args.join(' ');
        } else {
            await sock.sendMessage(chatId, { 
                text: '📚 *DICTIONARY*\n\n*Usage:*\n.define <word>\n\n*Or reply to a message:*\nReply with: .define\n\n*Examples:*\n.define apple\n.define technology\n.define perseverance' 
            }, { quoted: fake });
            return;
        }

        // Validate word
        if (!word || word.length < 2) {
            await sock.sendMessage(chatId, { 
                text: '❌ Please provide a valid word (minimum 2 characters).' 
            }, { quoted: fake });
            return;
        }

        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch definition from API
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                await sock.sendMessage(chatId, { 
                    text: `❌ Word "*${word}*" not found in dictionary!\n\n*Try:*\n• Check spelling\n• Use simpler words\n• Try synonyms\n• English words only` 
                }, { quoted: fake });
                return;
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data[0]) {
            await sock.sendMessage(chatId, { 
                text: `❌ No definition found for "*${word}*".` 
            }, { quoted: fake });
            return;
        }

        const wordData = data[0];

        // Format response
        let result = `📚 *DICTIONARY: ${wordData.word.toUpperCase()}*\n\n`;
        
        // Phonetic pronunciation
        if (wordData.phonetic || wordData.phonetics?.[0]?.text) {
            const phonetic = wordData.phonetic || wordData.phonetics[0].text;
            result += `🔊 *Pronunciation:* ${phonetic}\n\n`;
        }

        // Definitions
        if (wordData.meanings && wordData.meanings.length > 0) {
            // Show first 3 meanings
            wordData.meanings.slice(0, 3).forEach((meaning, index) => {
                result += `*${index + 1}. ${meaning.partOfSpeech.toUpperCase()}*\n`;
                
                if (meaning.definitions && meaning.definitions.length > 0) {
                    // Show first 2 definitions per meaning
                    meaning.definitions.slice(0, 2).forEach((def, defIndex) => {
                        result += `   ${defIndex + 1}. ${def.definition}\n`;
                        if (def.example) {
                            result += `      *Example:* ${def.example}\n`;
                        }
                        if (def.synonyms && def.synonyms.length > 0) {
                            result += `      *Synonyms:* ${def.synonyms.slice(0, 3).join(', ')}\n`;
                        }
                    });
                }
                result += '\n';
            });
        }

        // Synonyms
        const allSynonyms = [];
        wordData.meanings?.forEach(meaning => {
            meaning.definitions?.forEach(def => {
                if (def.synonyms) allSynonyms.push(...def.synonyms);
            });
            if (meaning.synonyms) allSynonyms.push(...meaning.synonyms);
        });

        if (allSynonyms.length > 0) {
            const uniqueSynonyms = [...new Set(allSynonyms)].slice(0, 5);
            result += `✨ *Synonyms:* ${uniqueSynonyms.join(', ')}\n`;
        }

        // Antonyms
        const allAntonyms = [];
        wordData.meanings?.forEach(meaning => {
            meaning.definitions?.forEach(def => {
                if (def.antonyms) allAntonyms.push(...def.antonyms);
            });
            if (meaning.antonyms) allAntonyms.push(...meaning.antonyms);
        });

        if (allAntonyms.length > 0) {
            const uniqueAntonyms = [...new Set(allAntonyms)].slice(0, 5);
            result += `🔄 *Antonyms:* ${uniqueAntonyms.join(', ')}\n`;
        }

        // Source
        result += `\n📖 *Source:* dictionaryapi.dev`;

        await sock.sendMessage(chatId, { 
            text: result 
        }, { quoted: fake });

    } catch (error) {
        console.error('Error in define command:', error);
        const fake = createFakeContact(message);
        
        let errorMessage = '❌ Failed to fetch definition.';
        
        if (error.message.includes('Network') || error.message.includes('fetch')) {
            errorMessage = '❌ Network error. Could not connect to dictionary API.\n\nTry again in a moment.';
        } else if (error.message.includes('API Error')) {
            errorMessage = '❌ Dictionary API is currently unavailable.\n\nTry again later.';
        }

        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: fake });
    }
}

module.exports = {
    defineCommand
};