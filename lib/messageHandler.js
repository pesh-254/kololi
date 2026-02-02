// Original functions from your messageHandler.js
function getMessageText(message) {
    if (!message?.message) return '';

    const msg = message.message;

    // Check for view once messages
    const viewOnceContainer = msg.viewOnceMessageV2?.message || msg.viewOnceMessage?.message;
    if (viewOnceContainer) {
        return viewOnceContainer.conversation?.trim() ||
               viewOnceContainer.extendedTextMessage?.text?.trim() ||
               viewOnceContainer.imageMessage?.caption?.trim() ||
               viewOnceContainer.videoMessage?.caption?.trim() ||
               '';
    }

    return msg.conversation?.trim() ||
           msg.extendedTextMessage?.text?.trim() ||
           msg.imageMessage?.caption?.trim() ||
           msg.videoMessage?.caption?.trim() ||
           msg.documentMessage?.caption?.trim() ||
           msg.buttonsResponseMessage?.selectedButtonId?.trim() ||
           msg.listResponseMessage?.singleSelectReply?.selectedRowId?.trim() ||
           msg.templateButtonReplyMessage?.selectedId?.trim() ||
           '';
}

function isEditedMessage(message) {
    if (!message?.message) return false;
    
    const msg = message.message;
    
    // Baileys protocol message for edits (type 14)
    if (msg.protocolMessage?.type === 14) return true;
    if (msg.protocolMessage?.type === 'MESSAGE_EDIT') return true;
    if (msg.editedMessage) return true;
    
    return false;
}

function getEditedMessageText(message) {
    if (!message?.message) return '';

    const msg = message.message;

    if (msg.protocolMessage?.editedMessage?.message) {
        const edited = msg.protocolMessage.editedMessage.message;
        return edited.conversation?.trim() ||
               edited.extendedTextMessage?.text?.trim() ||
               edited.imageMessage?.caption?.trim() ||
               edited.videoMessage?.caption?.trim() ||
               edited.documentMessage?.caption?.trim() ||
               '';
    }

    if (msg.editedMessage?.message) {
        const edited = msg.editedMessage.message;
        return edited.conversation?.trim() ||
               edited.extendedTextMessage?.text?.trim() ||
               edited.imageMessage?.caption?.trim() ||
               edited.videoMessage?.caption?.trim() ||
               edited.documentMessage?.caption?.trim() ||
               '';
    }

    return '';
}

function extractCommand(text, prefix) {
    if (!text || typeof text !== 'string') return { command: '', args: [], fullArgs: '' };
    
    const trimmed = text.trim();
    
    if (prefix && !trimmed.startsWith(prefix)) {
        return { command: '', args: [], fullArgs: '' };
    }

    const withoutPrefix = prefix ? trimmed.slice(prefix.length) : trimmed;
    const parts = withoutPrefix.split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);
    const fullArgs = args.join(' ');

    return { command, args, fullArgs };
}

// ====== ENHANCED EDIT DETECTION ======
const originalMessages = new Map();
const MAX_STORED_MESSAGES = 500; // Store only recent commands

function storeOriginalMessage(message) {
    try {
        if (!message?.key?.id) return;
        
        const chatId = message.key.remoteJid;
        const msg = message.message;
        
        if (!msg) return;
        
        let text = '';
        // Get text from various message types
        if (msg.conversation) {
            text = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            text = msg.extendedTextMessage.text;
        } else if (msg.imageMessage?.caption) {
            text = msg.imageMessage.caption;
        } else if (msg.videoMessage?.caption) {
            text = msg.videoMessage.caption;
        } else if (msg.documentMessage?.caption) {
            text = msg.documentMessage.caption;
        }
        
        if (!text) return;
        
        // Simple cleanup: if we hit the limit, delete the oldest
        if (originalMessages.size >= MAX_STORED_MESSAGES) {
            const firstKey = originalMessages.keys().next().value;
            originalMessages.delete(firstKey);
        }
        
        // Store the message
        originalMessages.set(message.key.id, {
            text,
            sender: message.key.participant || message.key.remoteJid,
            chatId,
            timestamp: Date.now(),
            pushName: message.pushName || 'Unknown'
        });
        
    } catch (err) {
        // Silent fail - it's just command processing
    }
}

function getEditedMessageDetails(editedMessage) {
    try {
        let messageId = editedMessage.key.id;
        
        const msg = editedMessage.message;
        if (msg?.protocolMessage?.key?.id) {
            messageId = msg.protocolMessage.key.id;
        }
        
        const original = originalMessages.get(messageId);
        if (!original) return null;
        
        // Make sure the edit happened in the same chat
        if (original.chatId !== editedMessage.key.remoteJid) return null;
        
        let newText = '';
        
        if (msg?.protocolMessage?.editedMessage) {
            const edited = msg.protocolMessage.editedMessage;
            if (edited.conversation) {
                newText = edited.conversation;
            } else if (edited.extendedTextMessage?.text) {
                newText = edited.extendedTextMessage.text;
            } else if (edited.imageMessage?.caption) {
                newText = edited.imageMessage.caption;
            } else if (edited.videoMessage?.caption) {
                newText = edited.videoMessage.caption;
            }
        } else if (msg?.editedMessage?.message) {
            const edited = msg.editedMessage.message;
            if (edited.conversation) {
                newText = edited.conversation;
            } else if (edited.extendedTextMessage?.text) {
                newText = edited.extendedTextMessage.text;
            } else if (edited.imageMessage?.caption) {
                newText = edited.imageMessage.caption;
            } else if (edited.videoMessage?.caption) {
                newText = edited.videoMessage.caption;
            }
        }
        
        if (!newText || newText === original.text) return null;
        
        return {
            messageId,
            original: original,
            newText,
            editedMessage
        };
        
    } catch (err) {
        return null;
    }
}

// Enhanced function to check if we should process edited message
function shouldProcessEditedMessage(message, prefix) {
    if (!isEditedMessage(message)) return false;
    
    const editDetails = getEditedMessageDetails(message);
    if (!editDetails) return false;
    
    const editedText = editDetails.newText;
    if (!editedText) return false;

    if (prefix && !editedText.startsWith(prefix)) return false;

    return true;
}

// Get edited command with original context
function getEditedCommandWithContext(message, prefix) {
    try {
        const editDetails = getEditedMessageDetails(message);
        if (!editDetails) return null;
        
        const { original, newText } = editDetails;
        
        if (prefix && !newText.startsWith(prefix)) return null;
        
        const originalExtracted = extractCommand(original.text, prefix);
        const newExtracted = extractCommand(newText, prefix);
        
        return {
            isEdit: true,
            messageId: editDetails.messageId,
            original: {
                text: original.text,
                command: originalExtracted.command,
                args: originalExtracted.args,
                fullArgs: originalExtracted.fullArgs
            },
            edited: {
                text: newText,
                command: newExtracted.command,
                args: newExtracted.args,
                fullArgs: newExtracted.fullArgs
            },
            sender: original.sender,
            chatId: original.chatId,
            timestamp: Date.now(),
            message: editDetails.editedMessage
        };
        
    } catch (err) {
        return null;
    }
}

// Simple version - just get the edited text if it's a command
function getEditedCommandText(message, prefix) {
    if (!shouldProcessEditedMessage(message, prefix)) return null;
    
    const editDetails = getEditedMessageDetails(message);
    if (!editDetails) return null;
    
    return editDetails.newText;
}

module.exports = {
    // Original functions
    getMessageText,
    isEditedMessage,
    getEditedMessageText,
    extractCommand,
    shouldProcessEditedMessage,
    
    // Enhanced edit detection
    storeOriginalMessage,
    getEditedMessageDetails,
    getEditedCommandWithContext,
    getEditedCommandText,
    
    // Expose for debugging if needed
    originalMessages
};