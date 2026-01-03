const Obfuscator = require("javascript-obfuscator");

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

async function encryptCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (quotedMessage?.conversation || quotedMessage?.extendedTextMessage?.text) {
        const code = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;

        try {
            const obfuscationResult = Obfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 1,
                numbersToExpressions: true,
                simplify: true,
                stringArrayShuffle: true,
                splitStrings: true,
                stringArrayThreshold: 1
            });

            const encryptedCode = obfuscationResult.getObfuscatedCode();
            
            await sock.sendMessage(chatId, { 
                text: encryptedCode
            }, { quoted: fake });

        } catch (error) {
            console.error("Encrypt Error:", error);
            await sock.sendMessage(chatId, { 
                text: "Failed to encrypt code. Invalid JavaScript syntax."
            }, { quoted: fake });
        }
    } else {
        await sock.sendMessage(chatId, { 
            text: "Tag a valid JavaScript code to encrypt!"
        }, { quoted: fake });
    }
}

module.exports = encryptCommand;