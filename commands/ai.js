const axios = require('axios');

async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text ||
                    message.text;
        
        if (!text) {
            return await sendPromptMessage(sock, chatId, message);
        }

        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();
        
        if (!query) {
            return await sendEmptyQueryMessage(sock, chatId, message);
        }

        await sock.sendMessage(chatId, {
            react: { text: '⚡', key: message.key }
        });

        await processAIRequest(sock, chatId, message, query);
        
    } catch (error) {
        console.error('AI Command Error:', error);
        await sendErrorMessage(sock, chatId, message);
    }
}

function createFakeContact() {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE AI",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;AI Assistant;;;\nFN:DAVE AI\nitem1.TEL;waid=${sock.user?.id?.split(':')[0] || '0000000000'}:${sock.user?.id?.split(':')[0] || '0000000000'}\nitem1.X-ABLabel:AI Assistant\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function sendPromptMessage(sock, chatId, message) {
    const fakeContact = createFakeContact();
    
    const promptText = `🧠 *DAVE AI Assistant*\n\n` +
                      `I'm ready to help! Just ask me anything after the command.\n\n` +
                      `📌 *Example:*\n` +
                      `!gpt Explain quantum computing in simple terms\n` +
                      `!ai How to make chocolate chip cookies?\n\n` +
                      `✨ *Powered by DeepSeek AI*`;
    
    return await sock.sendMessage(chatId, { 
        text: promptText 
    }, { 
        quoted: fakeContact 
    });
}

async function sendEmptyQueryMessage(sock, chatId, message) {
    const fakeContact = createFakeContact();
    
    return await sock.sendMessage(chatId, { 
        text: `📝 *Query Required*\n\n` +
              `Please provide your question after the command.\n\n` +
              `💡 *Try something like:*\n` +
              `• !gpt What is artificial intelligence?\n` +
              `• !ai Best programming language for beginners\n` +
              `• !ask How to meditate properly?`
    }, { 
        quoted: fakeContact 
    });
}

async function sendErrorMessage(sock, chatId, message) {
    const fakeContact = createFakeContact();
    
    return await sock.sendMessage(chatId, {
        text: `⚠️ *Temporary Issue*\n\n` +
              `DAVE AI is experiencing high traffic right now.\n` +
              `Please try again in a few moments.\n\n` +
              `🔄 *Quick fixes:*\n` +
              `• Check your internet connection\n` +
              `• Try a shorter question\n` +
              `• Use simpler language`,
        contextInfo: {
            mentionedJid: [message.key.participant || message.key.remoteJid]
        }
    }, { 
        quoted: fakeContact 
    });
}

async function processAIRequest(sock, chatId, message, query) {
    const fakeContact = createFakeContact();
    
    try {
        const apiUrl = `https://api.zenzxz.my.id/api/ai/chatai?query=${encodeURIComponent(query)}&model=deepseek-v3`;
        
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const data = response.data;
        
        const replyText = data?.data?.answer || "No response received from AI.";
        
        if (replyText !== "No response from AI bitch." && replyText.length > 0) {
            await sock.sendMessage(chatId, {
                text: `🤖 *DAVE AI Response*\n\n` +
                      `${replyText}\n\n` +
                      `━━━━━━━━━━━━━━━━━━\n` +
                      `💭 *Question:* ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}\n` +
                      `✨ *Model:* DeepSeek v3\n` +
                      `⚡ *Powered by DAVE-MD*`
            }, { 
                quoted: fakeContact 
            });
            
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });
        } else {
            await sock.sendMessage(chatId, {
                text: `🤔 *No Clear Answer*\n\n` +
                      `The AI couldn't provide a clear response to that question.\n\n` +
                      `🔍 *Suggestions:*\n` +
                      `• Rephrase your question\n` +
                      `• Ask about a different topic\n` +
                      `• Be more specific`
            }, { 
                quoted: fakeContact 
            });
        }
    } catch (error) {
        console.error('API Error:', error);
        
        if (error.response?.status === 429) {
            await sock.sendMessage(chatId, {
                text: `🚫 *Rate Limit Exceeded*\n\n` +
                      `You've made too many requests recently.\n\n` +
                      `⏰ *Please wait:* 5-10 minutes\n` +
                      `📊 *Limit:* 15 requests per hour\n\n` +
                      `✨ *Premium users get higher limits*`,
                contextInfo: {
                    mentionedJid: [message.key.participant || message.key.remoteJid]
                }
            }, { 
                quoted: fakeContact 
            });
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            await sock.sendMessage(chatId, {
                text: `⏳ *Request Timeout*\n\n` +
                      `The AI took too long to respond.\n\n` +
                      `⚡ *Try:*\n` +
                      `• Shorter questions\n` +
                      `• Less complex topics\n` +
                      `• Try again in 30 seconds`
            }, { 
                quoted: fakeContact 
            });
        } else {
            await sock.sendMessage(chatId, {
                text: `🔧 *Service Unavailable*\n\n` +
                      `DAVE AI is currently undergoing maintenance.\n\n` +
                      `🛠️ *Status:* Partial outage\n` +
                      `⏰ *ETA:* 15-30 minutes\n\n` +
                      `📢 Check @DAVE_Status for updates`
            }, { 
                quoted: fakeContact 
            });
        }
        
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = aiCommand;