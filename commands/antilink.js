const { getGroupConfig, setGroupConfig, parseToggleCommand, parseActionCommand } = require('../Database/settingsStore');
const db = require('../Database/database');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function handleAntiLinkDetection(sock, m) {
    try {
        if (!m?.message) return;
        if (m.key.fromMe) return;
        if (!m.key.remoteJid?.endsWith('@g.us')) return;

        const chatId = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid;

        const config = getGroupConfig(chatId, 'antilink');
        if (!config?.enabled) return;

        const groupMetadata = await sock.groupMetadata(chatId);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const bot = groupMetadata.participants.find(p => p.id === botId);
        if (!bot?.admin) return;

        const participant = groupMetadata.participants.find(p => p.id === sender);
        if (participant?.admin) return;
        if (db.isSudo(sender)) return;

        let text = "";
        if (m.message.conversation) {
            text = m.message.conversation;
        } else if (m.message.extendedTextMessage?.text) {
            text = m.message.extendedTextMessage.text;
        } else if (m.message.imageMessage?.caption) {
            text = m.message.imageMessage.caption;
        } else if (m.message.videoMessage?.caption) {
            text = m.message.videoMessage.caption;
        } else if (m.message.documentMessage?.caption) {
            text = m.message.documentMessage.caption;
        }

        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|bit\.ly\/[^\s]+|t\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/[^\s]+)/gi;
        if (!urlRegex.test(String(text).toLowerCase())) return;

        const botName = getBotName();
        const fake = createFakeContact(sender);

        await sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                fromMe: false,
                id: m.key.id,
                participant: sender,
            },
        });

        const username = sender.split('@')[0];
        const action = config.action || 'delete';
        const maxWarnings = config.maxWarnings || 3;

        switch (action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\n@${username}, no links allowed!\nMessage deleted.`,
                    mentions: [sender],
                }, { quoted: fake });
                break;

            case 'warn':
                const warningCount = db.incrementWarning(chatId, sender);
                if (warningCount >= maxWarnings) {
                    try {
                        await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                        db.resetWarning(chatId, sender);
                        await sock.sendMessage(chatId, {
                            text: `*${botName}*\n@${username} kicked after ${maxWarnings} warnings!\nLinks not allowed.`,
                            mentions: [sender],
                        }, { quoted: fake });
                    } catch {}
                } else {
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\n@${username}, no links allowed!\nWarning ${warningCount}/${maxWarnings}`,
                        mentions: [sender],
                    }, { quoted: fake });
                }
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                    await sock.sendMessage(chatId, {
                        text: `*${botName}*\n@${username} kicked for posting links.`,
                        mentions: [sender],
                    }, { quoted: fake });
                } catch (err) {
                    console.error('Failed to kick user:', err.message);
                }
                break;
        }
    } catch (err) {
        console.error('Error in handleAntiLinkDetection:', err.message, 'Line:', err.stack?.split('\n')[1]);
    }
}

async function handleAntilinkCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ');
        const subCmd = args[1]?.toLowerCase();
        const botName = getBotName();

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === senderId);
            if (!participant?.admin && !message.key.fromMe && !db.isSudo(senderId)) {
                const fake = createFakeContact(senderId);
                return sock.sendMessage(chatId, { 
                    text: `*${botName}*\nAdmin only command!` 
                }, { quoted: fake });
            }
        } catch {}

        const fake = createFakeContact(senderId);
        const config = getGroupConfig(chatId, 'antilink');

        if (!subCmd || subCmd === 'help') {
            const helpText = `*${botName} ANTILINK*\n\n` +
                            `Status: ${config.enabled ? 'ON' : 'OFF'}\n` +
                            `Action: ${config.action || 'delete'}\n` +
                            `Max Warnings: ${config.maxWarnings || 3}\n\n` +
                            `*Commands:*\n` +
                            `.antilink on - Enable\n` +
                            `.antilink off - Disable\n` +
                            `.antilink delete - Delete only\n` +
                            `.antilink warn - Warn (max = kick)\n` +
                            `.antilink kick - Delete & kick\n` +
                            `.antilink setwarn <num> - Set max warnings\n` +
                            `.antilink status - Show status`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        if (subCmd === 'status') {
            const status = config.enabled ? 'Enabled' : 'Disabled';
            const action = config.action || 'delete';
            
            await sock.sendMessage(chatId, {
                text: `*${botName} ANTILINK STATUS*\n\nStatus: ${status}\nAction: ${action}\nMax Warnings: ${config.maxWarnings || 3}`
            }, { quoted: fake });
            return;
        }

        if (subCmd.startsWith('setwarn')) {
            const num = parseInt(args[2]);
            if (num > 0 && num <= 10) {
                const newConfig = { ...config, maxWarnings: num };
                setGroupConfig(chatId, 'antilink', newConfig);
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nMax warnings set to: ${num}`
                }, { quoted: fake });
            } else {
                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nInvalid number! Use 1-10`
                }, { quoted: fake });
            }
            return;
        }

        let newConfig = { ...config };
        let responseText = '';

        const toggle = parseToggleCommand(subCmd);
        if (toggle === 'on') {
            newConfig.enabled = true;
            responseText = `*${botName}*\nAntiLink ENABLED\nAction: ${newConfig.action || 'delete'}`;
        } else if (toggle === 'off') {
            newConfig.enabled = false;
            responseText = `*${botName}*\nAntiLink DISABLED`;
        } else {
            const action = parseActionCommand(subCmd);
            if (action === 'delete') {
                newConfig.action = 'delete';
                newConfig.enabled = true;
                responseText = `*${botName}*\nAction: DELETE\nLinks will be deleted.`;
            } else if (action === 'warn') {
                newConfig.action = 'warn';
                newConfig.enabled = true;
                responseText = `*${botName}*\nAction: WARN\n${newConfig.maxWarnings || 3} warnings = kick.`;
            } else if (action === 'kick') {
                newConfig.action = 'kick';
                newConfig.enabled = true;
                responseText = `*${botName}*\nAction: KICK\nLink senders will be removed.`;
            } else {
                responseText = `*${botName}*\nInvalid option!\nUse: on, off, delete, warn, kick`;
            }
        }

        if (responseText && !responseText.includes('Invalid')) {
            setGroupConfig(chatId, 'antilink', newConfig);
        }

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });

    } catch (error) {
        console.error('Error in handleAntilinkCommand:', error.message, 'Line:', error.stack?.split('\n')[1]);
        const botName = getBotName();
        await sock.sendMessage(chatId, {
            text: `*${botName}*\nFailed to configure antilink!`
        });
    }
}

async function getAntilink(groupId) {
    return getGroupConfig(groupId, 'antilink');
}

async function setAntilink(groupId, type, action) {
    const config = {
        enabled: type === 'on' || type === 'delete' || type === 'kick' || type === 'warn',
        action: action || 'delete'
    };
    setGroupConfig(groupId, 'antilink', config);
    return true;
}

module.exports = {
    handleAntiLinkDetection,
    handleAntilinkCommand,
    getAntilink,
    setAntilink
};
