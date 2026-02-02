const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'davex.db');

let db = null;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        initializeTables();
    }
    return db;
}

function initializeTables() {
    const database = db;
    
    database.exec(`
        CREATE TABLE IF NOT EXISTS owner_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS group_settings (
            group_jid TEXT NOT NULL,
            setting_key TEXT NOT NULL,
            setting_value TEXT NOT NULL,
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (group_jid, setting_key)
        );
        
        CREATE TABLE IF NOT EXISTS warnings (
            group_jid TEXT NOT NULL,
            user_jid TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (group_jid, user_jid)
        );
        
        CREATE TABLE IF NOT EXISTS banned_users (
            user_jid TEXT PRIMARY KEY,
            reason TEXT,
            banned_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS sudo_users (
            user_jid TEXT PRIMARY KEY,
            added_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS premium_users (
            user_jid TEXT PRIMARY KEY,
            expires_at INTEGER,
            added_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS message_store (
            message_id TEXT PRIMARY KEY,
            chat_jid TEXT NOT NULL,
            sender_jid TEXT NOT NULL,
            content TEXT,
            media_type TEXT,
            media_path TEXT,
            is_view_once INTEGER DEFAULT 0,
            push_name TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_group_settings_jid ON group_settings(group_jid);
        CREATE INDEX IF NOT EXISTS idx_message_store_chat ON message_store(chat_jid);
        CREATE INDEX IF NOT EXISTS idx_message_store_timestamp ON message_store(timestamp);
    `);
    
    try {
        database.exec(`ALTER TABLE message_store ADD COLUMN push_name TEXT`);
    } catch {}
    
    console.log('[ DAVE-X ] Database tables initialized');
}

function setOwnerSetting(key, value) {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT OR REPLACE INTO owner_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, strftime('%s', 'now'))
    `);
    stmt.run(key, JSON.stringify(value));
}

function getOwnerSetting(key, defaultValue = null) {
    const database = getDb();
    const stmt = database.prepare('SELECT setting_value FROM owner_settings WHERE setting_key = ?');
    const row = stmt.get(key);
    if (row) {
        try {
            return JSON.parse(row.setting_value);
        } catch {
            return row.setting_value;
        }
    }
    return defaultValue;
}

function getAllOwnerSettings() {
    const database = getDb();
    const stmt = database.prepare('SELECT setting_key, setting_value FROM owner_settings');
    const rows = stmt.all();
    const settings = {};
    for (const row of rows) {
        try {
            settings[row.setting_key] = JSON.parse(row.setting_value);
        } catch {
            settings[row.setting_key] = row.setting_value;
        }
    }
    return settings;
}

function setGroupSetting(groupJid, key, value) {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT OR REPLACE INTO group_settings (group_jid, setting_key, setting_value, updated_at)
        VALUES (?, ?, ?, strftime('%s', 'now'))
    `);
    stmt.run(groupJid, key, JSON.stringify(value));
}

function getGroupSetting(groupJid, key, defaultValue = null) {
    const database = getDb();
    const stmt = database.prepare('SELECT setting_value FROM group_settings WHERE group_jid = ? AND setting_key = ?');
    const row = stmt.get(groupJid, key);
    if (row) {
        try {
            return JSON.parse(row.setting_value);
        } catch {
            return row.setting_value;
        }
    }
    return defaultValue;
}

function getAllGroupSettings(groupJid) {
    const database = getDb();
    const stmt = database.prepare('SELECT setting_key, setting_value FROM group_settings WHERE group_jid = ?');
    const rows = stmt.all(groupJid);
    const settings = {};
    for (const row of rows) {
        try {
            settings[row.setting_key] = JSON.parse(row.setting_value);
        } catch {
            settings[row.setting_key] = row.setting_value;
        }
    }
    return settings;
}

function deleteGroupSetting(groupJid, key) {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM group_settings WHERE group_jid = ? AND setting_key = ?');
    stmt.run(groupJid, key);
}

function getWarningCount(groupJid, userJid) {
    const database = getDb();
    const stmt = database.prepare('SELECT count FROM warnings WHERE group_jid = ? AND user_jid = ?');
    const row = stmt.get(groupJid, userJid);
    return row ? row.count : 0;
}

function incrementWarning(groupJid, userJid) {
    const database = getDb();
    const current = getWarningCount(groupJid, userJid);
    const newCount = current + 1;
    const stmt = database.prepare(`
        INSERT OR REPLACE INTO warnings (group_jid, user_jid, count, updated_at)
        VALUES (?, ?, ?, strftime('%s', 'now'))
    `);
    stmt.run(groupJid, userJid, newCount);
    return newCount;
}

function resetWarning(groupJid, userJid) {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM warnings WHERE group_jid = ? AND user_jid = ?');
    stmt.run(groupJid, userJid);
}

function addBannedUser(userJid, reason = '') {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT OR REPLACE INTO banned_users (user_jid, reason, banned_at)
        VALUES (?, ?, strftime('%s', 'now'))
    `);
    stmt.run(userJid, reason);
}

function removeBannedUser(userJid) {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM banned_users WHERE user_jid = ?');
    stmt.run(userJid);
}

function isBanned(userJid) {
    const database = getDb();
    const stmt = database.prepare('SELECT 1 FROM banned_users WHERE user_jid = ?');
    return !!stmt.get(userJid);
}

function getAllBannedUsers() {
    const database = getDb();
    const stmt = database.prepare('SELECT user_jid, reason, banned_at FROM banned_users');
    return stmt.all();
}

function addSudoUser(userJid) {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT OR IGNORE INTO sudo_users (user_jid, added_at)
        VALUES (?, strftime('%s', 'now'))
    `);
    stmt.run(userJid);
}

function removeSudoUser(userJid) {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM sudo_users WHERE user_jid = ?');
    stmt.run(userJid);
}

function isSudo(userJid) {
    const database = getDb();
    const stmt = database.prepare('SELECT 1 FROM sudo_users WHERE user_jid = ?');
    return !!stmt.get(userJid);
}

function getAllSudoUsers() {
    const database = getDb();
    const stmt = database.prepare('SELECT user_jid FROM sudo_users');
    return stmt.all().map(row => row.user_jid);
}

function storeMessage(messageId, chatJid, senderJid, content, mediaType = null, mediaPath = null, isViewOnce = false, pushName = null) {
    const database = getDb();
    const stmt = database.prepare(`
        INSERT OR REPLACE INTO message_store 
        (message_id, chat_jid, sender_jid, content, media_type, media_path, is_view_once, push_name, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);
    stmt.run(messageId, chatJid, senderJid, content, mediaType, mediaPath, isViewOnce ? 1 : 0, pushName);
}

function getMessage(messageId) {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM message_store WHERE message_id = ?');
    return stmt.get(messageId);
}

function deleteMessage(messageId) {
    const database = getDb();
    const stmt = database.prepare('DELETE FROM message_store WHERE message_id = ?');
    stmt.run(messageId);
}

function cleanOldMessages(maxAgeSeconds = 86400) {
    const database = getDb();
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds;
    const stmt = database.prepare('DELETE FROM message_store WHERE timestamp < ?');
    const result = stmt.run(cutoff);
    return result.changes;
}

function getMessageCount() {
    const database = getDb();
    const stmt = database.prepare('SELECT COUNT(*) as count FROM message_store');
    return stmt.get().count;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

process.on('exit', closeDb);
process.on('SIGINT', () => { closeDb(); process.exit(); });
process.on('SIGTERM', () => { closeDb(); process.exit(); });

module.exports = {
    getDb,
    setOwnerSetting,
    getOwnerSetting,
    getAllOwnerSettings,
    setGroupSetting,
    getGroupSetting,
    getAllGroupSettings,
    deleteGroupSetting,
    getWarningCount,
    incrementWarning,
    resetWarning,
    addBannedUser,
    removeBannedUser,
    isBanned,
    getAllBannedUsers,
    addSudoUser,
    removeSudoUser,
    isSudo,
    getAllSudoUsers,
    storeMessage,
    getMessage,
    deleteMessage,
    cleanOldMessages,
    getMessageCount,
    closeDb
};
