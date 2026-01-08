const axios = require('axios');

const COPILOT_API = {
    baseURL: "https://iamtkm.vercel.app",
    endpoint: "/ai/copilot",
    apiKey: "tkm"
};

async function copilotCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Microsoft Copilot\n\nUse: !cp [your question]\nExample: !cp help me code a login system" 
            });
        }

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "Need a question after !cp\nExample: !cp how to fix this error" 
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '⚡', key: message.key }
        });

        await processCopilotRequest(sock, chatId, message, query);

    } catch (error) {
        console.error('Copilot Command Error:', error);
        await sock.sendMessage(chatId, {
            text: "Copilot service down. Try again later."
        });
    }
}

async function processCopilotRequest(sock, chatId, message, query) {
    try {
        const apiUrl = `${COPILOT_API.baseURL}${COPILOT_API.endpoint}?apikey=${COPILOT_API.apiKey}&text=${encodeURIComponent(query)}`;
        
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'WhatsApp-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        const data = response.data;
        
        if (data.status && data.statusCode === 200 && data.result) {
            await sock.sendMessage(chatId, {
                text: data.result
            });
            
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });
        } else {
            await sock.sendMessage(chatId, {
                text: "Copilot couldn't generate a response. Try rephrasing."
            });
        }

    } catch (error) {
        console.error('Copilot API Error:', error.message);
        
        if (error.response?.status === 429) {
            await sock.sendMessage(chatId, {
                text: "Too many requests. Wait 5 minutes."
            });
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            await sock.sendMessage(chatId, {
                text: "Request timeout. Try shorter query."
            });
        } else {
            await sock.sendMessage(chatId, {
                text: "Copilot service error."
            });
        }

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = copilotCommand;