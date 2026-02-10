const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin'); // If you need admin checks

function createFakeContact(message) {
    const phoneNumber = message.key.participant?.split('@')[0] || 
                       message.key.remoteJid?.split('@')[0] || 
                       '254000000000';
    
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X BOT",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Bot;DAVE-X;;;\nFN:DAVE-X WhatsApp Bot\nitem1.TEL;waid=${phoneNumber}:${phoneNumber}\nitem1.X-ABLabel:Bot Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function clearSessionCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        
        // Owner check (only bot owner can clear session)
        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { 
                text: '❌ Owner command only!'
            }, { quoted: fake });
            return;
        }

        const sessionDir = path.join(__dirname, '../session');
        
        if (!fs.existsSync(sessionDir)) {
            return await sock.sendMessage(chatId, { 
                text: '❌ No session directory found!'
            }, { quoted: fake });
        }

        await sock.sendMessage(chatId, { 
            text: '🧹 Cleaning session files...'
        }, { quoted: fake });

        const files = fs.readdirSync(sessionDir);
        let stats = {
            cleared: 0,
            appStateSync: 0,
            preKeys: 0,
            errors: []
        };

        // Process files
        for (const file of files) {
            if (file === 'creds.json') continue; // Keep credentials
            
            if (file.startsWith('app-state-sync-')) stats.appStateSync++;
            if (file.startsWith('pre-key-')) stats.preKeys++;
            
            try {
                fs.unlinkSync(path.join(sessionDir, file));
                stats.cleared++;
            } catch (error) {
                stats.errors.push(error.message);
            }
        }

        // Build result message
        let resultMsg = `Session cleared!\n\n`;
        resultMsg += `Files removed: ${stats.cleared}\n`;
        resultMsg += `App states: ${stats.appStateSync}\n`;
        resultMsg += `Pre-keys: ${stats.preKeys}\n`;
        
        if (stats.errors.length > 0) {
            resultMsg += `\n⚠️ Issues: ${stats.errors.length}`;
        }

        await sock.sendMessage(chatId, { 
            text: resultMsg
        }, { quoted: fake });

    } catch (error) {
        console.error('Clear session error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Command failed!'
        }, { quoted: fake });
    }
}

module.exports = clearSessionCommand;