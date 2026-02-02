const path = require('path');
const fs = require('fs');
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

setInterval(() => {
  fs.readdir(customTemp, (err, files) => {
    if (err) return;
    for (const file of files) {
      const filePath = path.join(customTemp, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    }
  });
  console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

const originalWrite = process.stdout.write;
process.stdout.write = function (chunk, encoding, callback) {
    const message = chunk.toString();
    if (message.includes('Closing session: SessionEntry') || message.includes('SessionEntry {')) {
        return;
    }
    return originalWrite.apply(this, arguments);
};

const originalWriteError = process.stderr.write;
process.stderr.write = function (chunk, encoding, callback) {
    const message = chunk.toString();
    if (message.includes('Closing session: SessionEntry')) {
        return;
    }
    return originalWriteError.apply(this, arguments);
};

const originalLog = console.log;
console.log = function (message, ...optionalParams) {
    if (typeof message === 'string' && message.startsWith('Closing session: SessionEntry')) {
        return;
    }
    originalLog.apply(console, [message, ...optionalParams]);
};

const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const chalk = require('chalk');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { jidDecode } = require('@whiskeysockets/baileys');
const { isSudo } = require('./lib/index');
const isAdmin = require('./lib/isAdmin');

const {
    getMessageText,
    isEditedMessage,
    getEditedMessageText,
    extractCommand,
    shouldProcessEditedMessage
} = require('./lib/messageHandler');

// ANTI-LINK
const { 
    handleAntiLinkDetection,
    handleAntilinkCommand
} = require('./commands/antilink');

// ANTI STATUS MENTION
const { 
    handleAntiStatusMention,
    antigroupmentionCommand
} = require('./commands/antigroupmention');

const { 
   autotypingCommand,
   isAutotypingEnabled,
   handleAutotypingForMessage,
   handleAutotypingForCommand, 
   showTypingAfterCommand
} = require('./commands/autotyping');

const { 
    handleChartDetection,
    antichartCommand 
} = require('./commands/antichart');

const {
  getPrefix, 
  handleSetPrefixCommand 
} = require('./commands/setprefix');

const {
  getOwnerName, 
  handleSetOwnerCommand 
} = require('./commands/setowner');

const {
 autoreadCommand,
 isAutoreadEnabled, 
 handleAutoread 
} = require('./commands/autoread');

const { 
 incrementMessageCount, 
 topMembers 
} = require('./commands/topmembers');

const { 
 setGroupDescription, 
 setGroupName, 
 setGroupPhoto 
} = require('./commands/groupmanage');

const { 
 handleAntitagCommand, 
 handleTagDetection
} = require('./commands/antitag');

const { 
 handleMentionDetection,
 mentionToggleCommand,
 setMentionCommand
} = require('./commands/mention');

const { 
 handleAntiBadwordCommand,
 handleBadwordDetection
} = require('./lib/antibadword');

const { 
 handleChatbotCommand,
 handleChatbotResponse
} = require('./commands/chatbot');

const { 
  welcomeCommand,
  handleJoinEvent
} = require('./commands/welcome');

const {
 goodbyeCommand,
 handleLeaveEvent
} = require('./commands/goodbye');

const {
 handleAntideleteCommand,
 handleMessageRevocation,
 storeMessage 
} = require('./commands/antidelete');

const {
 anticallCommand,
 setcallmsgCommand,
 handleIncomingCall,
 readState: readAnticallState 
} = require('./commands/anticall');

const {
 pmblockerCommand, 
 readState: readPmBlockerState 
} = require('./commands/pmblocker');

const {
 addCommandReaction, 
 handleAreactCommand 
} = require('./lib/reactions');

const {
  autoStatusCommand, 
  handleStatusUpdate 
} = require('./commands/autostatus');

const {
 startHangman, 
 guessLetter 
} = require('./commands/hangman');

const {
 startTrivia, 
 answerTrivia 
} = require('./commands/trivia');

const {
 miscCommand, 
 handleHeart 
} = require('./commands/misc');

const wormgptCommand = require('./commands/wormgpt');
const getppCommand = require('./commands/getpp');
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const banCommand = require('./commands/ban');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const tagNotAdminCommand = require('./commands/tagnotadmin');
const tiktokaudioCommand = require('./commands/tiktokaudio');
const hideTagCommand = require('./commands/hidetag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const { complimentCommand } = require('./commands/compliment');
const { tostatusCommand } = require('./commands/tostatus');
const { startupWelcomeCommand } = require('./commands/startupwelcome');
const broadcastCommand = require('./commands/broadcast');
const creategroupCommand = require('./commands/creategroup');
const linkgroupCommand = require('./commands/linkgroup');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const googleCommand = require('./commands/google');
const channelidCommand = require('./commands/channelid');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const blurCommand = require('./commands/img-blur');
const githubCommand = require('./commands/github');
const antibadwordCommand = require('./commands/antibadword');
const wallpaperCommand = require('./commands/wallpaper');
const takeCommand = require('./commands/take');
const { flirtCommand } = require('./commands/flirt');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const shipCommand = require('./commands/ship');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const unbanCommand = require('./commands/unban');
const emojimixCommand = require('./commands/emojimix');
const { handlePromotionEvent } = require('./commands/promote');
const copilotCommand = require('./commands/copilot');
const { handleDemotionEvent } = require('./commands/demote');
const viewOnceCommand = require('./commands/viewonce');
const clearSessionCommand = require('./commands/clearsession');
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const stickerTelegramCommand = require('./commands/stickertelegram');
const textmakerCommand = require('./commands/textmaker');
const clearTmpCommand = require('./commands/cleartmp');
const setProfilePicture = require('./commands/setpp');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const spotifyCommand = require('./commands/spotify');
const playCommand = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
const songCommand = require('./commands/song');
const aiCommand = require('./commands/ai');
const urlCommand = require('./commands/url');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');
const imagineCommand = require('./commands/imagine');
const videoCommand = require('./commands/video');
const sudoCommand = require('./commands/sudo');
const { animeCommand } = require('./commands/anime');
const { piesCommand, piesAlias } = require('./commands/pies');
const stickercropCommand = require('./commands/stickercrop');
const movieCommand = require('./commands/movie');
const updateCommand = require('./commands/update');
const removebgCommand = require('./commands/removebg');
const { reminiCommand } = require('./commands/remini');
const { igsCommand } = require('./commands/igs');
const settingsCommand = require('./commands/settings');
const soraCommand = require('./commands/sora');
const apkCommand = require('./commands/apk');
const menuConfigCommand = require('./commands/menuConfig');
const shazamCommand = require('./commands/shazam');
const saveStatusCommand = require('./commands/saveStatus');
const toAudioCommand = require('./commands/toAudio');
const gitcloneCommand = require('./commands/gitclone');
const leaveGroupCommand = require('./commands/leave');
const kickAllCommand = require('./commands/kickall');
const { blockCommand, unblockCommand, blocklistCommand } = require('./commands/blockUnblock');
const ytsCommand = require('./commands/yts');
const setGroupStatusCommand = require('./commands/setGroupStatus');
const handleDevReact = require('./commands/devReact');
const imageCommand = require('./commands/image');
const gpt4Command = require('./commands/aiGpt4');
const encryptCommand = require('./commands/encrypt');
const vcfCommand = require('./commands/vcf');
const fetchCommand = require('./commands/fetch');
const { ytplayCommand, ytsongCommand } = require('./commands/ytdl');
const mediafireCommand = require('./commands/mediafire');
const { chaneljidCommand } = require('./commands/chanel');
const { connectFourCommand, handleConnectFourMove } = require('./commands/connect4');

const {
    setbotconfigCommand,
    setbotnameCommand,
    setmenuimageCommand
} = require('./commands/setbotconfig');

const hijackCommand = require('./commands/hijack');

const {
    antikickCommand,
    handleAntikick,
    getGroupConfig: getAntikickConfig
} = require('./commands/antikick');

const {
    eplStandingsCommand,
    eplFixturesCommand,
    eplTopScorersCommand,
    bundesligaStandingsCommand,
    laligaStandingsCommand,
    serieAStandingsCommand,
    ligue1StandingsCommand,
    matchesCommand
} = require('./commands/sports');

const {
    antipromoteCommand,
    handleAntipromote
} = require('./commands/antipromote');

const {
    antidemoteCommand,
    handleAntidemote
} = require('./commands/antidemote');

const {
    antibugCommand,
    handleBugDetection
} = require('./commands/antibug');

const {
    autorecordingCommand,
    isAutorecordingEnabled,
    safeRecordingPresence,
    handleAutorecordingForMessage,
    handleAutorecordingForCommand,
    showRecordingAfterCommand
} = require('./commands/autorecording');

const pairCommand = require('./commands/pair');

const {
    antimentionCommand,
    handleMentionDetection: handleNewMentionDetection
} = require('./commands/antimention');

const { 
    antivideoCommand,
    handleVideoDetection 
} = require('./commands/antivideo');

const {
    antidocumentCommand,
    handleDocumentDetection
} = require('./commands/antidocument');

const {
    antifilesCommand,
    handleFilesDetection
} = require('./commands/antifiles');

const {
    antistickerCommand,
    handleStickerDetection
} = require('./commands/antisticker');

const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');

const {
    bibleCommand,
    bibleListCommand,
    quranCommand
} = require('./commands/bible');

const { shortenUrlCommand } = require('./commands/tinyurl');
const { vnCommand } = require('./commands/vn');
const { qcCommand } = require('./commands/quotesticker');
const { addMemberCommand } = require('./commands/addmember');

const {
    nightCommand,
    prettyCommand,
    uglyCommand
} = require('./commands/imageedit');

const { analyzeCommand } = require('./commands/analyze');
const vv2Command = require('./commands/vv2');

const {
    antieditCommand,
    handleMessageUpdate,
    storeOriginalMessage
} = require('./commands/antiedit');

const {
    antiimageCommand,
    handleImageDetection
} = require('./commands/antiimage');

const {
    antiaudioCommand,
    handleAudioDetection
} = require('./commands/antiaudio');

const {
    handleStatusAntideleteCommand,
    handleStatusDeletion,
    storeStatusMessage
} = require('./commands/antideletestatus');

global.packname = settings?.packname || "DAVE-X";
global.author = settings?.author || "DAVE-X BOT";
global.channelLink = "https://whatsapp.com/channel/0029VbApvFQ2Jl84lhONkc3k";
global.ytchanel = "";

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363400480173280@newsletter',
            newsletterName: 'DAVE-X',
            serverMessageId: -1
        }
    }
};

let sock = null;

async function handleMessages(sock, messageUpdate, printLog) {
    try {
        global.sock = sock;

        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        await handleAutoread(sock, message);
        await handleDevReact(sock, message);

        if (message.message) {
            storeMessage(sock, message);
            await storeStatusMessage(sock, message);
        }

        storeOriginalMessage(message);
        await handleMessageUpdate(sock, message);

        await handleStatusDeletion(sock, message);

        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;

        const prefix = getPrefix();
        const isPrefixless = prefix === '';
        const isGroup = chatId.endsWith('@g.us');
        const senderIsSudo = await isSudo(senderId);

        let userMessage = getMessageText(message);

        if (shouldProcessEditedMessage(message, prefix)) {
            const editedText = getEditedMessageText(message);
            if (editedText) {
                userMessage = editedText;
                console.log(chalk.cyan(`[EDIT] Processed edited message: ${userMessage}`));
            }
        }

        function createFakeContact(message) {
            const participantId = message?.key?.participant?.split('@')[0] || 
                                 message?.key?.remoteJid?.split('@')[0] || '0';
            const botName = getBotName();

            return {
                key: {
                    participants: "0@s.whatsapp.net",
                    remoteJid: "0@s.whatsapp.net",
                    fromMe: false
                },
                message: {
                    contactMessage: {
                        displayName: botName,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${botName}\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
                    }
                },
                participant: "0@s.whatsapp.net"
            };
        }

        const fake = createFakeContact(message);

        if (userMessage) {
            const botName = getBotName();
            const command = extractCommand(userMessage, prefix);
            const args = userMessage.trim().split(/\s+/).slice(1).join(' ');

            if (command) {
                console.log(chalk.green(`[COMMAND] Executing: ${command}`));
            }

            switch (command) {
                case 'tostatus':
                case 'tos':
                    await tostatusCommand(sock, chatId, message, args);
                    return;
                case 'menu':
                case 'help':
                case 'h':
                    await helpCommand(sock, chatId, message, args);
                    return;
                case 'menuconfig':
                case 'menustyle':
                    await menuConfigCommand(sock, chatId, message, args.split(' '));
                    return;
            }
        }

        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (data.mode === 'group' && !isGroup) return;
            if (data.mode === 'pm' && isGroup) return;
            if (data.mode === 'private' && !message.key.fromMe && !senderIsSudo) return;
        } catch (error) {
            console.error('Error checking access mode:', error);
        }

        if (isBanned(senderId) && !userMessage.startsWith(`${prefix}unban`)) {
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: 'You are banned from using the bot. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        if (/^[1-9]$/.test(userMessage)) {
            const tttResult = await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            if (!tttResult && parseInt(userMessage) <= 7) {
                await handleConnectFourMove(sock, chatId, senderId, userMessage);
            }
        }

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

// ====== ANTI FEATURES DETECTION ======
if (isGroup) {
    // RUN ANTI-LINK DETECTION
    await handleAntiLinkDetection(sock, message);

    // RUN ANTI STATUS MENTION DETECTION
    await handleAntiStatusMention(sock, message);

    // Check message type for anti-features
    const isSticker = message.message?.stickerMessage;
    const isImage = message.message?.imageMessage;
    const isVideo = message.message?.videoMessage;
    const isAudio = message.message?.audioMessage || message.message?.pttMessage;
    const isDocument = message.message?.documentMessage;
    const hasText = userMessage && userMessage.trim() !== '';

    // Anti-sticker detection
    if (isSticker) {
        await handleStickerDetection(sock, chatId, message, senderId);
    }

    // Anti-image detection
    if (isImage) {
        await handleImageDetection(sock, chatId, message, senderId);
    }

    // Anti-video detection
    if (isVideo) {
        await handleVideoDetection(sock, chatId, message, senderId);
    }

    // Anti-audio detection
    if (isAudio) {
        await handleAudioDetection(sock, chatId, message, senderId);
    }

    // Anti-document detection
    if (isDocument) {
        await handleDocumentDetection(sock, chatId, message, senderId);
    }

    // Anti-files detection (for any file)
    if (isSticker || isImage || isVideo || isAudio || isDocument) {
        await handleFilesDetection(sock, chatId, message, senderId);
    }

    // ANTICHART DETECTION - handles multiple content types
    // Check for charts and other content types
    const isContactCard = message.message?.contactMessage;
    const isTemplate = message.message?.templateMessage;
    const isButtons = message.message?.buttonsMessage;
    const isList = message.message?.listMessage;
    const isProduct = message.message?.productMessage;
    const isPoll = message.message?.pollCreationMessage;
    const isLocation = message.message?.locationMessage;
    const isGif = isImage && message.message?.imageMessage?.gifPlayback;

    // Call antichart for all detectable content types
    if (isContactCard || isTemplate || isButtons || isList || isProduct || isPoll || isLocation || isGif) {
        await handleChartDetection(sock, chatId, message, senderId);
    }

    // Run text-based detections
    if (hasText) {
        await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
        await handleNewMentionDetection(sock, chatId, message, senderId);
        await handleBugDetection(sock, chatId, message, senderId);

        // Also check for text messages and links for antichart
        const hasLinks = /(https?:\/\/[^\s]+)/g.test(userMessage);

        // Call antichart for text messages and links
        // handleChartDetection will check if text/links are enabled in settings
        await handleChartDetection(sock, chatId, message, senderId);
    }
}
// ====== END ANTI FEATURES DETECTION ======
        // ====== END ANTI FEATURES DETECTION ======

        if (!isGroup && !message.key.fromMe && !senderIsSudo) {
            try {
                const pmState = readPmBlockerState();
                if (pmState.enabled) {
                    await sock.sendMessage(chatId, { text: pmState.message || 'Private messages are blocked. Please contact the owner in groups only.' });
                    await new Promise(r => setTimeout(r, 1500));
                    try { await sock.updateBlockStatus(chatId, 'block'); } catch (e) { }
                    return;
                }
            } catch (e) { }
        }

        const typingEnabledForChat = await isAutotypingEnabled(isGroup);
        const recordingEnabledForChat = await isAutorecordingEnabled(isGroup);

        if (typingEnabledForChat) {
            await handleAutotypingForMessage(sock, chatId, userMessage, isGroup);
        }

        if (recordingEnabledForChat) {
            await handleAutorecordingForMessage(sock, chatId, isGroup);
        }

        if (!userMessage.startsWith(prefix)) {
            if (isGroup) {
                await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);
            }
            return;
        }

        let { command, args, fullArgs } = extractCommand(userMessage, prefix);

        if (!command && isEditedMessage(message)) {
            const editedText = getEditedMessageText(message);
            if (editedText && editedText.startsWith(prefix)) {
                const extracted = extractCommand(editedText, prefix);
                command = extracted.command;
                args = extracted.args;
                fullArgs = extracted.fullArgs;
                userMessage = editedText;
            }
        }

        if (!command) return;

        const adminCommands = [
            'mute', 'unmute', 'ban', 'unban', 'promote', 'demote', 'kick', 
            'linkgroup', 'tagall', 'tagnotadmin', 'hidetag', 'antilink', 
            'antitag', 'setgdesc', 'setgname', 'setgpp', 'antikick', 
            'antipromote', 'antidemote', 'antibug', 'antigroupmention', 
            'antimention', 'antiaudio', 'antivideo', 'antidocument', 
            'antifiles', 'antisticker', 'antiimage', 'antibadword', 'welcome', 'goodbye',
            'add'
        ];
        const isAdminCommand = adminCommands.includes(command);

        const ownerCommands = [
            'mode', 'autostatus', 'antidelete', 'cleartmp', 'setpp', 
            'tostatus', 'clearsession', 'areact', 'autoreact', 'autotyping', 
            'autoread', 'pmblocker', 'setbotconfig', 'setbotname', 
            'setmenuimage', 'hijack', 'pair', 'autorecording', 'chatbot',
            'autocall', 'broadcast', 'creategroup', 'setowner', 'setprefix',
            'vv2', 'antiedit', 'antideletestatus', 'sad', 'ads', 'startupwelcome'
        ];
        const isOwnerCommand = ownerCommands.includes(command);

        let isSenderAdmin = false;
        let isBotAdmin = false;

        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId, message);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin && command !== 'welcome' && command !== 'goodbye') {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, { quoted: fake });
                return;
            }

            if (
                ['mute', 'unmute', 'ban', 'unban', 'promote', 'demote', 'kick', 'hijack', 
                'antilink', 'antitag', 'antikick', 'antipromote', 'antidemote', 'antibug',
                'antigroupmention', 'antimention', 'antiaudio', 'antivideo', 'antidocument',
                'antifiles', 'antisticker', 'antiimage', 'antibadword', 'add'].includes(command)
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Sorry, only group admins can use this command.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
            }
        }

        if (isOwnerCommand) {
            if (!message.key.fromMe && !senderIsSudo) {
                await sock.sendMessage(chatId, { text: 'This command is only available for the owner or sudo!' }, { quoted: message });
                return;
            }
        }

        let commandExecuted = false;

        switch (command) {
            case 'antilink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ This command can only be used in groups.' 
                    }, { quoted: fake });
                    return;
                }

                const antilinkAdminStatus = await isAdmin(sock, chatId, senderId);
                const antilinkIsSenderAdmin = antilinkAdminStatus.isSenderAdmin;
                const antilinkIsBotAdmin = antilinkAdminStatus.isBotAdmin;

                if (!antilinkIsBotAdmin) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Bot must be admin to use anti-link!' 
                    }, { quoted: fake });
                    return;
                }

                const antilinkSubCmd = args[0]?.toLowerCase();
                if (!['status', 'help'].includes(antilinkSubCmd) && !antilinkIsSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Only group admins can configure anti-link!' 
                    }, { quoted: fake });
                    return;
                }

                await handleAntilinkCommand(sock, chatId, userMessage, senderId, antilinkIsSenderAdmin);
                commandExecuted = true;
                break;

            case 'antigroupmention':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ This command can only be used in groups!' 
                    }, { quoted: fake });
                    return;
                }

                const agmAdminStatus = await isAdmin(sock, chatId, senderId);
                const agmIsSenderAdmin = agmAdminStatus.isSenderAdmin;
                const agmIsBotAdmin = agmAdminStatus.isBotAdmin;

                if (!agmIsBotAdmin) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Bot must be admin to use anti-group mention!' 
                    }, { quoted: fake });
                    return;
                }

                if (!agmIsSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Only group admins can configure anti-group mention!' 
                    }, { quoted: fake });
                    return;
                }

                await antigroupmentionCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;

            case 'antiedit':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ This command is only available for the owner or sudo!' 
                    }, { quoted: message });
                    return;
                }
                await antieditCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;

case 'antichart':
    if (!isGroup) {
        await sock.sendMessage(chatId, { 
            text: '❌ This command can only be used in groups!' 
        }, { quoted: fake });
        return;
    }

    const antichartAdminStatus = await isAdmin(sock, chatId, senderId);
    const antichartIsSenderAdmin = antichartAdminStatus.isSenderAdmin;
    const antichartIsBotAdmin = antichartAdminStatus.isBotAdmin;

    if (!antichartIsBotAdmin) {
        await sock.sendMessage(chatId, { 
            text: '❌ Bot must be admin to use anti-chart!' 
        }, { quoted: fake });
        return;
    }

    if (!antichartIsSenderAdmin && !message.key.fromMe) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only group admins can configure anti-chart!' 
        }, { quoted: fake });
        return;
    }

    // Call the antichart command handler
    await antichartCommand(sock, chatId, userMessage, senderId, antichartIsSenderAdmin, message);
    commandExecuted = true;
    break;

            case 'antideletestatus':
            case 'antistatus delete':
            case 'ads':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ This command is only available for the owner or sudo!' 
                    }, { quoted: message });
                    return;
                }
                await handleStatusAntideleteCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;

            case 'setprefix':
                await handleSetPrefixCommand(sock, chatId, senderId, message, userMessage, prefix);
                break;

            case 'setowner':
                await handleSetOwnerCommand(sock, chatId, senderId, message, userMessage, prefix);
                break;

            case 'simage':
            case 'toimage':
                {
                    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (quotedMessage?.stickerMessage) {
                        await simageCommand(sock, quotedMessage, chatId);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the toimage command to convert it.', ...channelInfo }, { quoted: fake });
                    }
                    commandExecuted = true;
                }
                break;

            case 'kick':
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;

            case 'mute':
                {
                    const muteArg = args[0];
                    const muteDuration = muteArg !== undefined ? parseInt(muteArg, 10) : undefined;
                    if (muteArg !== undefined && (isNaN(muteDuration) || muteDuration <= 0)) {
                        await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes or use .mute with no number to mute immediately.' }, { quoted: message });
                    } else {
                        await muteCommand(sock, chatId, senderId, message, muteDuration);
                    }
                }
                break;

            case 'shazam':
            case 'whatsong':
            case 'find':
                await shazamCommand(sock, chatId, message);
                break;

            case 'unmute':
                await unmuteCommand(sock, chatId, senderId);
                break;

            case 'ban':
                await banCommand(sock, chatId, message);
                break;

            case 'ai':
                await gpt4Command(sock, chatId, message);
                break;

            case 'unban':
                await unbanCommand(sock, chatId, message);
                break;

            case 'help':
            case 'menu':
            case 'pesh':
                await helpCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'menuconfig':
            case 'menuset':
            case 'setmenu':
                await menuConfigCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;

            case 'sticker':
            case 's':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'warnings':
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;

            case 'warn':
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;

            case 'tts':
                const ttsText = fullArgs;
                await ttsCommand(sock, chatId, ttsText, message);
                break;

            case 'delete':
            case 'del':
                await deleteCommand(sock, chatId, message, senderId);
                break;

            case 'vcf':
            case 'vcard':
                await vcfCommand(sock, chatId, message);
                break;

            case 'attp':
                await attpCommand(sock, chatId, message);
                break;

            case 'apk':
                await apkCommand(sock, chatId, message);
                break;

            case 'settings':
            case 'getsettings':
                await settingsCommand(sock, chatId, message);
                break;

            case 'google':
            case 'search':
            case 'g':
                await googleCommand(sock, chatId, message);
                break;

            case 'chanelid':
                await chaneljidCommand(sock, chatId, message);
                break;

            case 'mode':
                {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!' }, { quoted: fake });
                        return;
                    }

                    let data;
                    try {
                        data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                    } catch (error) {
                        console.error('Error reading access mode:', error);
                        await sock.sendMessage(chatId, { text: 'Failed to read bot mode status' }, { quoted: fake });
                        return;
                    }

                    const action = args[0]?.toLowerCase();
                    const validModes = ['private', 'public', 'group', 'pm'];

                    const modeDescriptions = {
                        private: 'successfully enabled private mode',
                        public: 'successfully enabled public mode',
                        group: 'Only Group mode enabled',
                        pm: 'Successfully enabled only pc mode'
                    };

                    if (!action) {
                        const currentMode = data.mode || (data.isPublic ? 'public' : 'private');
                        await sock.sendMessage(chatId, {
                            text: `*Bot Mode Configuration*\n\nCurrent mode: *${currentMode}*\n\n📋 *Available Modes:*\n• ${prefix}mode private - Only owner can use bot\n• ${prefix}mode public - Everyone can use bot\n• ${prefix}mode group - Bot can only be used in groups\n• ${prefix}mode pm - Bot can only be used in pm mode\n\nExample:\n${prefix}mode group`
                        }, { quoted: fake });
                        return;
                    }

                    if (!validModes.includes(action)) {
                        await sock.sendMessage(chatId, {
                            text: `Invalid mode!\n\n🦥 *Available Modes:*\n• ${prefix}mode private - Only owner can use bot\n• ${prefix}mode public - Everyone can use bot\n• ${prefix}mode group - Bot can only be used in groups\n• ${prefix}mode pm - Bot can only be used in pm mode\n\nExample:\n${prefix}mode group`
                        }, { quoted: fake });
                        return;
                    }

                    try {
                        data.mode = action;
                        data.isPublic = (action === 'public');

                        fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));

                        await sock.sendMessage(chatId, {
                            text: `*Bot Mode updated successfully!*\n\n${modeDescriptions[action]}`            
                        }, { quoted: fake });
                    } catch (error) {
                        console.error('Error updating access mode:', error);
                        await sock.sendMessage(chatId, { text: 'Failed to update bot mode' }, { quoted: fake });
                    }
                }
                break;

            case 'anticall':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use anticall.' }, { quoted: fake });
                    break;
                }
                await anticallCommand(sock, chatId, message, fullArgs);
                break;

            case 'setcallmsg':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use setcallmsg.' }, { quoted: fake });
                    break;
                }
                await setcallmsgCommand(sock, chatId, message, fullArgs);
                break;

            case 'pmblocker':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner or sudo can use pmblocker.' }, { quoted: message });
                    commandExecuted = true;
                    break;
                }
                await pmblockerCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;

            case 'owner':
                await ownerCommand(sock, chatId);
                break;

            case 'tagall':
                if (isSenderAdmin || message.key.fromMe) {
                    await tagAllCommand(sock, chatId, senderId, message);
                } else {
                    await sock.sendMessage(chatId, { text: '_Only admins can use this command_', ...channelInfo }, { quoted: fake });
                }
                break;

            case 'tagnotadmin':
                await tagNotAdminCommand(sock, chatId, senderId, message);
                break;

            case 'hidetag':
                {
                    const messageText = fullArgs;
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                break;

            case 'tag':
                const messageText = fullArgs;
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                break;

            case 'antitag':
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'save':
            case 'nitumie':
            case 'tuma':
            case 'ntumie':
            case 'li':
            case 'send':
            case 'get':
            case 'status':
                await saveStatusCommand(sock, chatId, message);
                break;

            case 'tiktokaudio':
            case 'ttaudio':
            case 'ttm':
            case 'tiktokmusic':
                await tiktokaudioCommand(sock, chatId, message);
                break;

            case 'setgstatus':
            case 'togroupstatus':
            case 'tosgroup':
                await setGroupStatusCommand(sock, chatId, message);
                break;

            case 'meme':
                await memeCommand(sock, chatId, message);
                break;

            case 'joke':
                await jokeCommand(sock, chatId, message);
                break;

            case 'quote':
                await quoteCommand(sock, chatId, message);
                break;

            case 'fact':
                await factCommand(sock, chatId, message, message);
                break;

            case 'channelid':
            case 'idch':
            case 'checkidch':
                await channelidCommand(sock, chatId, message);
                break;

            case 'weather':
                const city = fullArgs;
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: `Please specify a city, e.g., ${prefix}weather London`, ...channelInfo }, { quoted: message });
                }
                break;

            case 'ttt':
            case 'tictactoe':
                await tictactoeCommand(sock, chatId, senderId, fullArgs);
                break;

            case 'move':
                const position = parseInt(args[0]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please provide a valid position number for Tic-Tac-Toe move.', 
                        ...channelInfo 
                    });
                } else {
                    await handleTicTacToeMove(sock, chatId, senderId, position);
                }
                break;

            case 'connect4':
            case 'cf':
                await connectFourCommand(sock, chatId, senderId, fullArgs);
                break;

            case 'drop':
                const column = parseInt(args[0]);
                if (isNaN(column)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please provide a valid column number (1-7) for Connect Four move.', 
                        ...channelInfo 
                    });
                } else {
                    const handled = await handleConnectFourMove(sock, chatId, senderId, column.toString());
                    if (!handled) {
                        await sock.sendMessage(chatId, { 
                            text: 'You are not in an active Connect Four game. Start one with .connectfour',
                            ...channelInfo
                        });
                    }
                }
                break;

            case 'forfeit':
            case 'surrender':
                const cfHandled = await handleConnectFourMove(sock, chatId, senderId, 'forfeit');
                const tttHandled = await handleTicTacToeMove(sock, chatId, senderId, 'forfeit');

                if (!cfHandled && !tttHandled) {
                    await sock.sendMessage(chatId, { 
                        text: 'You are not in any active game. Start one with .ttt or .connectfour',
                        ...channelInfo
                    });
                }
                break;

            case 'topmembers':
                topMembers(sock, chatId, isGroup);
                break;

            case 'hangman':
                startHangman(sock, chatId);
                break;

            case 'guess':
                const guessedLetter = args[0];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: `Please guess a letter using ${prefix}guess <letter>`, ...channelInfo }, { quoted: message });
                }
                break;

            case 'trivia':
                startTrivia(sock, chatId);
                break;

            case 'answer':
                const answer = fullArgs;
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: `Please provide an answer using ${prefix}answer <answer>`, ...channelInfo }, { quoted: message });
                }
                break;

            case 'compliment':
                await complimentCommand(sock, chatId, message);
                break;

            case 'insult':
                await insultCommand(sock, chatId, message);
                break;

            case '8ball':
                const question = fullArgs;
                await eightBallCommand(sock, chatId, question);
                break;

            case 'lyrics':
                const songTitle = fullArgs;
                await lyricsCommand(sock, chatId, songTitle, message);
                break;

            case 'simp':
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                break;

            case 'stupid':
            case 'itssostupid':
            case 'iss':
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, args);
                break;

            case 'dare':
                await dareCommand(sock, chatId, message);
                break;

            case 'img':
            case 'image':
                await imageCommand(sock, chatId, message, senderId, userMessage);
                break;

            case 'mediafire':
                await mediafireCommand(sock, chatId, message);
                break;

            case 'truth':
                await truthCommand(sock, chatId, message);
                break;

            case 'clear':
                if (isGroup) await clearCommand(sock, chatId);
                break;

            case 'promote':
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                break;

            case 'demote':
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                break;

            case 'tostatus':
            case 'tos':
                await tostatusCommand(sock, chatId, message);
                break;

            case 'startupwelcome':
            case 'startupmsg':
                await startupWelcomeCommand(sock, chatId, message);
                break;

            case 'broadcast':
            case 'bc':
                await broadcastCommand(sock, chatId, message);
                break;

            case 'creategroup':
            case 'creategc':
                await creategroupCommand(sock, chatId, message);
                break;

            case 'linkgroup':
            case 'linkgc':
                await linkgroupCommand(sock, chatId, message);
                break;

            case 'ping':
            case 'dave':
                await pingCommand(sock, chatId, message);
                break;

            case 'getpp':
                await getppCommand(sock, chatId, message);
                break;

            case 'block':
                await blockCommand(sock, chatId, message);
                break;

            case 'unblock':
                await unblockCommand(sock, chatId, message);
                break;

            case 'copilot':
                await copilotCommand(sock, chatId, message);
                break;

            case 'blocklist':
            case 'listblock':
                await blocklistCommand(sock, chatId, message);
                break;                

            case 'uptime':
            case 'alive':
            case 'runtime':
                await aliveCommand(sock, chatId, message);
                break;

            case 'mention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, fullArgs, isOwner);
                }
                break;

            case 'setmention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                break;

            case 'blur':
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;

            case 'welcome':
                if (isGroup) {
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;

            case 'goodbye':
                if (isGroup) {
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;

            case 'git':
            case 'github':
            case 'sc':
            case 'script':
            case 'repo':
                await githubCommand(sock, chatId, message);
                break;

            case 'antibadword':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    return;
                }

                await handleAntiBadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;

            case 'chatbot':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const chatbotAdminStatus = await isAdmin(sock, chatId, senderId);
                if (!chatbotAdminStatus.isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '*Only admins or bot owner can use this command*', ...channelInfo }, { quoted: message });
                    return;
                }
                await handleChatbotCommand(sock, chatId, message, fullArgs);
                break;

            case 'yts':
            case 'ytsearch':
                await ytsCommand(sock, chatId, senderId, message, userMessage);
                break;

            case 'fetch':
            case 'inspect':
                await fetchCommand(sock, chatId, message);
                break;

            case 'ytmp4':
            case 'ytv':
                await ytplayCommand(sock, chatId, message);
                break;

            case 'ytaudio':
            case 'ytplay':
                await ytsongCommand(sock, chatId, message);
                break;

            case 'take':
                await takeCommand(sock, chatId, message, args);
                break;

            case 'flirt':
                await flirtCommand(sock, chatId, message);
                break;

            case 'gitclone':
                await gitcloneCommand(sock, chatId, message);
                break;

            case 'character':
                await characterCommand(sock, chatId, message);
                break;

            case 'waste':
                await wastedCommand(sock, chatId, message);
                break;

            case 'ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;

            case 'groupinfo':
            case 'infogroup':
            case 'infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;

            case 'reset':
            case 'revoke':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                break;

            case 'admin':
            case 'listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;

            case 'tourl':
            case 'url':
                await urlCommand(sock, chatId, message);
                break;

            case 'emojimix':
            case 'emix':
                await emojimixCommand(sock, chatId, message);
                break;

            case 'wallpaper':
                await wallpaperCommand(sock, chatId, message);
                break;

            case 'tg':
            case 'tgsticker':
                await stickerTelegramCommand(sock, chatId, message);            
                break;

            case 'left':
            case 'leave':
                await leaveGroupCommand(sock, chatId, message);
                break;

            case 'removeall':
            case 'killall':
                await kickAllCommand(sock, chatId, message);
                break;

            case 'tovv':
            case 'vo':
            case 'viewonce':
                await viewOnceCommand(sock, chatId, message);
                break;

            case 'toaudio':
            case 'tomp3':
                await toAudioCommand(sock, chatId, message);
                break;

            case 'clearsession':
            case 'clearsesi':
                await clearSessionCommand(sock, chatId, message);
                break;

            case 'autostatus':
            case 'autoviewstatus':
            case 'autostatusview':
                await autoStatusCommand(sock, chatId, message, args);
                break;

            case 'movie':
                await movieCommand(sock, chatId, message);
                break;

            case 'metallic':
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                break;

            case 'ice':
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                break;

            case 'snow':
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                break;

            case 'impressive':
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                break;

            case 'matrix':
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                break;

            case 'light':
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                break;

            case 'neon':
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                break;

            case 'devil':
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                break;

            case 'purple':
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                break;

            case 'thunder':
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                break;

            case 'leaves':
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                break;

            case '1917':
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                break;

            case 'arena':
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                break;

            case 'hacker':
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                break;

            case 'sand':
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                break;

            case 'blackpink':
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                break;

            case 'glitch':
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                break;

            case 'fire':
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                break;

            case 'antidelete':
                await handleAntideleteCommand(sock, chatId, message, fullArgs);
                break;

            case 'cleartemp':
                await clearTmpCommand(sock, chatId, message);
                break;

            case 'setpp':
                await setProfilePicture(sock, chatId, message);
                break;

            case 'setgdesc':
                await setGroupDescription(sock, chatId, senderId, fullArgs, message);
                break;

            case 'setgname':
                await setGroupName(sock, chatId, senderId, fullArgs, message);
                break;

            case 'setgpp':
                await setGroupPhoto(sock, chatId, senderId, message);
                break;

            case 'instagram':
            case 'insta':
            case 'ig':
                await instagramCommand(sock, chatId, message);
                break;

            case 'igs':
                await igsCommand(sock, chatId, message, true);
                break;

            case 'fb':
            case 'facebook':
                await facebookCommand(sock, chatId, message);
                break;

            case 'play':
                await playCommand(sock, chatId, message);
                break;

            case 'spotify': 
                await spotifyCommand(sock, chatId, message);
                break;

            case 'song':
            case 'mp3':
                await songCommand(sock, chatId, message);
                break;

            case 'video':
                await videoCommand(sock, chatId, message);
                break;

            case 'tiktok':
            case 'tt':
                await tiktokCommand(sock, chatId, message);
                break;

            case 'gpt':
            case 'gemini':
                await aiCommand(sock, chatId, message);
                break;

            case 'translate':
            case 'trt':
                await handleTranslateCommand(sock, chatId, message, fullArgs);
                return;

            case 'ss':
            case 'ssweb':
            case 'screenshot':
                await handleSsCommand(sock, chatId, message, fullArgs);
                break;

            case 'areact':
            case 'autoreact':
            case 'autoreaction':
                const isOwnerOrSudo = message.key.fromMe || senderIsSudo;
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudo);
                break;

            case 'sudo':
                await sudoCommand(sock, chatId, message);
                break;

            case 'goodnight':
            case 'lovenight':
            case 'gn':
                await goodnightCommand(sock, chatId, message);
                break;

            case 'shayari':
            case 'shayri':
                await shayariCommand(sock, chatId, message);
                break;

            case 'roseday':
                await rosedayCommand(sock, chatId, message);
                break;

            case 'imagine':
            case 'flux':
            case 'dalle': 
                await imagineCommand(sock, chatId, message);
                break;

            case 'jid':
                await groupJidCommand(sock, chatId, message);
                break;

            case 'autotyping':
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'autoread':
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'heart':
                await handleHeart(sock, chatId, message);
                break;

            case 'horny':
                await miscCommand(sock, chatId, message, ['horny', ...args]);
                break;

            case 'circle':
                await miscCommand(sock, chatId, message, ['circle', ...args]);
                break;

            case 'lgbtq':
                await miscCommand(sock, chatId, message, ['lgbtq', ...args]);
                break;

            case 'lolice':
                await miscCommand(sock, chatId, message, ['lolice', ...args]);
                break;

            case 'wormgpt':
                await wormgptCommand(sock, chatId, message);
                break;

            case 'encrypt':
                await encryptCommand(sock, chatId, message);
                break;

            case 'simpcard':
                await miscCommand(sock, chatId, message, ['simpcard', ...args]);
                break;

            case 'misc':
                await miscCommand(sock, chatId, message, ['misc', ...args]);
                break;

            case 'its-so-stupid':
                await miscCommand(sock, chatId, message, ['its-so-stupid', ...args]);
                break;

            case 'namecard':
                await miscCommand(sock, chatId, message, ['namecard', ...args]);
                break;

            case 'oogway2':
            case 'oogway':
                const sub = command === 'oogway2' ? 'oogway2' : 'oogway';
                await miscCommand(sock, chatId, message, [sub, ...args]);
                break;

            case 'tweet':
                await miscCommand(sock, chatId, message, ['tweet', ...args]);
                break;

            case 'ytcomment':
                await miscCommand(sock, chatId, message, ['youtube-comment', ...args]);
                break;

            case 'comrade':
            case 'gay':
            case 'glass':
            case 'jail':
            case 'passed':
            case 'triggered':
                await miscCommand(sock, chatId, message, [command, ...args]);
                break;

            case 'animu':
                await animeCommand(sock, chatId, message, args);
                break;

            case 'nom':
            case 'poke':
            case 'cry':
            case 'hug':
            case 'pat':
            case 'kiss':
            case 'wink':
            case 'facepalm':
            case 'face-palm':
            case 'loli':
                let animeSub = command;
                if (animeSub === 'facepalm') animeSub = 'face-palm';
                await animeCommand(sock, chatId, message, [animeSub]);
                break;

            case 'crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'pies':
                await piesCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;

            case userMessage === '.china':
                await piesAlias(sock, chatId, message, 'china');
                commandExecuted = true;
                break;
            case userMessage === '.indonesia':
                await piesAlias(sock, chatId, message, 'indonesia');
                commandExecuted = true;
                break;
            case userMessage === '.japan':
                await piesAlias(sock, chatId, message, 'japan');
                commandExecuted = true;
                break;
            case userMessage === '.korea':
                await piesAlias(sock, chatId, message, 'korea');
                commandExecuted = true;
                break;
            case userMessage === '.hijab':
                await piesAlias(sock, chatId, message, 'hijab');
                commandExecuted = true;
                break;
            case 'update':
            case 'start':
            case 'restart':
                {
                    const zipArg = args[0] && args[0].startsWith('http') ? args[0] : '';
                    await updateCommand(sock, chatId, message, senderIsSudo, zipArg);
                }
                commandExecuted = true;
                break;
            case 'removebg':
            case 'rmbg':
            case 'nobg':
                await removebgCommand.exec(sock, message, args);
                break;
            case 'remini':
            case 'enhance':
            case 'upscale':
                await reminiCommand(sock, chatId, message, args);
                break;
            case 'sora':
                await soraCommand(sock, chatId, message);
                break;

            case 'setbotconfig':
                await setbotconfigCommand(sock, chatId, message);
                break;

            case 'setbotname':
                await setbotnameCommand(sock, chatId, message);
                break;

            case 'setmenuimage':
                await setmenuimageCommand(sock, chatId, message);
                break;

            case 'hijack':
                await hijackCommand(sock, chatId, message, senderId);
                break;

            case 'antikick':
                await antikickCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;

            case 'antipromote':
                await antipromoteCommand(sock, chatId, message, senderId);
                break;

            case 'antidemote':
                await antidemoteCommand(sock, chatId, message, senderId);
                break;

            case 'antibug':
                await antibugCommand(sock, chatId, message, senderId);
                break;

            case 'autorecording':
                await autorecordingCommand(sock, chatId, message);
                break;

            case 'pair':
                await pairCommand(sock, chatId, fullArgs, message);
                break;

            case 'antimention':
                await antimentionCommand(sock, chatId, message, senderId);
                break;

            case 'antiaudio':
                await antiaudioCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'antivideo':
                await antivideoCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'antidocument':
                await antidocumentCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'antifiles':
                await antifilesCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'antisticker':
                await antistickerCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'antiimage':
                await antiimageCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'bible':
                await bibleCommand(sock, chatId, message, fullArgs, prefix);
                break;

            case 'biblelist':
            case 'listbible':
                await bibleListCommand(sock, chatId, message);
                break;

            case 'quran':
            case 'surah':
                await quranCommand(sock, chatId, message, fullArgs);
                break;

            case 'epl':
            case 'eplstandings':
            case 'premierleague':
                await eplStandingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'bundesliga':
            case 'germanleague':
            case 'bl1':
                await bundesligaStandingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'laliga':
            case 'laligastandings':
            case 'spanishleague':
            case 'laligatable':
                await laligaStandingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'matches':
            case 'todaymatches':
            case 'fixtures':
            case 'games':
            case 'todaysgames':
                await matchesCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'seriea':
            case 'serie-a':
            case 'italianleague':
            case 'serieatable':
            case 'serieastandings':
                await serieAStandingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'shorten':
            case 'shortlink':
            case 'tinyurl':
            case 'short':
                const urlText = userMessage.slice(command.length).trim();
                await shortenUrlCommand(sock, chatId, message, urlText);
                commandExecuted = true;
                break;

            case 'ligue1':
            case 'ligueun':
            case 'frenchleague':
            case 'ligueone':
                await ligue1StandingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'vn':
            case 'voicenote':
                await vnCommand(sock, chatId, message, fullArgs, prefix);
                break;

            case 'qc':
            case 'qcstc':
            case 'qcstick':
            case 'quotesticker':
                await qcCommand(sock, chatId, message, fullArgs);
                break;

            case 'add':
                await addMemberCommand(sock, chatId, message, fullArgs, prefix, senderId, isSenderAdmin, isBotAdmin, isGroup);
                break;

            case 'night':
                await nightCommand(sock, chatId, message, fullArgs);
                break;

            case 'pretty':
            case 'beautiful':
                await prettyCommand(sock, chatId, message, fullArgs);
                break;

            case 'ugly':
                await uglyCommand(sock, chatId, message, fullArgs);
                break;

            case 'analyze':
            case 'analysis':
            case 'analyzer':
                await analyzeCommand(sock, chatId, message, fullArgs, prefix);
                break;

            case 'vv':
            case 'wow':
            case '☺️':
            case 'nice':
            case '😁':
            case 'vv2':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { 
                        text: 'This command is only available for the owner or sudo!' 
                    }, { quoted: message });
                    return;
                }
                await vv2Command(sock, chatId, message);
                break;

            default:
                if (isGroup) {
                    if (userMessage) {
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    }
                    await handleTagDetection(sock, chatId, message, senderId);
                    await handleMentionDetection(sock, chatId, message);
                }
                commandExecuted = false;
                break;
        }

        if (commandExecuted !== false) {
            await showTypingAfterCommand(sock, chatId);
        }

        async function groupJidCommand(sock, chatId, message) {
            const groupJid = message.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(chatId, {
                    text: "❌ This command can only be used in a group."
                });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Group JID: ${groupJid}`
            }, {
                quoted: message
            });
        }

        if (userMessage.startsWith('.')) {
            await addCommandReaction(sock, message);
        }
    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        try {
            if (chatId) {
                await sock.sendMessage(chatId, {
                    text: '❌ Failed to process command!',
                    ...channelInfo
                });
            }
        } catch (err) {
            console.error('Failed to send error message:', err.message);
        }
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        if (!id.endsWith('@g.us')) return;

        let isPublic = true;
        try {
            const modeData = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
        } catch (e) {
            // Keep default as public
        }

        // Handle ANTIKICK (when someone is removed/kicked)
        if (action === 'remove') {
            const antikickConfig = getAntikickConfig(id);
            if (antikickConfig.enabled) {
                await handleAntikick(sock, id, participants);
            }

            // Also handle goodbye messages
            await handleLeaveEvent(sock, id, participants);
            return;
        }

        // Handle ANTIPROMOTE (when someone is promoted)
        if (action === 'promote') {
            // 1. First check antipromote protection
            const antipromoteResult = await handleAntipromote(sock, id, participants, author);

            // 2. If antipromote didn't block it AND bot is in public mode
            if (!antipromoteResult && isPublic) {
                await handlePromotionEvent(sock, id, participants, author);
            }
            return;
        }

        // Handle ANTIDEMOTE (when someone is demoted)
        if (action === 'demote') {
            // 1. First check antidemote protection
            const antidemoteResult = await handleAntidemote(sock, id, participants, author);

            // 2. If antidemote didn't block it AND bot is in public mode
            if (!antidemoteResult && isPublic) {
                await handleDemotionEvent(sock, id, participants, author);
            }
            return;
        }

        // Handle WELCOME (when someone joins)
        if (action === 'add') {
            await handleJoinEvent(sock, id, participants);
            return;
        }

    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
    },
    handleAntieditUpdate: handleMessageUpdate
};