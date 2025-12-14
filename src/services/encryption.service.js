// src/services/encryption.service.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db/wallet/db/index.db');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt mnemonic using device passcode
 */
exports.encryptMnemonic = async (mnemonic, devicePassCodeId, passcode) => {
  try {
    // Generate salt
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive key from passcode using PBKDF2
    const key = crypto.pbkdf2Sync(
      passcode,
      salt,
      100000, // iterations
      32, // key length
      'sha256'
    );

    // Generate IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(mnemonic, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine: salt + iv + authTag + encrypted
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');

  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt mnemonic');
  }
};

/**
 * Decrypt mnemonic using device passcode
 */
exports.decryptMnemonic = async (encryptedData, devicePassCodeId, passcode) => {
  try {
    // Decode base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.slice(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key from passcode
    const key = crypto.pbkdf2Sync(
      passcode,
      salt,
      100000,
      32,
      'sha256'
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt mnemonic - invalid passcode');
  }
};

/**
 * Verify device passcode
 */
exports.verifyDevicePasscode = async (devicePassCodeId, passcode) => {
  try {
    const device = db.prepare(`
      SELECT passcode 
      FROM device_passcodes 
      WHERE id = ?
    `).get(devicePassCodeId);

    if (!device) {
      return false;
    }

    // Compare passcode (assuming it's stored as plain text in dev)
    // In production, use bcrypt.compare(passcode, device.passcode)
    return passcode === device.passcode;

  } catch (error) {
    console.error('❌ Passcode verification error:', error);
    return false;
  }
};

/**
 * Hash passcode for storage (use in production)
 */
exports.hashPasscode = async (passcode) => {
  const saltRounds = 10;
  return await bcrypt.hash(passcode, saltRounds);
};

/**
 * Compare passcode with hash (use in production)
 */
exports.comparePasscode = async (passcode, hash) => {
  return await bcrypt.compare(passcode, hash);
};


