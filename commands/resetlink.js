async function resetlinkCommand(sock, chatId, senderId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        
        const isAdmin = groupMetadata.participants.some(p => 
            p.id === senderId && p.admin
        );
        
        const botUser = sock.user || sock.state?.legacy?.user;
        let botId;
        
        if (botUser && botUser.id) {
            const rawId = botUser.id.includes(':') ? botUser.id.split(':')[0] : botUser.id;
            botId = `${rawId}@s.whatsapp.net`;
        } else {
            const phoneNumber = sock.authState?.creds?.me?.id || '1234567890';
            botId = `${phoneNumber.split(':')[0]}@s.whatsapp.net`;
        }
        
        const isBotAdmin = groupMetadata.participants.some(p => 
            p.id === botId && p.admin
        );

        if (!isAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only admins can use this command!' 
            });
            return;
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Bot must be admin to reset group link!' 
            });
            return;
        }

        const newCode = await sock.groupRevokeInvite(chatId);
        
        await sock.sendMessage(chatId, { 
            text: `✅ Group link has been successfully reset!\n\n📌 New link:\nhttps://chat.whatsapp.com/${newCode}\n\n⚠️ Old link is now invalid.`
        });

    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to reset group link!\nError: ${error.message || 'Unknown error'}`
        });
    }
}

module.exports = resetlinkCommand;
