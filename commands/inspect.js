const fetch = require('node-fetch');

// Fake contact creator 😜
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Inspector",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:X;Dave;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:BOT\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function inspectCommand(sock, chatId, senderId, message, userMessage) {
    const fkontak = createFakeContact(message);
    
    try {
        const args = userMessage.split(' ').slice(1);
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `URL INSPECTOR COMMAND\n\nUsage:\n.inspect <url> - Check URL data\n.inspect <url> -j - JSON format\n.inspect <url> -d - Download file\n.inspect <url> -h - Show headers only\n.inspect <url> -n - No redirects\n\nExamples:\n.inspect https://example.com\n.inspect https://example.com/api -j\n.inspect https://example.com/image.jpg -d`
            }, { quoted: fkontak });
        }

        await sock.sendMessage(chatId, {
            text: `Scanning URL...`
        }, { quoted: fkontak });

        // Parse arguments
        const parts = query.split(' ');
        const url = parts[0];
        const flags = parts.slice(1);
        const download = flags.includes('-d');
        const json = flags.includes('-j');
        const headersOnly = flags.includes('-h');
        const followRedirects = !flags.includes('-n');

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'DaveX-Bot/1.0 (URL Inspector)'
            },
            redirect: followRedirects ? 'follow' : 'manual'
        });

        const responseInfo = {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            redirected: response.redirected,
            headers: {}
        };

        response.headers.forEach((value, key) => {
            responseInfo.headers[key] = value;
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (headersOnly) {
            let headersText = `RESPONSE HEADERS:\n\n`;
            headersText += `Status: ${responseInfo.status} ${responseInfo.statusText}\n`;
            headersText += `Final URL: ${responseInfo.url}\n`;
            headersText += `Redirected: ${responseInfo.redirected}\n\n`;

            for (const [key, value] of Object.entries(responseInfo.headers)) {
                headersText += `${key}: ${value}\n`;
            }

            return await sock.sendMessage(chatId, { text: headersText }, { quoted: fkontak });
        }

        // Handle media download
        if (download && (contentType.includes('audio/') ||
                         contentType.includes('video/') ||
                         contentType.includes('image/'))) {

            const contentLength = response.headers.get('content-length');
            const maxSize = 50 * 1024 * 1024;

            if (contentLength && parseInt(contentLength) > maxSize) {
                return await sock.sendMessage(chatId, {
                    text: `File too large (${(parseInt(contentLength)/1024/1024).toFixed(2)}MB)\nMax allowed: 50MB`
                }, { quoted: fkontak });
            }

            const buffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(buffer);

            let mediaType;
            let mediaMsg;

            if (contentType.includes('audio/')) {
                mediaType = 'Audio';
                mediaMsg = { audio: fileBuffer, mimetype: contentType };
            } else if (contentType.includes('video/')) {
                mediaType = 'Video';
                mediaMsg = { video: fileBuffer, mimetype: contentType };
            } else if (contentType.includes('image/')) {
                mediaType = 'Image';
                mediaMsg = { image: fileBuffer, mimetype: contentType };
            }

            // Send the media
            await sock.sendMessage(chatId, mediaMsg, { quoted: fkontak });

            // Send summary
            const details = {
                status: "Download complete",
                type: mediaType,
                mime: contentType,
                sizeKB: (fileBuffer.length / 1024).toFixed(2) + " KB",
                url: responseInfo.url
            };

            await sock.sendMessage(chatId, {
                text: `FILE DOWNLOADED:\n\n` +
                      `Status: ${details.status}\n` +
                      `Type: ${details.type}\n` +
                      `MIME: ${details.mime}\n` +
                      `Size: ${details.sizeKB}\n` +
                      `URL: ${details.url}`
            }, { quoted: fkontak });

            return;
        }

        // Handle JSON
        if (json || contentType.includes('application/json')) {
            let jsonData;
            try {
                jsonData = await response.json();
            } catch (err) {
                jsonData = null;
            }

            const formattedJson = jsonData ? JSON.stringify(jsonData, null, 2) : '{}';

            let responseText = `JSON Response:\n`;
            responseText += `\`\`\`json\n${formattedJson}\`\`\``;

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: fkontak });
        }

        // Handle text
        if (contentType.includes('text/')) {
            const text = await response.text();

            let responseText = `TEXT Response:\n`;
            responseText += `\`\`\`\n${text}\`\`\``;

            return await sock.sendMessage(chatId, { text: responseText }, { quoted: fkontak });
        }

        // Fallback response
        await sock.sendMessage(chatId, {
            text: `URL Inspection Complete\nStatus: ${responseInfo.status} ${responseInfo.statusText}\nContent-Type: ${contentType}`
        }, { quoted: fkontak });

    } catch (error) {
        console.error('Inspect command error:', error);

        let errorMessage;
        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout (30 seconds)';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Domain not found';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused';
        } else if (error.type === 'invalid-json') {
            errorMessage = 'Invalid JSON response';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `HTTP Error: ${error.message}`;
        } else {
            errorMessage = 'Error inspecting URL. Please verify the URL and try again.';
        }

        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: fkontak });
    }
}

module.exports = inspectCommand;