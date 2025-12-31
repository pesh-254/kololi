async function gitcloneCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const parts = text.split(' ');
    const query = parts.slice(1).join(' ').trim();

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
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
                }
            },
            participant: "0@s.whatsapp.net"
        };
    }

    const fake = createFakeContact(message);

    if (!query) {
        await sock.sendMessage(chatId, {
            text: "Please provide a Git repository URL.\n\nUsage:\n.gitclone https://github.com/user/repo.git"
        }, { quoted: fake });
        return;
    }

    const { exec } = require("child_process");
    const path = require("path");
    const fs = require("fs");

    try {
        const repoUrl = query.trim();
        const repoNameMatch = repoUrl.match(/\/([^\/]+)\.git$/);

        if (!repoNameMatch) {
            await sock.sendMessage(chatId, {
                text: "Invalid Git repository URL."
            }, { quoted: fake });
            return;
        }

        const repoName = repoNameMatch[1];
        const targetPath = path.resolve(__dirname, "../repos", repoName);

        await sock.sendMessage(chatId, {
            text: `Cloning repository: ${repoUrl}`
        }, { quoted: fake });

        if (!fs.existsSync(path.dirname(targetPath))) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        }

        exec(`git clone ${repoUrl} "${targetPath}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error("Git clone error:", error);
                await sock.sendMessage(chatId, {
                    text: `Failed to clone repository:\n${error.message}`
                }, { quoted: fake });
                return;
            }

            let messageText = `Successfully cloned repository: ${repoName}\n\n`;
            if (stdout) messageText += `Output:\n${stdout}`;
            if (stderr) messageText += `\nWarnings/Errors:\n${stderr}`;

            await sock.sendMessage(chatId, {
                text: messageText
            }, { quoted: fake });
        });

    } catch (error) {
        console.error("Error in gitcloneCommand:", error);
        await sock.sendMessage(chatId, {
            text: "Something went wrong while cloning the repository."
        }, { quoted: fake });
    }
}

module.exports = gitcloneCommand;