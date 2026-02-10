const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

async function getgppCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        
        // Only works in groups
        if (!chatId.endsWith("@g.us")) {
            await sock.sendMessage(chatId, {
                text: "❌ This command can only be used in group chats."
            }, { quoted: fake });
            return;
        }

        // Get group metadata for name
        let groupName = "Unknown Group";
        try {
            const metadata = await sock.groupMetadata(chatId);
            groupName = metadata.subject || "Group";
        } catch (error) {
            console.log('Could not fetch group metadata:', error.message);
        }

        // Try to get the group profile picture
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(chatId, "image");
        } catch (error) {
            console.log('No group profile picture:', error.message);
            // Fallback image
            ppUrl = "https://files.catbox.moe/lvcwnf.jpg";
        }

        // Create temp directory if it doesn't exist
        const tmpDir = path.join(__dirname, '..', 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const filePath = path.join(tmpDir, `gpp_${Date.now()}.jpg`);

        // Download the image
        await sock.sendMessage(chatId, {
            text: "🔄 Fetching group profile picture..."
        }, { quoted: fake });

        const response = await axios.get(ppUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000 // 10 second timeout
        });

        // Save to temp file
        fs.writeFileSync(filePath, Buffer.from(response.data));

        // Check if file exists and has content
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error('Downloaded file is empty');
        }

        // Send the image
        await sock.sendMessage(chatId, {
            image: fs.readFileSync(filePath),
            caption: `📸 *GROUP PROFILE PICTURE*\n\n*Group:* ${groupName}\n\n✅ Successfully retrieved!`
        }, { quoted: fake });

        // Clean up temp file
        try {
            fs.unlinkSync(filePath);
        } catch (cleanupError) {
            console.log('Could not delete temp file:', cleanupError.message);
        }

    } catch (error) {
        console.error('Error in getgpp command:', error);
        const fake = createFakeContact(message);
        
        let errorMessage = '❌ Failed to retrieve group profile picture!';
        
        if (error.message.includes('timeout')) {
            errorMessage = '❌ Request timed out. The server might be slow.\n\nTry again in a moment.';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('Network Error')) {
            errorMessage = '❌ Network error. Could not fetch the image.\n\nMake sure the bot can access external URLs.';
        } else if (error.message.includes('404')) {
            errorMessage = '❌ Group has no profile picture set!\n\nGroups show a default image when no picture is set.';
        } else if (error.message.includes('profile picture') && error.message.includes('404')) {
            errorMessage = '❌ This group has no profile picture.\n\nGroups show a default image when no picture is set.';
        } else {
            errorMessage = `❌ Error: ${error.message}`;
        }

        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: fake });
    }
}

module.exports = {
    getgppCommand
};