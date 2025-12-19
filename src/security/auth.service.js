const bcrypt = require("bcrypt");
const crypto = require("crypto");

class AuthService {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    this.lockTime = parseInt(process.env.LOCK_TIME) || 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    try {
      // Validate password strength
      const salt = await bcrypt.genSalt(this.saltRounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if match
   */
  async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error("Password comparison failed");
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @throws {Error} - If password doesn't meet requirements
   */
  validatePasswordStrength(password) {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new Error(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      );
    }

    // Check for common passwords
    const commonPasswords = ["password", "12345678", "qwerty", "abc123"];
    if (
      commonPasswords.some((common) => password.toLowerCase().includes(common))
    ) {
      throw new Error(
        "Password is too common. Please choose a stronger password"
      );
    }
  }

  /**
   * Generate secure API key
   * @returns {string} - API key
   */
  generateApiKey() {
    return `tw_${crypto.randomBytes(32).toString("hex")}`;
  }

  /**
   * Generate device passcode hash
   * @param {string} passcode - Device passcode
   * @returns {Promise<string>} - Hashed passcode
   */
  async hashPasscode(passcode) {
    if (!passcode || passcode.length < 4) {
      throw new Error("Passcode must be at least 4 characters");
    }
    return await bcrypt.hash(passcode, 10); // Lower rounds for passcodes
  }

  /**
   * Compare device passcode
   * @param {string} passcode - Plain passcode
   * @param {string} hash - Hashed passcode
   * @returns {Promise<boolean>}
   */
  async comparePasscode(passcode, hash) {
    return await bcrypt.compare(passcode, hash);
  }

  /**
   * Generate secure OTP
   * @param {number} length - OTP length
   * @returns {string} - OTP
   */
  generateOTP(length = 6) {
    const digits = "0123456789";
    let otp = "";

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      otp += digits[randomIndex];
    }

    return otp;
  }
}

module.exports = new AuthService();
