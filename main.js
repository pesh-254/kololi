const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

// ========== TEMP FOLDER SETUP ==========
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

// Clean temp folder every 3 hours
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

// ========== CONSOLE FILTER SETUP ==========
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

// ========== MODULE IMPORTS ==========
const { getBotName, createFakeContact } = require('./lib/fakeContact');
const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { jidDecode } = require('@whiskeysockets/baileys');
const { isSudo } = require('./lib/index');
const isAdmin = require('./lib/isAdmin');

// Message Handler
const {
    getMessageText,
    isEditedMessage,
    getEditedMessageText,
    extractCommand,
    shouldProcessEditedMessage
} = require('./lib/messageHandler');

// ========== COMMAND IMPORTS ==========

// === CORE & BOT MANAGEMENT ===
const { getPrefix, handleSetPrefixCommand } = require('./commands/setprefix');
const { getOwnerName, handleSetOwnerCommand } = require('./commands/setowner');
const { 
    setbotconfigCommand,
    setbotnameCommand,
    setmenuimageCommand 
} = require('./commands/setbotconfig');
const ownerCommand = require('./commands/owner');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const updateCommand = require('./commands/update');
const settingsCommand = require('./commands/settings');
const sudoCommand = require('./commands/sudo');
const clearSessionCommand = require('./commands/clearsession');
const menuConfigCommand = require('./commands/menuConfig');
const helpCommand = require('./commands/help');

// === MODERATION COMMANDS ===
const banCommand = require('./commands/ban');
const unbanCommand = require('./commands/unban');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const kickCommand = require('./commands/kick');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const clearCommand = require('./commands/clear');
const kickAllCommand = require('./commands/kickall');
const { blockCommand, unblockCommand, blocklistCommand } = require('./commands/blockUnblock');

// === GROUP MANAGEMENT ===
const groupInfoCommand = require('./commands/groupinfo');
const staffCommand = require('./commands/staff');
const resetlinkCommand = require('./commands/resetlink');
const linkgroupCommand = require('./commands/linkgroup');
const creategroupCommand = require('./commands/creategroup');
const leaveGroupCommand = require('./commands/leave');
const { 
    setGroupDescription, 
    setGroupName, 
    setGroupPhoto 
} = require('./commands/groupmanage');
const tagAllCommand = require('./commands/tagall');
const tagCommand = require('./commands/tag');
const tagNotAdminCommand = require('./commands/tagnotadmin');
const hideTagCommand = require('./commands/hidetag');
const { addMemberCommand } = require('./commands/addmember');

// === ANTI-FEATURES ===
const { handleAntiLinkDetection, handleAntilinkCommand } = require('./commands/antilink');
const { handleAntiStatusMention, antigroupmentionCommand } = require('./commands/antigroupmention');
const { handleChartDetection, antichartCommand } = require('./commands/antichart');
const { handleAntitagCommand, handleTagDetection } = require('./commands/antitag');
const { handleAntiBadwordCommand, handleBadwordDetection } = require('./lib/antibadword');
const { handleMentionDetection, mentionToggleCommand, setMentionCommand } = require('./commands/mention');
const { antimentionCommand, handleMentionDetection: handleNewMentionDetection } = require('./commands/antimention');
const { antipromoteCommand, handleAntipromote } = require('./commands/antipromote');
const { antidemoteCommand, handleAntidemote } = require('./commands/antidemote');
const { antibugCommand, handleBugDetection } = require('./commands/antibug');
const { antivideoCommand, handleVideoDetection } = require('./commands/antivideo');
const { antidocumentCommand, handleDocumentDetection } = require('./commands/antidocument');
const { antifilesCommand, handleFilesDetection } = require('./commands/antifiles');
const { antistickerCommand, handleStickerDetection } = require('./commands/antisticker');
const { antiimageCommand, handleImageDetection } = require('./commands/antiimage');
const { antiaudioCommand, handleAudioDetection } = require('./commands/antiaudio');
const { antikickCommand, handleAntikick, getGroupConfig: getAntikickConfig } = require('./commands/antikick');
const { handleAntideleteCommand, handleMessageRevocation, storeMessage } = require('./commands/antidelete');
const { antieditCommand, handleMessageUpdate, storeOriginalMessage } = require('./commands/antiedit');
const { handleStatusAntideleteCommand, handleStatusDeletion, storeStatusMessage } = require('./commands/antideletestatus');

// === AUTOMATION FEATURES ===
const { autotypingCommand, isAutotypingEnabled, handleAutotypingForMessage, handleAutotypingForCommand, showTypingAfterCommand } = require('./commands/autotyping');
const { autoreadCommand, isAutoreadEnabled, handleAutoread } = require('./commands/autoread');
const { autorecordingCommand, isAutorecordingEnabled, handleAutorecordingForMessage, handleAutorecordingForCommand, showRecordingAfterCommand } = require('./commands/autorecording');
const { autoStatusCommand, handleStatusUpdate } = require('./commands/autostatus');
const { welcomeCommand, handleJoinEvent } = require('./commands/welcome');
const { goodbyeCommand, handleLeaveEvent } = require('./commands/goodbye');
const { handleChatbotCommand, handleChatbotResponse } = require('./commands/chatbot');
const { addCommandReaction, handleAreactCommand } = require('./lib/reactions');
const { incrementMessageCount, topMembers } = require('./commands/topmembers');
const pmblockerCommand = require('./commands/pmblocker');
const { anticallCommand, setcallmsgCommand, handleIncomingCall, readState: readAnticallState } = require('./commands/anticall');
const startupWelcomeCommand = require('./commands/startupwelcome');
const broadcastCommand = require('./commands/broadcast');

// === MEDIA & ENTERTAINMENT ===
const stickerCommand = require('./commands/sticker');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const emojimixCommand = require('./commands/emojimix');
const stickerTelegramCommand = require('./commands/stickertelegram');
const stickercropCommand = require('./commands/stickercrop');
const { qcCommand } = require('./commands/quotesticker');
const ttsCommand = require('./commands/tts');
const memeCommand = require('./commands/meme');
const songCommand = require('./commands/song');
const videoCommand = require('./commands/video');
const playCommand = require('./commands/play');
const { ytplayCommand, ytsongCommand } = require('./commands/ytdl');
const ytsCommand = require('./commands/yts');
const tiktokCommand = require('./commands/tiktok');
const tiktokaudioCommand = require('./commands/tiktokaudio');
const spotifyCommand = require('./commands/spotify');
const shazamCommand = require('./commands/shazam');
const instagramCommand = require('./commands/instagram');
const { igsCommand } = require('./commands/igs');
const facebookCommand = require('./commands/facebook');
const movieCommand = require('./commands/movie');
const { animeCommand } = require('./commands/anime');
const { piesCommand, piesAlias } = require('./commands/pies');
const imagineCommand = require('./commands/imagine');
const soraCommand = require('./commands/sora');
const mediafireCommand = require('./commands/mediafire');

// === AI & TOOLS ===
const aiCommand = require('./commands/ai');
const gpt4Command = require('./commands/aiGpt4');
const wormgptCommand = require('./commands/wormgpt');
const copilotCommand = require('./commands/copilot');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const googleCommand = require('./commands/google');
const githubCommand = require('./commands/github');
const gitcloneCommand = require('./commands/gitclone');
const apkCommand = require('./commands/apk');
const urlCommand = require('./commands/url');
const { shortenUrlCommand } = require('./commands/tinyurl');
const analyzeCommand = require('./commands/analyze');
const encryptCommand = require('./commands/encrypt');
const fetchCommand = require('./commands/fetch');
const removebgCommand = require('./commands/removebg');
const { reminiCommand } = require('./commands/remini');
const { nightCommand, prettyCommand, uglyCommand } = require('./commands/imageedit');
const blurCommand = require('./commands/img-blur');
const textmakerCommand = require('./commands/textmaker');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const setProfilePicture = require('./commands/setpp');
const getppCommand = require('./commands/getpp');
const viewOnceCommand = require('./commands/viewonce');
const toAudioCommand = require('./commands/toAudio');
const setGroupStatusCommand = require('./commands/setGroupStatus');
const imageCommand = require('./commands/image');
const hijackCommand = require('./commands/hijack');

// === GAMES & FUN ===
const { startHangman, guessLetter } = require('./commands/hangman');
const { startTrivia, answerTrivia } = require('./commands/trivia');
const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');
const { connectFourCommand, handleConnectFourMove } = require('./commands/connect4');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const { complimentCommand } = require('./commands/compliment');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { flirtCommand } = require('./commands/flirt');
const shipCommand = require('./commands/ship');
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const pairCommand = require('./commands/pair');

// === UTILITIES ===
const deleteCommand = require('./commands/delete');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const channelidCommand = require('./commands/channelid');
const { chaneljidCommand } = require('./commands/chanel');
const vcfCommand = require('./commands/vcf');
const wallpaperCommand = require('./commands/wallpaper');
const takeCommand = require('./commands/take');
const clearTmpCommand = require('./commands/cleartmp');
const { tostatusCommand } = require('./commands/tostatus');
const saveStatusCommand = require('./commands/saveStatus');
const vv2Command = require('./commands/vv2');
const { vnCommand } = require('./commands/vn');

// === MISC COMMANDS ===
const miscCommand = require('./commands/misc');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');

// === SPORTS ===
const {
    eplStandingsCommand,
    bundesligaStandingsCommand,
    laligaStandingsCommand,
    serieAStandingsCommand,
    ligue1StandingsCommand,
    matchesCommand
} = require('./commands/sports');

// === RELIGIOUS ===
const {
    bibleCommand,
    bibleListCommand,
    quranCommand
} = require('./commands/bible');

// === DEV REACT ===
const handleDevReact = require('./commands/devReact');

// ========== GLOBAL SETTINGS ==========
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

// ========== MESSAGE HANDLER ==========
async function handleMessages(sock, messageUpdate, printLog) {
    try {
        global.sock = sock;

        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        // Handle automation features
        await handleAutoread(sock, message);
        await handleDevReact(sock, message);
        
        // Store messages for anti-features
        if (message.message) {
            storeMessage(sock, message);
            await storeStatusMessage(sock, message);
        }
        
        storeOriginalMessage(message);
        await handleMessageUpdate(sock, message);
        await handleStatusDeletion(sock, message);

        // Handle message revocation (delete)
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

        // Check bot mode access
        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (data.mode === 'group' && !isGroup) return;
            if (data.mode === 'pm' && isGroup) return;
            if (data.mode === 'private' && !message.key.fromMe && !senderIsSudo) return;
        } catch (error) {
            console.error('Error checking access mode:', error);
        }

        // Check if user is banned
        if (isBanned(senderId) && !userMessage.startsWith(`${prefix}unban`)) {
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: 'You are banned from using the bot. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        // Handle game moves (Tic Tac Toe & Connect Four)
        if (/^[1-9]$/.test(userMessage)) {
            const tttResult = await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            if (!tttResult && parseInt(userMessage) <= 7) {
                await handleConnectFourMove(sock, chatId, senderId, userMessage);
            }
        }

        // Increment message count for top members
        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // ====== ANTI FEATURES DETECTION ======
        if (isGroup) {
            // Run anti-link detection
            await handleAntiLinkDetection(sock, message);

            // Run anti status mention detection
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
                await handleChartDetection(sock, chatId, message, senderId);
            }
        }
        // ====== END ANTI FEATURES DETECTION ======

        // PM Blocker check
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

        // Auto typing and recording features
        const typingEnabledForChat = await isAutotypingEnabled(isGroup);
        const recordingEnabledForChat = await isAutorecordingEnabled(isGroup);

        if (typingEnabledForChat) {
            await handleAutotypingForMessage(sock, chatId, userMessage, isGroup);
        }

        if (recordingEnabledForChat) {
            await handleAutorecordingForMessage(sock, chatId, isGroup);
        }

        // Extract command
        let command, args, fullArgs;
        if (userMessage) {
            const extracted = extractCommand(userMessage, prefix);
            command = extracted.command;
            args = extracted.args;
            fullArgs = extracted.fullArgs;
            
            if (command) {
                console.log(chalk.green(`[COMMAND] Executing: ${command}`));
            }
        }

        // If no command but has text, handle chatbot/tag detection
        if (!command && userMessage) {
            if (isGroup) {
                await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);
            }
            return;
        }

        if (!command) return;

        // Handle edited messages
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

        // Define command categories
        const adminCommands = [
            'mute', 'unmute', 'ban', 'unban', 'promote', 'demote', 'kick', 
            'linkgroup', 'tagall', 'tagnotadmin', 'hidetag', 'antilink', 
            'antitag', 'setgdesc', 'setgname', 'setgpp', 'antikick', 
            'antipromote', 'antidemote', 'antibug', 'antigroupmention', 
            'antimention', 'antiaudio', 'antivideo', 'antidocument', 
            'antifiles', 'antisticker', 'antiimage', 'antibadword', 'welcome', 'goodbye',
            'add'
        ];
        
        const ownerCommands = [
            'mode', 'autostatus', 'antidelete', 'cleartmp', 'setpp', 
            'tostatus', 'clearsession', 'areact', 'autoreact', 'autotyping', 
            'autoread', 'pmblocker', 'setbotconfig', 'setbotname', 
            'setmenuimage', 'hijack', 'pair', 'autorecording', 'chatbot',
            'autocall', 'broadcast', 'creategroup', 'setowner', 'setprefix',
            'vv2', 'antiedit', 'antideletestatus', 'sad', 'ads', 'startupwelcome'
        ];

        const isAdminCommand = adminCommands.includes(command);
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

        // ========== COMMAND SWITCH CASE ==========
        switch (command) {
            // === BOT MANAGEMENT ===
            case 'setprefix':
                await handleSetPrefixCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'setowner':
                await handleSetOwnerCommand(sock, chatId, senderId, message, userMessage, prefix);
                commandExecuted = true;
                break;
                
            case 'owner':
                await ownerCommand(sock, chatId);
                commandExecuted = true;
                break;
                
            case 'ping':
            case 'dave':
                await pingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'uptime':
            case 'alive':
            case 'runtime':
                await aliveCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'help':
            case 'menu':
            case 'h':
            case 'pesh':
                await helpCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'menuconfig':
            case 'menustyle':
            case 'menuset':
            case 'setmenu':
                await menuConfigCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;
                
            case 'settings':
            case 'getsettings':
                await settingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'sudo':
                await sudoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'clearsession':
            case 'clearsesi':
                await clearSessionCommand(sock, chatId, message);
                commandExecuted = true;
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

            // === MODERATION COMMANDS ===
            case 'ban':
                await banCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'unban':
                await unbanCommand(sock, chatId, message);
                commandExecuted = true;
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
                commandExecuted = true;
                break;
                
            case 'unmute':
                await unmuteCommand(sock, chatId, senderId);
                commandExecuted = true;
                break;
                
            case 'kick':
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                commandExecuted = true;
                break;
                
            case 'warn':
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                commandExecuted = true;
                break;
                
            case 'warnings':
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                commandExecuted = true;
                break;
                
            case 'promote':
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                commandExecuted = true;
                break;
                
            case 'demote':
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                commandExecuted = true;
                break;
                
            case 'clear':
                if (isGroup) await clearCommand(sock, chatId);
                commandExecuted = true;
                break;
                
            case 'removeall':
            case 'killall':
                await kickAllCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'block':
                await blockCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'unblock':
                await unblockCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'blocklist':
            case 'listblock':
                await blocklistCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // === GROUP MANAGEMENT ===
            case 'groupinfo':
            case 'infogroup':
            case 'infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'admin':
            case 'listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await staffCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'reset':
            case 'revoke':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                commandExecuted = true;
                break;
                
            case 'linkgroup':
            case 'linkgc':
                await linkgroupCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'creategroup':
            case 'creategc':
                await creategroupCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'left':
            case 'leave':
                await leaveGroupCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'setgdesc':
                await setGroupDescription(sock, chatId, senderId, fullArgs, message);
                commandExecuted = true;
                break;
                
            case 'setgname':
                await setGroupName(sock, chatId, senderId, fullArgs, message);
                commandExecuted = true;
                break;
                
            case 'setgpp':
                await setGroupPhoto(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
                
            case 'tagall':
                if (isSenderAdmin || message.key.fromMe) {
                    await tagAllCommand(sock, chatId, senderId, message);
                } else {
                    await sock.sendMessage(chatId, { text: '_Only admins can use this command_', ...channelInfo }, { quoted: fake });
                }
                commandExecuted = true;
                break;
                
            case 'tagnotadmin':
                await tagNotAdminCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
                
            case 'hidetag':
                {
                    const messageText = fullArgs;
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                commandExecuted = true;
                break;
                
            case 'tag':
                const messageText = fullArgs;
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                commandExecuted = true;
                break;
                
            case 'add':
                await addMemberCommand(sock, chatId, message, fullArgs, prefix, senderId, isSenderAdmin, isBotAdmin, isGroup);
                commandExecuted = true;
                break;

            // === ANTI-FEATURES ===
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

                await antichartCommand(sock, chatId, userMessage, senderId, antichartIsSenderAdmin, message);
                commandExecuted = true;
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
                
            case 'antidelete':
                await handleAntideleteCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'mention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, fullArgs, isOwner);
                }
                commandExecuted = true;
                break;
                
            case 'setmention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                commandExecuted = true;
                break;
                
            case 'antibadword':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const abAdminStatus = await isAdmin(sock, chatId, senderId);
                const abIsSenderAdmin = abAdminStatus.isSenderAdmin;
                const abIsBotAdmin = abAdminStatus.isBotAdmin;

                if (!abIsBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    return;
                }

                await handleAntiBadwordCommand(sock, chatId, message, senderId, abIsSenderAdmin);
                commandExecuted = true;
                break;
                
            case 'antimention':
                await antimentionCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;
                
            case 'antipromote':
                await antipromoteCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;
                
            case 'antidemote':
                await antidemoteCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;
                
            case 'antibug':
                await antibugCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;
                
            case 'antikick':
                await antikickCommand(sock, chatId, message, senderId, isSenderAdmin);
                commandExecuted = true;
                break;
                
            case 'antiaudio':
                await antiaudioCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
                
            case 'antivideo':
                await antivideoCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
                
            case 'antidocument':
                await antidocumentCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
                
            case 'antifiles':
                await antifilesCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
                
            case 'antisticker':
                await antistickerCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;
                
            case 'antiimage':
                await antiimageCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                commandExecuted = true;
                break;

            // === AUTOMATION FEATURES ===
            case 'autotyping':
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'autoread':
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'autorecording':
                await autorecordingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'autostatus':
            case 'autoviewstatus':
            case 'autostatusview':
                await autoStatusCommand(sock, chatId, message, args);
                commandExecuted = true;
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
                commandExecuted = true;
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
                commandExecuted = true;
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
                commandExecuted = true;
                break;
                
            case 'topmembers':
                topMembers(sock, chatId, isGroup);
                commandExecuted = true;
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
                
            case 'anticall':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use anticall.' }, { quoted: fake });
                    break;
                }
                await anticallCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'setcallmsg':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use setcallmsg.' }, { quoted: fake });
                    break;
                }
                await setcallmsgCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'startupwelcome':
            case 'startupmsg':
                await startupWelcomeCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'broadcast':
            case 'bc':
                await broadcastCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'areact':
            case 'autoreact':
            case 'autoreaction':
                const isOwnerOrSudo = message.key.fromMe || senderIsSudo;
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudo);
                commandExecuted = true;
                break;

            // === MEDIA & ENTERTAINMENT ===
            case 'sticker':
            case 's':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
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
                
            case 'attp':
                await attpCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'emojimix':
            case 'emix':
                await emojimixCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'tg':
            case 'tgsticker':
                await stickerTelegramCommand(sock, chatId, message);            
                commandExecuted = true;
                break;
                
            case 'crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'qc':
            case 'qcstc':
            case 'qcstick':
            case 'quotesticker':
                await qcCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'tts':
                const ttsText = fullArgs;
                await ttsCommand(sock, chatId, ttsText, message);
                commandExecuted = true;
                break;
                
            case 'meme':
                await memeCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'song':
            case 'mp3':
                await songCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'video':
                await videoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'play':
                await playCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'ytmp4':
            case 'ytv':
                await ytplayCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'ytaudio':
            case 'ytplay':
                await ytsongCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'yts':
            case 'ytsearch':
                await ytsCommand(sock, chatId, senderId, message, userMessage);
                commandExecuted = true;
                break;
                
            case 'tiktok':
            case 'tt':
                await tiktokCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'tiktokaudio':
            case 'ttaudio':
            case 'ttm':
            case 'tiktokmusic':
                await tiktokaudioCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'spotify': 
                await spotifyCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'shazam':
            case 'whatsong':
            case 'find':
                await shazamCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'instagram':
            case 'insta':
            case 'ig':
                await instagramCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'igs':
                await igsCommand(sock, chatId, message, true);
                commandExecuted = true;
                break;
                
            case 'fb':
            case 'facebook':
                await facebookCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'movie':
                await movieCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'animu':
                await animeCommand(sock, chatId, message, args);
                commandExecuted = true;
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
                
            case 'imagine':
            case 'flux':
            case 'dalle': 
                await imagineCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'sora':
                await soraCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'mediafire':
                await mediafireCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // === AI & TOOLS ===
            case 'ai':
                await gpt4Command(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'gpt':
            case 'gemini':
                await aiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'wormgpt':
                await wormgptCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'copilot':
                await copilotCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'translate':
            case 'trt':
                await handleTranslateCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'ss':
            case 'ssweb':
            case 'screenshot':
                await handleSsCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'google':
            case 'search':
            case 'g':
                await googleCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'git':
            case 'github':
            case 'sc':
            case 'script':
            case 'repo':
                await githubCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'gitclone':
                await gitcloneCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'apk':
                await apkCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'tourl':
            case 'url':
                await urlCommand(sock, chatId, message);
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
                
            case 'analyze':
            case 'analysis':
            case 'analyzer':
                await analyzeCommand(sock, chatId, message, fullArgs, prefix);
                commandExecuted = true;
                break;
                
            case 'encrypt':
                await encryptCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'fetch':
            case 'inspect':
                await fetchCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'removebg':
            case 'rmbg':
            case 'nobg':
                await removebgCommand.exec(sock, message, args);
                commandExecuted = true;
                break;
                
            case 'remini':
            case 'enhance':
            case 'upscale':
                await reminiCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;
                
            case 'night':
                await nightCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'pretty':
            case 'beautiful':
                await prettyCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'ugly':
                await uglyCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;
                
            case 'blur':
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                commandExecuted = true;
                break;
                
            case 'textmaker':
                // Handle all textmaker styles
                const style = command;
                if ([
                    'metallic', 'ice', 'snow', 'impressive', 'matrix', 'light', 
                    'neon', 'devil', 'purple', 'thunder', 'leaves', '1917', 
                    'arena', 'hacker', 'sand', 'blackpink', 'glitch', 'fire'
                ].includes(style)) {
                    await textmakerCommand(sock, chatId, message, userMessage, style);
                }
                commandExecuted = true;
                break;
                
            case 'character':
                await characterCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'waste':
                await wastedCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'setpp':
                await setProfilePicture(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'getpp':
                await getppCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'tovv':
            case 'vo':
            case 'viewonce':
                await viewOnceCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'toaudio':
            case 'tomp3':
                await toAudioCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'setgstatus':
            case 'togroupstatus':
            case 'tosgroup':
                await setGroupStatusCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'img':
            case 'image':
                await imageCommand(sock, chatId, message, senderId, userMessage);
                commandExecuted = true;
                break;
                
            case 'hijack':
                await hijackCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;

            // === GAMES & FUN ===
            case 'hangman':
                startHangman(sock, chatId);
                commandExecuted = true;
                break;
                
            case 'guess':
                const guessedLetter = args[0];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: `Please guess a letter using ${prefix}guess <letter>`, ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
                
            case 'trivia':
                startTrivia(sock, chatId);
                commandExecuted = true;
                break;
                
            case 'answer':
                const answer = fullArgs;
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: `Please provide an answer using ${prefix}answer <answer>`, ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
                
            case 'ttt':
            case 'tictactoe':
                await tictactoeCommand(sock, chatId, senderId, fullArgs);
                commandExecuted = true;
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
                commandExecuted = true;
                break;
                
            case 'connect4':
            case 'cf':
                await connectFourCommand(sock, chatId, senderId, fullArgs);
                commandExecuted = true;
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
                commandExecuted = true;
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
                commandExecuted = true;
                break;
                
            case 'joke':
                await jokeCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'quote':
                await quoteCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'fact':
                await factCommand(sock, chatId, message, message);
                commandExecuted = true;
                break;
                
            case 'compliment':
                await complimentCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'insult':
                await insultCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case '8ball':
                const question = fullArgs;
                await eightBallCommand(sock, chatId, question);
                commandExecuted = true;
                break;
                
            case 'lyrics':
                const songTitle = fullArgs;
                await lyricsCommand(sock, chatId, songTitle, message);
                commandExecuted = true;
                break;
                
            case 'dare':
                await dareCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'truth':
                await truthCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'flirt':
                await flirtCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await shipCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'simp':
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                commandExecuted = true;
                break;
                
            case 'stupid':
            case 'itssostupid':
            case 'iss':
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, args);
                commandExecuted = true;
                break;
                
            case 'pair':
                await pairCommand(sock, chatId, fullArgs, message);
                commandExecuted = true;
                break;

            // === UTILITIES ===
            case 'delete':
            case 'del':
                await deleteCommand(sock, chatId, message, senderId);
                commandExecuted = true;
                break;
                
            case 'weather':
                const city = fullArgs;
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: `Please specify a city, e.g., ${prefix}weather London`, ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
                
            case 'news':
                await newsCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'channelid':
            case 'idch':
            case 'checkidch':
                await channelidCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'chanelid':
                await chaneljidCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'vcf':
            case 'vcard':
                await vcfCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'wallpaper':
                await wallpaperCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'take':
                await takeCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;
                
            case 'cleartemp':
                await clearTmpCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'tostatus':
            case 'tos':
                await tostatusCommand(sock, chatId, message);
                commandExecuted = true;
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
                commandExecuted = true;
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
                commandExecuted = true;
                break;
                
            case 'vn':
            case 'voicenote':
                await vnCommand(sock, chatId, message, fullArgs, prefix);
                commandExecuted = true;
                break;

            // === MISC COMMANDS ===
            case 'heart':
                await miscCommand(sock, chatId, message, ['heart', ...args]);
                commandExecuted = true;
                break;
                
            case 'horny':
                await miscCommand(sock, chatId, message, ['horny', ...args]);
                commandExecuted = true;
                break;
                
            case 'circle':
                await miscCommand(sock, chatId, message, ['circle', ...args]);
                commandExecuted = true;
                break;
                
            case 'lgbtq':
                await miscCommand(sock, chatId, message, ['lgbtq', ...args]);
                commandExecuted = true;
                break;
                
            case 'lolice':
                await miscCommand(sock, chatId, message, ['lolice', ...args]);
                commandExecuted = true;
                break;
                
            case 'simpcard':
                await miscCommand(sock, chatId, message, ['simpcard', ...args]);
                commandExecuted = true;
                break;
                
            case 'misc':
                await miscCommand(sock, chatId, message, ['misc', ...args]);
                commandExecuted = true;
                break;
                
            case 'its-so-stupid':
                await miscCommand(sock, chatId, message, ['its-so-stupid', ...args]);
                commandExecuted = true;
                break;
                
            case 'namecard':
                await miscCommand(sock, chatId, message, ['namecard', ...args]);
                commandExecuted = true;
                break;
                
            case 'oogway2':
            case 'oogway':
                const sub = command === 'oogway2' ? 'oogway2' : 'oogway';
                await miscCommand(sock, chatId, message, [sub, ...args]);
                commandExecuted = true;
                break;
                
            case 'tweet':
                await miscCommand(sock, chatId, message, ['tweet', ...args]);
                commandExecuted = true;
                break;
                
            case 'ytcomment':
                await miscCommand(sock, chatId, message, ['youtube-comment', ...args]);
                commandExecuted = true;
                break;
                
            case 'comrade':
            case 'gay':
            case 'glass':
            case 'jail':
            case 'passed':
            case 'triggered':
                await miscCommand(sock, chatId, message, [command, ...args]);
                commandExecuted = true;
                break;
                
            case 'goodnight':
            case 'lovenight':
            case 'gn':
                await goodnightCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'shayari':
            case 'shayri':
                await shayariCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'roseday':
                await rosedayCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // === SPORTS ===
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
                
            case 'ligue1':
            case 'ligueun':
            case 'frenchleague':
            case 'ligueone':
                await ligue1StandingsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // === RELIGIOUS ===
            case 'bible':
                await bibleCommand(sock, chatId, message, fullArgs, prefix);
                commandExecuted = true;
                break;
                
            case 'biblelist':
            case 'listbible':
                await bibleListCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'quran':
            case 'surah':
                await quranCommand(sock, chatId, message, fullArgs);
                commandExecuted = true;
                break;

            // === BOT CONFIG ===
            case 'setbotconfig':
                await setbotconfigCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'setbotname':
                await setbotnameCommand(sock, chatId, message);
                commandExecuted = true;
                break;
                
            case 'setmenuimage':
                await setmenuimageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // === TEXTMAKER STYLES (individual commands) ===
            case 'metallic':
            case 'ice':
            case 'snow':
            case 'impressive':
            case 'matrix':
            case 'light':
            case 'neon':
            case 'devil':
            case 'purple':
            case 'thunder':
            case 'leaves':
            case '1917':
            case 'arena':
            case 'hacker':
            case 'sand':
            case 'blackpink':
            case 'glitch':
            case 'fire':
                await textmakerCommand(sock, chatId, message, userMessage, command);
                commandExecuted = true;
                break;

            default:
                // If no command matched, check for chatbot response
                if (isGroup && userMessage) {
                    await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                }
                commandExecuted = false;
                break;
        }

        // Show typing/recording indicator after command execution
        if (commandExecuted !== false) {
            await showTypingAfterCommand(sock, chatId);
        }

        // Add reaction to commands
        if (userMessage.startsWith('.')) {
            await addCommandReaction(sock, message);
        }

    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        console.error(error.stack);
        try {
            const chatId = message?.key?.remoteJid;
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

// ========== GROUP PARTICIPANT UPDATE HANDLER ==========
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
        console.error(error.stack);
    }
}

// ========== EXPORTS ==========
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
    },
    handleIncomingCall: async (sock, call) => {
        await handleIncomingCall(sock, call);
    },
    handleAntieditUpdate: handleMessageUpdate
};