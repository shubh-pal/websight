'use strict';
/**
 * AES-256-GCM encryption for user API keys.
 * Keys are never stored in plaintext — encrypted at rest in the database.
 *
 * Storage format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // bytes

/**
 * Derives a 32-byte encryption key from ENCRYPTION_KEY env var (or falls
 * back to SESSION_SECRET). Uses SHA-256 so any string length works.
 */
function getDerivedKey() {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    'dev-encryption-key-change-in-production';
  return crypto.createHash('sha256').update(secret).digest(); // 32 bytes
}

/**
 * Encrypt a plaintext API key.
 * Returns a string in the form: iv_hex:authTag_hex:ciphertext_hex
 */
function encrypt(plaintext) {
  if (!plaintext) return null;
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored encrypted API key.
 * Accepts the format produced by encrypt().
 */
function decrypt(stored) {
  if (!stored) return null;
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted key format');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Returns a masked display hint for an API key, e.g. "••••a3F9"
 * Used so the UI can show the user a key is configured without revealing it.
 */
function getHint(apiKey) {
  if (!apiKey || apiKey.length < 8) return '••••••••';
  return '••••' + apiKey.slice(-4);
}

module.exports = { encrypt, decrypt, getHint };
