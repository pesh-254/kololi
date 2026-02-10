const axios = require('axios');
const cheerio = require('cheerio');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE-X"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function MediaFire(url, options) {
  try {
    let mime;
    options = options ? options : {};
    const res = await axios.get(url, options);
    const $ = cheerio.load(res.data);
    const hasil = [];
    const link = $('a#downloadButton').attr('href');
    const size = $('a#downloadButton').text().replace('Download', '').replace('(', '').replace(')', '').replace('\n', '').replace('\n', '').replace('                         ', '');
    const seplit = link.split('/');
    const nama = seplit[5];
    mime = nama.split('.');
    mime = mime[1];
    hasil.push({ nama, mime, size, link });
    return hasil;
  } catch (err) {
    return err;
  }
}

async function mediafireCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';

    const query = text.split(' ').slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, { 
            text: "Example: .mediafire https://www.mediafire.com/file/abc123/file.zip\nProvide MediaFire link"
        }, { quoted: fake });
    }

    if (!query.includes('mediafire.com')) {
        return sock.sendMessage(chatId, { 
            text: "That doesn't look like a MediaFire link!"
        }, { quoted: fake });
    }

    try {
        await sock.sendMessage(chatId, { 
            text: "Downloading from MediaFire..."
        }, { quoted: fake });

        const fileInfo = await MediaFire(query);

        if (!fileInfo || !fileInfo.length || fileInfo instanceof Error) {
            return sock.sendMessage(chatId, { 
                text: "Failed to download file. File may have been removed or link is invalid."
            }, { quoted: fake });
        }

        const info = fileInfo[0];
        
        // Send file info first
        await sock.sendMessage(chatId, { 
            text: `📁 *MediaFire Download*\n\nFile: ${info.nama}\nSize: ${info.size}\nType: ${info.mime || 'Unknown'}\n\nDownloading...`
        });

        // Send the file
        await sock.sendMessage(
            chatId,
            {
                document: {
                    url: info.link,
                },
                fileName: info.nama,
                mimetype: info.mime,
                caption: `${info.nama} downloaded from MediaFire by DAVE-X BOT`, 
            },
            { quoted: fake }
        );

    } catch (error) {
        console.error("MediaFire Error:", error);
        await sock.sendMessage(chatId, { 
            text: `Failed to download: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = mediafireCommand;