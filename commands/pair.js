const { createFakeContact, getBotName } = require('../lib/fakeContact');
const db = require('../Database/database');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function pairCommand(sock, chatId, q, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!await isAuthorized(sock, message)) {
            return sock.sendMessage(chatId, { text: `*${botName}*\nOwner only command!` }, { quoted: fake });
        }

        if (!q) {
            return sock.sendMessage(chatId, {
                text: `*${botName} PAIR COMMAND*\n\nGenerates a pairing code & session ID for a phone number.\n\nUsage: .pair <phone_number>\n\nExample: .pair 254712345678\n\nThe phone number must be in international format without + sign.`
            }, { quoted: fake });
        }

        const phoneNumber = q.replace(/[^0-9]/g, '');

        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nInvalid phone number!\nUse international format without + sign.\n\nExample: .pair 254712345678` 
            }, { quoted: fake });
        }

        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nGenerating pairing code for +${phoneNumber}...\nPlease wait...` 
        }, { quoted: fake });

        const tempDir = path.join(__dirname, '..', 'tmp', 'pair_' + phoneNumber + '_' + Date.now());

        try {
            await fs.promises.mkdir(tempDir, { recursive: true });

            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(tempDir);

            const pairSock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: ['DAVE-X', 'Chrome', '4.0.0']
            });

            await delay(3000);

            let code = await pairSock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            await sock.sendMessage(chatId, {
                text: `*${botName} PAIRING CODE*\n\nPhone: +${phoneNumber}\nCode: *${code}*\n\nThis code expires in 60 seconds.\n\n*Instructions:*\n1. Open WhatsApp on the target device\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code above when prompted`
            }, { quoted: fake });

            await sock.sendMessage(chatId, { text: code }, { quoted: fake });

            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(false);
                }, 90000);

                pairSock.ev.on('creds.update', async () => {
                    await saveCreds();
                });

                pairSock.ev.on('connection.update', async (update) => {
                    if (update.connection === 'open') {
                        await saveCreds();
                        await delay(2000);

                        const credsPath = path.join(tempDir, 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            const credsData = fs.readFileSync(credsPath, 'utf-8');
                            const base64Creds = Buffer.from(credsData).toString('base64');
                            const sessionId = `DAVE-X:~${base64Creds}`;

                            await sock.sendMessage(chatId, {
                                text: `*${botName} SESSION GENERATED*\n\nYour Session ID:\n\n${sessionId}\n\nSave this session ID. Use it in the SESSION_ID environment variable to connect.`
                            }, { quoted: fake });
                        }

                        clearTimeout(timeout);
                        try { pairSock.end(); } catch(e) {}
                        resolve(true);
                    } else if (update.connection === 'close') {
                        clearTimeout(timeout);
                        resolve(false);
                    }
                });
            });

            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch(e) {}

        } catch (innerErr) {
            console.error('Pair inner error:', innerErr.message);
            await sock.sendMessage(chatId, { 
                text: `*${botName}*\nFailed to generate pairing code: ${innerErr.message}` 
            }, { quoted: fake });
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}
        }

    } catch (error) {
        console.error('Pair command error:', error.message);
        const fake = createFakeContact(message?.key?.participant || message?.key?.remoteJid);
        await sock.sendMessage(chatId, { text: `*${getBotName()}*\nError: ${error.message}` }, { quoted: fake });
    }
}

module.exports = pairCommand;
