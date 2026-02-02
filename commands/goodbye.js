const { handleGoodbye } = require('../lib/welcome');
const { isGoodByeOn, getGoodbye } = require('../lib/index');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const fetch = require('node-fetch');

async function goodbyeCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' }, { quoted: fake });
        return;
    }

    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleGoodbye(sock, chatId, message, matchText);
}

async function handleLeaveEvent(sock, id, participants) {
    try {
        const isGoodbyeEnabled = await isGoodByeOn(id);
        if (!isGoodbyeEnabled) return;

        const customMessage = await getGoodbye(id);
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject;
        const botName = getBotName();

        for (const participant of participants) {
            try {
                const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                const user = participantString.split('@')[0];

                let displayName = user;
                try {
                    const contact = await sock.getBusinessProfile(participantString);
                    if (contact && contact.name) {
                        displayName = contact.name;
                    } else {
                        const groupParticipants = groupMetadata.participants;
                        const userParticipant = groupParticipants.find(p => p.id === participantString);
                        if (userParticipant && userParticipant.name) {
                            displayName = userParticipant.name;
                        }
                    }
                } catch (nameError) {}

                let finalMessage;
                if (customMessage) {
                    finalMessage = customMessage
                        .replace(/{user}/g, `@${displayName}`)
                        .replace(/{group}/g, groupName)
                        .replace(/{bot}/g, botName);
                } else {
                    finalMessage = `*${botName}*\n\n@${displayName} has left ${groupName}.`;
                }

                try {
                    let profilePicUrl = `https://img.pyrocdn.com/dbKUgahg.png`;
                    try {
                        const profilePic = await sock.profilePictureUrl(participantString, 'image');
                        if (profilePic) {
                            profilePicUrl = profilePic;
                        }
                    } catch (profileError) {}

                    const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming1?type=leave&textcolor=red&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;

                    const response = await fetch(apiUrl);
                    if (response.ok) {
                        const imageBuffer = await response.buffer();

                        await sock.sendMessage(id, {
                            image: imageBuffer,
                            caption: finalMessage,
                            mentions: [participantString]
                        });
                        continue;
                    }
                } catch (imageError) {}

                await sock.sendMessage(id, {
                    text: finalMessage,
                    mentions: [participantString]
                });
            } catch (error) {
                console.error('Goodbye error:', error.message, 'Line:', error.stack?.split('\n')[1]);
                
                const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                const user = participantString.split('@')[0];

                let fallbackMessage;
                if (customMessage) {
                    fallbackMessage = customMessage
                        .replace(/{user}/g, `@${user}`)
                        .replace(/{group}/g, groupName);
                } else {
                    fallbackMessage = `Goodbye @${user}!`;
                }

                await sock.sendMessage(id, {
                    text: fallbackMessage,
                    mentions: [participantString]
                });
            }
        }
    } catch (err) {
        console.error('handleLeaveEvent error:', err.message, 'Line:', err.stack?.split('\n')[1]);
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
