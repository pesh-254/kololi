const moment = require('moment-timezone');

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

async function timeCommand(sock, chatId, message, args) {
    try {
        const fake = createFakeContact(message);
        
        // Default to UTC if no timezone specified
        let tz = args.length > 0 ? args.join("_") : "UTC";
        
        // Capitalize first letter
        tz = tz.charAt(0).toUpperCase() + tz.slice(1);

        // Get list of all timezones
        const zones = moment.tz.names();
        
        // Try to find a matching timezone
        let match = zones.find(z => z.toLowerCase().includes(tz.toLowerCase()));

        if (!match) {
            // Show popular timezones
            const popularTimezones = [
                'Africa/Nairobi',
                'Asia/Tokyo',
                'America/New_York',
                'Europe/London',
                'Asia/Dubai',
                'Australia/Sydney',
                'Asia/Singapore',
                'Asia/Kolkata'
            ];
            
            let suggestions = '🌍 *Popular Timezones:*\n\n';
            popularTimezones.forEach(tz => {
                const city = tz.split('/')[1].replace('_', ' ');
                suggestions += `• .time ${city}\n`;
            });
            
            suggestions += '\n*Full list:* .time list';
            
            await sock.sendMessage(chatId, { 
                text: `❌ Timezone *${tz}* not found!\n\n${suggestions}` 
            }, { quoted: fake });
            return;
        }

        // Get current time
        const now = moment().tz(match);
        const timeZoneAbbr = now.format('z');
        const formattedDate = now.format('dddd, MMMM Do YYYY');
        const formattedTime = now.format('HH:mm:ss A');
        
        // Get city name for display
        const cityName = match.includes('/') ? match.split('/')[1].replace('_', ' ') : match;

        let reply = `🕒 *TIME: ${cityName}*\n\n`;
        reply += `📍 *Location:* ${match}\n`;
        reply += `📅 *Date:* ${formattedDate}\n`;
        reply += `⏰ *Time:* ${formattedTime}\n`;
        reply += `⏱️ *Timezone:* ${timeZoneAbbr}\n\n`;
        reply += `_Use \`.time list\` to see all available timezones_`;

        await sock.sendMessage(chatId, { 
            text: reply 
        }, { quoted: fake });
        
    } catch (error) {
        console.error('Error in time command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while fetching the time.' 
        }, { quoted: fake });
    }
}

module.exports = {
    timeCommand
};