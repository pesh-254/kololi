const fs = require('fs');
const fetch = require('node-fetch');
const { FormData } = require('formdata-node');
const { fileTypeFromBuffer } = require('file-type');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

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

async function reverseimageCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        
        // Check if message has image or is replying to image
        const hasImage = message.message?.imageMessage;
        const quotedImage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        
        if (!hasImage && !quotedImage) {
            await sock.sendMessage(chatId, { 
                text: '❌ Please reply to an image!\n\n*Usage:*\nReply to an image with: .reverseimage\n\n*Example:*\n1. Send an image\n2. Reply with: .reverseimage' 
            }, { quoted: fake });
            return;
        }

        // Get the image message
        const imageMessage = hasImage || quotedImage;

        // Show processing message
        await sock.sendMessage(chatId, { 
            text: '🔍 Processing image for reverse search...' 
        }, { quoted: fake });

        // Download the image
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Detect MIME type
        const type = await fileTypeFromBuffer(buffer);
        if (!type) {
            await sock.sendMessage(chatId, { 
                text: '❌ Could not determine image type. Try another image.' 
            }, { quoted: fake });
            return;
        }

        // Prepare FormData for Google reverse image search
        const form = new FormData();
        form.append('encoded_image', buffer, { filename: `image.${type.ext}` });
        form.append('image_content', '');

        // Send to Google
        const response = await fetch('https://www.google.com/searchbyimage/upload', {
            method: 'POST',
            body: form,
        });

        // Get redirected URL
        const redirectUrl = response.url;
        if (!redirectUrl) {
            throw new Error('No redirect URL received');
        }

        // Format response
        const result = `🔎 *REVERSE IMAGE SEARCH*\n\n*Google Search Results:*\n${redirectUrl}\n\n*Tips:*\n• Click the link to see similar images\n• Use desktop for better results\n• Works best with clear, high-quality images`;

        await sock.sendMessage(chatId, { 
            text: result 
        }, { quoted: fake });

    } catch (error) {
        console.error('Error in reverseimage command:', error);
        const fake = createFakeContact(message);
        
        // Check for specific errors
        if (error.message.includes('downloadContentFromMessage')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to download image. The image might be too large or corrupted.' 
            }, { quoted: fake });
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Network error. Could not connect to Google search.\n\n*Try again later or use:*\nhttps://images.google.com' 
            }, { quoted: fake });
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Failed to perform reverse image search.\n\n*Alternative:*\nUpload to https://images.google.com manually' 
            }, { quoted: fake });
        }
    }
}

module.exports = {
    reverseimageCommand
};