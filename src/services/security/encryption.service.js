const crypto = require('crypto');
const bcrypt = require('bcrypt');


const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;


let db = null;
function getDB() {
  if (!db) {
    try {
      // Try multiple possible paths
      try {
        db = require('../../db/wallet/db/index');
      } catch (e1) {
        try {
          db = require('../../db/index');
        } catch (e2) {
          // Fallback: create direct connection
          const Database = require('better-sqlite3');
          const path = require('path');
          const dbPath = path.join(__dirname, '../../data/wallets.db');
          db = new Database(dbPath);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load database:', error.message);
      throw new Error('Database not initialized');
    }
  }
  return db;
}


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
 * Verify device passcode - FIXED VERSION
 */
exports.verifyDevicePasscode = async (devicePassCodeId, passcode) => {
  try {
    const database = getDB();
    
    const device = database.prepare(`
      SELECT passcode 
      FROM device_passcodes 
      WHERE id = ? AND is_old = 0
    `).get(devicePassCodeId);

    if (!device) {
      console.error('❌ Device not found:', devicePassCodeId);
      return false;
    }

    // ✅ FIX: Use bcrypt comparison (same as login endpoint)
    const isValid = await bcrypt.compare(passcode, device.passcode);
    
    //console.log(`${isValid ? '✅' : '❌'} Passcode verification for device: ${devicePassCodeId}`);
    
    return isValid;

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




