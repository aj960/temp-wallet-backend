const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = process.env.DB_ENCRYPTION_ALGORITHM || 'aes-256-gcm';
    this.secretKey = process.env.DB_ENCRYPTION_KEY;
    
    if (!this.secretKey || this.secretKey.length < 32) {
      throw new Error('DB_ENCRYPTION_KEY must be at least 32 characters long');
    }
    
    // Derive a proper 32-byte key from the secret
    this.key = crypto.scryptSync(this.secretKey, 'salt', 32);
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Plain text to encrypt
   * @returns {string} - Encrypted data in format: iv:authTag:encryptedData
   */
  encrypt(text) {
    try {
      if (!text) throw new Error('No text provided for encryption');

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return iv:authTag:encryptedData format
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error.message);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt encrypted data
   * @param {string} encryptedData - Data in format: iv:authTag:encryptedData
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData) throw new Error('No data provided for decryption');

      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate a secure random token
   * @param {number} length - Length of the token in bytes
   * @returns {string} - Hex string token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data using SHA-256
   * @param {string} data - Data to hash
   * @returns {string} - Hashed data
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compare hashed values in constant time (prevents timing attacks)
   * @param {string} a - First hash
   * @param {string} b - Second hash
   * @returns {boolean} - True if equal
   */
  constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

module.exports = new EncryptionService();