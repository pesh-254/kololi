const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { createFakeContact, getBotName } = require('../lib/fakeContact');
const fetch = require('node-fetch');

async function welcomeCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { 
            text: 'Group command only.' 
        }, { quoted: fake });
        return;
    }

    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    try {
        const isWelcomeEnabled = await isWelcomeOn(id);
        if (!isWelcomeEnabled) return;

        const customMessage = await getWelcome(id);
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject;
        const groupDesc = groupMetadata.desc || 'No description';
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
                        .replace(/{description}/g, groupDesc)
                        .replace(/{bot}/g, botName);
                } else {
                    const now = new Date();
                    const timeString = now.toLocaleString('en-US', {
                        month: '2-digit',
                        day: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });

                    finalMessage = `*${botName}*\n\nWelcome @${displayName} to ${groupName}!\nTime: ${timeString}`;
                }

                try {
                    let profilePicUrl = `https://img.pyrocdn.com/dbKUgahg.png`;
                    try {
                        const profilePic = await sock.profilePictureUrl(participantString, 'image');
                        if (profilePic) {
                            profilePicUrl = profilePic;
                        }
                    } catch (profileError) {}

                    const apiUrl = `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;

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
                console.error('Welcome error:', error.message, 'Line:', error.stack?.split('\n')[1]);
                
                const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
                const user = participantString.split('@')[0];

                let fallbackMessage;
                if (customMessage) {
                    fallbackMessage = customMessage
                        .replace(/{user}/g, `@${user}`)
                        .replace(/{group}/g, groupName)
                        .replace(/{description}/g, groupDesc);
                } else {
                    fallbackMessage = `Welcome @${user} to ${groupName}!`;
                }

                await sock.sendMessage(id, {
                    text: fallbackMessage,
                    mentions: [participantString]
                });
            }
        }
    } catch (err) {
        console.error('handleJoinEvent error:', err.message, 'Line:', err.stack?.split('\n')[1]);
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
