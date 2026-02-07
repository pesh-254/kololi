const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function getppCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        // Check if user is owner (keep original logic)
        const isOwner = message.key.fromMe;
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nCommand only for the owner.`
            }, { quoted: fake });
            return;
        }

        let userToAnalyze;
        
        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToAnalyze = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToAnalyze = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToAnalyze) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nPlease mention someone or reply to their message to get their profile picture`
            }, { quoted: fake });
            return;
        }

        try {
            // Get user's profile picture
            let profilePic;
            try {
                profilePic = await sock.profilePictureUrl(userToAnalyze, 'image');
            } catch {
                profilePic = 'https://files.catbox.moe/lvcwnf.jpg'; // Default image
            }

            // Send the profile picture
            await sock.sendMessage(chatId, {
                image: { url: profilePic },
                caption: `*${botName}*\n✅ Profile picture of: @${userToAnalyze.split('@')[0]}`,
                mentions: [userToAnalyze]
            }, { quoted: fake });

        } catch (error) {
            console.error('Error in getpp command:', error.message);
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Failed to retrieve profile picture.`
            }, { quoted: fake });
        }
    } catch (error) {
        console.error('Unexpected error in getppCommand:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ An unexpected error occurred.`
        }, { quoted: fake });
    }
}

module.exports = getppCommand;