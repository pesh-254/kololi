const isAdmin = require('../lib/isAdmin');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Admin",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Admin;;;\nFN:Davex Admin Tools\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Admin Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function muteCommand(sock, chatId, senderId, message, durationInMinutes) {
    const fakeContact = createFakeContact(message);

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: fakeContact });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: 'Only group admins can use the mute command.' }, { quoted: fakeContact });
        return;
    }

    try {
        let groupName = "the group";
        
        // Try to get group metadata to get the group name
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            groupName = groupMetadata.subject || "the group";
        } catch (metadataError) {
            console.error('Error fetching group metadata:', metadataError);
            // Continue with default group name if metadata fetch fails
        }

        // Mute the group
        await sock.groupSettingUpdate(chatId, 'announcement');
        
        if (durationInMinutes !== undefined && durationInMinutes > 0) {
            const durationInMilliseconds = durationInMinutes * 60 * 1000;
            await sock.sendMessage(chatId, { 
                text: `🔇 ${groupName} has been muted for ${durationInMinutes} minutes.\n\n🎄 *Merry Christmas!* 🎄` 
            }, { quoted: fakeContact });
            
            // Store the timeout reference to prevent memory leaks
            const unmuteTimeout = setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, { 
                        text: `🔊 ${groupName} has been unmuted automatically.\n\n🎄 *Merry Christmas!* 🎄`,
                        quoted: fakeContact 
                    });
                } catch (unmuteError) {
                    console.error('Error unmuting group:', unmuteError);
                    try {
                        await sock.sendMessage(chatId, { 
                            text: `❌ Failed to automatically unmute ${groupName}. Please unmute manually.\n\n🎄 *Merry Christmas!* 🎄`,
                            quoted: fakeContact 
                        });
                    } catch (sendError) {
                        console.error('Error sending unmute failure message:', sendError);
                    }
                }
            }, durationInMilliseconds);

            // Optional: Store the timeout reference if you need to clear it later
            // You might want to store this in a Map or object for management
            // timeoutReferences.set(chatId, unmuteTimeout);

        } else {
            await sock.sendMessage(chatId, { 
                text: `🔇 ${groupName} has been muted.\n\n🎄 *Merry Christmas!* 🎄` 
            }, { quoted: fakeContact });
        }
    } catch (error) {
        console.error('Error muting/unmuting the group:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while muting the group. Please try again.\n\n🎄 *Merry Christmas!* 🎄' 
        }, { quoted: fakeContact });
    }
}

module.exports = muteCommand;