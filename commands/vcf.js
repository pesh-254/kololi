const fs = require('fs');
const path = require('path');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Export",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Export;;;\nFN:Davex Contact Export\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Export Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function vcfCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    
    try {
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: "Group context required" 
            }, { quoted: fakeContact });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        
        if (participants.length < 2) {
            await sock.sendMessage(chatId, { 
                text: "Minimum two participants needed" 
            }, { quoted: fakeContact });
            return;
        }

        await sock.sendMessage(chatId, { 
            text: `Processing contact data for ${groupMetadata.subject}` 
        }, { quoted: fakeContact });

        let vcfContent = '';
        participants.forEach(participant => {
            const phoneNumber = participant.id.split('@')[0];
            const displayName = participant.notify || `User_${phoneNumber}`;
            
            vcfContent += `BEGIN:VCARD\n` +
                          `VERSION:3.0\n` +
                          `FN:${displayName}\n` +
                          `TEL;TYPE=CELL:+${phoneNumber}\n` +
                          `NOTE:From ${groupMetadata.subject}\n` +
                          `END:VCARD\n\n`;
        });

        const sanitizedGroupName = groupMetadata.subject.replace(/[^\w]/g, '_');
        const tempDir = path.join(__dirname, '../temp');
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const vcfPath = path.join(tempDir, `${sanitizedGroupName}_${Date.now()}.vcf`);
        fs.writeFileSync(vcfPath, vcfContent);

        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, {
                    document: fs.readFileSync(vcfPath),
                    mimetype: 'text/vcard',
                    fileName: `${sanitizedGroupName}_contacts.vcf`,
                    caption: `Group contact export\nGroup: ${groupMetadata.subject}\nParticipant count: ${participants.length}`
                }, { quoted: fakeContact });

                setTimeout(() => {
                    try {
                        if (fs.existsSync(vcfPath)) {
                            fs.unlinkSync(vcfPath);
                        }
                    } catch (cleanupError) {
                        console.error('File cleanup error:', cleanupError);
                    }
                }, 5000);
            } catch (sendError) {
                console.error('VCF transmission error:', sendError);
                await sock.sendMessage(chatId, { 
                    text: "Contact export transmission failure" 
                }, { quoted: fakeContact });
            }
        }, 4000);

    } catch (error) {
        console.error('VCF generation error:', error);
        await sock.sendMessage(chatId, { 
            text: "Contact export creation unsuccessful" 
        }, { quoted: fakeContact });
    }
}

module.exports = vcfCommand;