'use strict';
/**
 * Helper to fetch and decrypt a user's stored API keys from the database.
 * Returns a plain object: { anthropic?: string, gemini?: string }
 * Falls back to empty object if DB is unavailable or user has no keys.
 */

const db = require('../db');
const { decrypt } = require('./keyEncryption');

async function getUserApiKeys(userId) {
  if (!db.pool || !userId) return {};
  try {
    const result = await db.query(
      'SELECT provider, encrypted_key FROM api_keys WHERE user_id = $1',
      [userId]
    );
    const keys = {};
    for (const row of result.rows) {
      try {
        keys[row.provider] = decrypt(row.encrypted_key);
      } catch (decryptErr) {
        console.error(`[userKeys] Failed to decrypt key for provider ${row.provider}:`, decryptErr.message);
      }
    }
    return keys;
  } catch (err) {
    console.error('[userKeys] Error fetching user API keys:', err.message);
    return {};
  }
}

module.exports = { getUserApiKeys };
