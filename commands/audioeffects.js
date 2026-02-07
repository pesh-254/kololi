const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getRandom } = require('../lib/myfunc');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function audioEffectsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        // Get command text
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';
        
        // Extract command and args
        const args = text.trim().split(' ');
        const cmd = args[0]?.toLowerCase();
        
        // Valid audio effect commands
        const validCommands = ['bass', 'blown', 'deep', 'earrape', 'fast', 'fat', 'nightcore', 'reverse', 'robot', 'slow', 'smooth', 'tupai'];
        
        // If no command or invalid, show help
        if (!cmd || !validCommands.includes(cmd)) {
            const helpText = `*${botName} AUDIO EFFECTS*\n\n` +
                           `Apply audio effects to audio files!\n\n` +
                           `*Available Effects:*\n` +
                           `• .bass - Boost bass\n` +
                           `• .blown - Blown speaker effect\n` +
                           `• .deep - Deep voice effect\n` +
                           `• .earrape - Earrape effect (loud)\n` +
                           `• .fast - Speed up audio\n` +
                           `• .fat - Fat/thick audio\n` +
                           `• .nightcore - Nightcore effect\n` +
                           `• .reverse - Reverse audio\n` +
                           `• .robot - Robot voice effect\n` +
                           `• .slow - Slow down audio\n` +
                           `• .smooth - Smooth audio\n` +
                           `• .tupai - Chipmunk/tupai effect\n\n` +
                           `*Usage:* Reply to an audio with:\n` +
                           `.bass\n` +
                           `.reverse\n` +
                           `.nightcore etc.`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        // Check if replying to audio
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage || !quotedMessage.audioMessage) {
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nReply to an audio message with .${cmd} to apply the effect!` 
            }, { quoted: fake });
            return;
        }

        // Send processing message
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\n🎵 Applying ${cmd} effect... Please wait!` 
        }, { quoted: fake });

        // Define FFmpeg parameters for each effect
        let ffmpegParams = '';
        switch (cmd) {
            case 'bass':
                ffmpegParams = '-af equalizer=f=54:width_type=o:width=2:g=20';
                break;
            case 'blown':
                ffmpegParams = '-af acrusher=.1:1:64:0:log';
                break;
            case 'deep':
                ffmpegParams = '-af atempo=4/4,asetrate=44500*2/3';
                break;
            case 'earrape':
                ffmpegParams = '-af volume=12';
                break;
            case 'fast':
                ffmpegParams = '-filter:a "atempo=1.63,asetrate=44100"';
                break;
            case 'fat':
                ffmpegParams = '-filter:a "atempo=1.6,asetrate=22100"';
                break;
            case 'nightcore':
                ffmpegParams = '-filter:a atempo=1.06,asetrate=44100*1.25';
                break;
            case 'reverse':
                ffmpegParams = '-filter_complex "areverse"';
                break;
            case 'robot':
                ffmpegParams = '-filter_complex "afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75"';
                break;
            case 'slow':
                ffmpegParams = '-filter:a "atempo=0.7,asetrate=44100"';
                break;
            case 'smooth':
                ffmpegParams = '-filter:v "minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120\'"';
                break;
            case 'tupai':
                ffmpegParams = '-filter:a "atempo=0.5,asetrate=65100"';
                break;
            default:
                ffmpegParams = '';
        }

        // Download the quoted audio
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(quotedMessage.audioMessage, 'audio');
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Create temp files
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const inputFile = path.join(tempDir, `input_${Date.now()}.mp3`);
        const outputFile = path.join(tempDir, `output_${Date.now()}.mp3`);
        
        fs.writeFileSync(inputFile, buffer);

        // Apply audio effect with FFmpeg
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i "${inputFile}" ${ffmpegParams} "${outputFile}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('FFmpeg error:', error);
                    console.error('Stderr:', stderr);
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        // Check if output file exists
        if (!fs.existsSync(outputFile)) {
            throw new Error('FFmpeg failed to create output file');
        }

        // Read the processed audio
        const processedBuffer = fs.readFileSync(outputFile);

        // Send the processed audio
        await sock.sendMessage(chatId, {
            audio: processedBuffer,
            mimetype: 'audio/mpeg',
            ptt: true
        }, { quoted: fake });

        // Cleanup temp files
        try {
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);
        } catch (e) {
            console.error('Error cleaning temp files:', e);
        }

    } catch (error) {
        console.error('Audio effects error:', error.message, 'Line:', error.stack?.split('\n')[1]);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, { 
            text: `*${botName}*\n❌ Failed to process audio: ${error.message}` 
        }, { quoted: fake });
    }
}

module.exports = { audioEffectsCommand };