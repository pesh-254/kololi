const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
//const PDFDocument = require('pdfkit');
const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function toqrCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const qrText = args.slice(1).join(' ');
        
        if (!qrText) {
            await sock.sendMessage(chatId, {
                text: `*${botName} QR CODE GENERATOR*\n\n` +
                      `Generate QR codes as PDF\n\n` +
                      `*Usage:*\n` +
                      `.toqr https://example.com\n` +
                      `.toqr Hello World\n` +
                      `.toqr Your text here\n\n` +
                      `Output: PDF with QR code`
            }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*${botName}*\n⏳ Generating QR code PDF...`
        }, { quoted: fake });

        // Generate QR code
        const qrDataUrl = await qrcode.toDataURL(qrText, { scale: 8 });
        const qrBuffer = Buffer.from(qrDataUrl.replace('data:image/png;base64,', ''), 'base64');

        // Create PDF
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const pdfPath = path.join(tempDir, `qrcode_${Date.now()}.pdf`);
        
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const writeStream = fs.createWriteStream(pdfPath);
            
            doc.pipe(writeStream);
            
            // Add QR code to PDF
            doc.image(qrBuffer, {
                fit: [400, 400],
                align: 'center',
                valign: 'center',
                x: (doc.page.width - 400) / 2,
                y: (doc.page.height - 400) / 2
            });
            
            doc.end();
            
            writeStream.on('finish', async () => {
                try {
                    const pdfBuffer = fs.readFileSync(pdfPath);
                    
                    await sock.sendMessage(chatId, {
                        document: pdfBuffer,
                        mimetype: 'application/pdf',
                        fileName: `QRCode_${Date.now()}.pdf`,
                        caption: `*${botName} QR CODE*\n\n` +
                                 `*Content:* ${qrText.substring(0, 50)}${qrText.length > 50 ? '...' : ''}`
                    }, { quoted: fake });
                    
                    // Cleanup
                    fs.unlinkSync(pdfPath);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            writeStream.on('error', reject);
        });

    } catch (error) {
        console.error('QR code error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Failed to generate QR code: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = {
    toqrCommand
};