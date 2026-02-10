const qrcode = require('qrcode');

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

async function qrcodeCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);

        if (args.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '📱 *QR CODE GENERATOR*\n\n*Usage:*\n.qrcode <text>\n\n*Examples:*\n.qrcode Hello World\n.qrcode https://github.com\n.qrcode WiFi:S3cretPass;T:WPA;\n\n*Tip:* Scan with your phone camera!' 
            }, { quoted: fake });
            return;
        }

        const textToEncode = args.join(' ');

        // Validate text length
        if (textToEncode.length > 2000) {
            await sock.sendMessage(chatId, { 
                text: '❌ Text too long! Maximum 2000 characters.\n\nTry shortening your text or URL.' 
            }, { quoted: fake });
            return;
        }

        // Show processing
        await sock.sendPresenceUpdate('composing', chatId);

        // Generate QR code as buffer
        const qrBuffer = await qrcode.toBuffer(textToEncode, {
            type: 'png',
            margin: 2,
            scale: 8,
            color: {
                dark: '#000000', // Black dots
                light: '#FFFFFF' // White background
            },
            errorCorrectionLevel: 'H' // High error correction
        });

        // Create caption with the encoded text
        let caption = `📱 *QR CODE GENERATED*\n\n*Encoded Text:*\n\`\`\`${textToEncode}\`\`\`\n\n*Scan with:*\n• Phone camera\n• QR code scanner app\n\n*Length:* ${textToEncode.length} characters`;

        // Truncate long text in caption
        if (textToEncode.length > 100) {
            caption = `📱 *QR CODE GENERATED*\n\n*Encoded Text (truncated):*\n\`\`\`${textToEncode.substring(0, 100)}...\`\`\`\n\n*Full text encoded in QR*\n*Scan with phone camera*\n\n*Length:* ${textToEncode.length} characters`;
        }

        // Send QR code image
        await sock.sendMessage(chatId, {
            image: qrBuffer,
            caption: caption
        }, { quoted: fake });

        // If text is a URL, also send clickable version
        if (textToEncode.startsWith('http://') || textToEncode.startsWith('https://')) {
            setTimeout(async () => {
                await sock.sendMessage(chatId, {
                    text: `🔗 *Direct link:*\n${textToEncode}`
                });
            }, 1000);
        }

    } catch (error) {
        console.error('Error in qrcode command:', error);
        const fake = createFakeContact(message);

        if (error.message.includes('data too large')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Text too large for QR code!\n\nTry encoding shorter text (max ~2000 chars).' 
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to generate QR code.\n\n*Possible reasons:*\n• Invalid characters\n• Text too complex\n• Server error\n\nTry simpler text or shorter URL.' 
            }, { quoted: fake });
        }
    }
}

// Also handle qr and qrencode aliases
async function handleQrCodeCommand(sock, chatId, message) {
    // This function handles all QR code aliases
    await qrcodeCommand(sock, chatId, message);
}

module.exports = {
    qrcodeCommand,
    handleQrCodeCommand
};