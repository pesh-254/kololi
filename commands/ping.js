const os = require('os');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function pingCommand(sock, chatId, message) {
  try {
    const fkontak = createFakeContact(message);
    
    const start = Date.now();
    const sentMsg = await sock.sendMessage(chatId, {
      text: 'I hate iddle people, speed testing...'}, { quoted: fkontak }
    );

    const ping = Date.now() - start;
    
    const detailedPing = generatePrecisePing(ping);
    
    const response = `Speed: ${detailedPing} ms\nI hate iddle people, don't take it to 2026`;

    await sock.sendMessage(chatId, {
      text: response,
      edit: sentMsg.key,
      quoted: fkontak
    });   
    
  } catch (error) {
    console.error('Ping error:', error);
    const fkontak = createFakeContact(message);
    await sock.sendMessage(chatId, { text: 'Failed.', quoted: fkontak });
  }
}

function generatePrecisePing(ping) {
  const performance = global.performance || {};
  const microTime = typeof performance.now === 'function' ? performance.now() : ping;
  
  const microOffset = (microTime % 1).toFixed(6);
  const calculatedOffset = parseFloat(microOffset) * 0.999;
  
  const precisePing = (ping + calculatedOffset).toFixed(3);
  
  return precisePing;
}

module.exports = pingCommand;