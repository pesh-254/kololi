const { createFakeContact, getBotName } = require('../lib/fakeContact');

async function calcCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ');
        const expression = args.slice(1).join(' ');
        
        if (!expression) {
            const helpText = `*${botName} CALCULATOR*\n\n` +
                           `Calculate mathematical expressions\n\n` +
                           `*Usage:*\n` +
                           `.calc 15 + 27\n` +
                           `.calc (10 * 3) / 2\n` +
                           `.calc sqrt(16) + pi\n` +
                           `.calc 2 * 3.14159 * 5\n\n` +
                           `*Supported:* +, -, *, /, sqrt(), pi, e, parentheses`;
            
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        // Safe evaluation function
        const safeEval = (expr) => {
            let cleaned = expr
                .replace(/[^0-9\-\/+*×÷πeE()sqrt\s.]/g, '')
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/π|pi/gi, 'Math.PI')
                .replace(/e/gi, 'Math.E')
                .replace(/sqrt\(/gi, 'Math.sqrt(')
                .replace(/\s+/g, '');
            
            const dangerousPatterns = [
                /(?:function|=>|new|constructor|prototype|__proto__|process|require|module|exports|console|window|document|alert|eval)/i,
                /[`'";]/,
                /Math\.(?!PI|E|sqrt)[a-zA-Z]/
            ];
            
            for (const pattern of dangerousPatterns) {
                if (pattern.test(cleaned)) {
                    throw new Error('Invalid characters');
                }
            }
            
            let parenCount = 0;
            for (const char of cleaned) {
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
                if (parenCount < 0) throw new Error('Mismatched parentheses');
            }
            if (parenCount !== 0) throw new Error('Mismatched parentheses');
            
            return cleaned;
        };

        try {
            const cleanedExpr = safeEval(expression);
            const format = cleanedExpr
                .replace(/Math\.PI/g, 'π')
                .replace(/Math\.E/g, 'e')
                .replace(/Math\.sqrt\(/g, '√(')
                .replace(/\//g, '÷')
                .replace(/\*/g, '×');
            
            const context = {
                Math: {
                    PI: Math.PI,
                    E: Math.E,
                    sqrt: Math.sqrt
                }
            };
            
            const calculator = new Function('Math', `return ${cleanedExpr}`);
            const result = calculator(context.Math);
            
            if (typeof result !== 'number' || !isFinite(result)) {
                throw new Error('Invalid result');
            }
            
            let formattedResult;
            if (Number.isInteger(result)) {
                formattedResult = result.toString();
            } else {
                formattedResult = parseFloat(result.toFixed(10)).toString();
                formattedResult = formattedResult.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
            }
            
            await sock.sendMessage(chatId, {
                text: `*${botName} CALCULATOR*\n\n` +
                      `*Expression:* ${format}\n` +
                      `*Result:* ${formattedResult}`
            }, { quoted: fake });
            
        } catch (calcError) {
            await sock.sendMessage(chatId, {
                text: `*${botName}*\n❌ Calculation Error: ${calcError.message}\n\n` +
                      `*Examples:*\n` +
                      `.calc 15 + 27\n` +
                      `.calc (10 * 3) / 2\n` +
                      `.calc sqrt(16) + pi`
            }, { quoted: fake });
        }
        
    } catch (error) {
        console.error('Calc error:', error.message);
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        await sock.sendMessage(chatId, {
            text: `*${botName}*\n❌ Failed to calculate: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = { calcCommand };