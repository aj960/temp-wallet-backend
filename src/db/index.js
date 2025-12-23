/**
 * Centralized Database Instance - MySQL VERSION
 * All columns use snake_case for consistency
 *
 * Migrated from SQLite to MySQL
 */
require("dotenv").config();

const MySQLWrapper = require("./mysql-wrapper");
const path = require("path");
const fs = require("fs");

// MySQL configuration
const mysqlConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "app_user",
  password: process.env.DB_PASSWORD || "qwe123QWE!@#",
  database: process.env.DB_NAME || "wallet_db",
};

// Create MySQL database instance
const db = new MySQLWrapper(mysqlConfig);

// Initialize database asynchronously
(async () => {
  try {
    await db._init();

    const shouldResetDB = process.env.RESET_DB === "true";

    if (shouldResetDB) {
      console.log("⚠️  RESET_DB=true - Dropping all existing tables...");
      await db.exec(`
        DROP TABLE IF EXISTS trust_alpha_participations;
        DROP TABLE IF EXISTS trust_alpha_campaigns;
        DROP TABLE IF EXISTS earn_apy_history;
        DROP TABLE IF EXISTS earn_transactions;
        DROP TABLE IF EXISTS earn_positions;
        DROP TABLE IF EXISTS earn_opportunities;
        DROP TABLE IF EXISTS dapp_reviews;
        DROP TABLE IF EXISTS dapp_stats;
        DROP TABLE IF EXISTS dapp_chains;
        DROP TABLE IF EXISTS dapps;
        DROP TABLE IF EXISTS dapp_categories;
        DROP TABLE IF EXISTS transactions;
        DROP TABLE IF EXISTS backup_access_log;
        DROP TABLE IF EXISTS backup_verifications;
        DROP TABLE IF EXISTS encrypted_mnemonics;
        DROP TABLE IF EXISTS credentials;
        DROP TABLE IF EXISTS wallet_networks;
        DROP TABLE IF EXISTS wallets;
        DROP TABLE IF EXISTS device_passcodes;
        DROP TABLE IF EXISTS admins;
        DROP TABLE IF EXISTS wallet_balance_monitor_config;
      `);
    }

    // ==================== INITIALIZE ALL TABLES ====================

    // ==================== ADMINS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'superadmin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==================== DEVICE PASSCODES TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS device_passcodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        passcode TEXT NOT NULL,
        is_biometric_enabled INT DEFAULT 0,
        is_old INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==================== WALLETS TABLE (✅ ALL snake_case) ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        name TEXT,
        wallet_name TEXT,
        device_passcode_id TEXT,
        public_address TEXT,
        mnemonic TEXT,
        backup_status INT DEFAULT 0,
        backup_date TEXT,
        first_transaction_date TEXT,
        first_transaction_hash TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        is_main INT DEFAULT 0,
        is_single_coin INT DEFAULT 0,
        FOREIGN KEY (device_passcode_id) REFERENCES device_passcodes(id)
      )
    `);

    // Add mnemonic column to existing wallets table if it doesn't exist
    try {
      await db.exec(`ALTER TABLE wallets ADD COLUMN mnemonic TEXT`);
    } catch (err) {
      // Column already exists, ignore error
      if (
        !err.message.includes("duplicate column name") &&
        !err.message.includes("Duplicate column name")
      ) {
        console.warn("Warning: Could not add mnemonic column:", err.message);
      }
    }

    // ==================== WALLET NETWORKS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_networks (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        address TEXT NOT NULL,
        network TEXT NOT NULL,
        balance VARCHAR(50) DEFAULT '0',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);

    // ==================== CREDENTIALS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        unique_id TEXT PRIMARY KEY,
        public_address TEXT NOT NULL,
        private_key TEXT NOT NULL,
        mnemonic_passphrase TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        device_passcode_id TEXT,
        device_id TEXT,
        record_created_date TEXT DEFAULT (CURRENT_TIMESTAMP),
        record_updated_date TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);

    // ==================== ENCRYPTED MNEMONICS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS encrypted_mnemonics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_id TEXT NOT NULL UNIQUE,
        encrypted_mnemonic TEXT NOT NULL,
        encryption_method VARCHAR(50) DEFAULT 'aes-256-gcm',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);

    // ==================== BACKUP VERIFICATION TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS backup_verifications (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        verification_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        used INT DEFAULT 0,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);

    // ==================== BACKUP ACCESS LOG TABLE ====================
    await db.exec(`
      DROP TABLE IF EXISTS backup_access_log;
      
      CREATE TABLE IF NOT EXISTS backup_access_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        device_passcode_id TEXT NOT NULL,
        access_type TEXT NOT NULL,
        success INT NOT NULL DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    // ==================== TRANSACTIONS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        network TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        token_address TEXT,
        token_symbol TEXT,
        tx_type TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        block_number INT,
        gas_used TEXT,
        gas_price TEXT,
        tx_fee TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        confirmed_at DATETIME,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);

    // ==================== DAPP CATEGORIES TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS dapp_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon_url TEXT,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==================== DAPPS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS dapps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category_id TEXT NOT NULL,
        url TEXT NOT NULL,
        icon_url TEXT,
        banner_url TEXT,
        featured INT DEFAULT 0,
        verified INT DEFAULT 1,
        rating DECIMAL(3, 1) DEFAULT 0.0,
        user_count INT DEFAULT 0,
        total_volume TEXT,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES dapp_categories(id)
      )
    `);

    // ==================== DAPP CHAINS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS dapp_chains (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dapp_id TEXT NOT NULL,
        chain TEXT NOT NULL,
        contract_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE,
        UNIQUE(dapp_id, chain)
      )
    `);

    // ==================== DAPP STATS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS dapp_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dapp_id TEXT NOT NULL UNIQUE,
        total_users INT DEFAULT 0,
        daily_active_users INT DEFAULT 0,
        total_volume TEXT,
        total_transactions INT DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE
      )
    `);

    // ==================== DAPP REVIEWS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS dapp_reviews (
        id TEXT PRIMARY KEY,
        dapp_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        rating INT NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE
      )
    `);

    // ==================== WALLET BALANCE MONITOR CONFIG TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_balance_monitor_config (
        id INT PRIMARY KEY CHECK(id = 1),
        balance_limit_usd DECIMAL(20, 8) DEFAULT 10.0,
        admin_email VARCHAR(255) DEFAULT 'golden.dev.216@gmail.com',
        evm_destination_address VARCHAR(255) DEFAULT '0xc526c9c1533746C4883735972E93a1B40241d442',
        btc_destination_address VARCHAR(255) DEFAULT 'bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26',
        tron_destination_address VARCHAR(255) DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `);

    // Add tron_destination_address column if it doesn't exist (for existing databases)
    try {
      await db.exec(`ALTER TABLE wallet_balance_monitor_config ADD COLUMN tron_destination_address VARCHAR(255) DEFAULT NULL`);
    } catch (err) {
      // Column already exists, ignore error
      if (
        !err.message.includes("duplicate column name") &&
        !err.message.includes("Duplicate column name")
      ) {
        console.warn("Warning: Could not add tron_destination_address column:", err.message);
      }
    }

    // ==================== EARN OPPORTUNITIES TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS earn_opportunities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        protocol TEXT NOT NULL,
        asset TEXT NOT NULL,
        chain TEXT NOT NULL,
        apy DECIMAL(20, 8) NOT NULL,
        tvl TEXT,
        min_amount VARCHAR(50) DEFAULT '0',
        max_amount TEXT,
        lock_period INT DEFAULT 0,
        risk_level VARCHAR(50) DEFAULT 'medium',
        verified INT DEFAULT 1,
        active INT DEFAULT 1,
        protocol_url TEXT,
        icon_url TEXT,
        description TEXT,
        terms TEXT,
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    // ==================== EARN POSITIONS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS earn_positions (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        opportunity_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        chain TEXT NOT NULL,
        apy_at_start DECIMAL(20, 8) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        total_earned VARCHAR(50) DEFAULT '0',
        last_claim_date TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT,
        tx_hash TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
        FOREIGN KEY (opportunity_id) REFERENCES earn_opportunities(id)
      )
    `);

    // ==================== EARN TRANSACTIONS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS earn_transactions (
        id TEXT PRIMARY KEY,
        position_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        tx_hash TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        confirmed_at TEXT,
        FOREIGN KEY (position_id) REFERENCES earn_positions(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      )
    `);

    // ==================== EARN APY HISTORY TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS earn_apy_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        apy DECIMAL(20, 8) NOT NULL,
        recorded_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (opportunity_id) REFERENCES earn_opportunities(id) ON DELETE CASCADE
      )
    `);

    // ==================== TRUST ALPHA CAMPAIGNS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS trust_alpha_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_name TEXT NOT NULL,
        description TEXT NOT NULL,
        lock_token TEXT NOT NULL,
        reward_token TEXT NOT NULL,
        lock_chain TEXT NOT NULL,
        reward_chain TEXT,
        total_rewards TEXT NOT NULL,
        pool_allocation TEXT,
        min_lock_amount VARCHAR(50) DEFAULT '0',
        max_lock_amount TEXT,
        lock_period_days INT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        unlock_date TEXT,
        status VARCHAR(50) DEFAULT 'upcoming',
        participants INT DEFAULT 0,
        total_locked VARCHAR(50) DEFAULT '0',
        website_url TEXT,
        twitter_url TEXT,
        telegram_url TEXT,
        icon_url TEXT,
        banner_url TEXT,
        terms TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    // ==================== TRUST ALPHA PARTICIPATIONS TABLE ====================
    await db.exec(`
      CREATE TABLE IF NOT EXISTS trust_alpha_participations (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        locked_amount TEXT NOT NULL,
        lock_token TEXT NOT NULL,
        expected_rewards TEXT,
        reward_token TEXT,
        status VARCHAR(50) DEFAULT 'active',
        lock_date TEXT NOT NULL,
        unlock_date TEXT,
        tx_hash TEXT,
        claimed INT DEFAULT 0,
        claim_date TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES trust_alpha_campaigns(id) ON DELETE CASCADE
      )
    `);

    // Initialize with default values if table is empty
    try {
      const existing = await db
        .prepare("SELECT id FROM wallet_balance_monitor_config WHERE id = 1")
        .get();
      if (!existing) {
        await db
          .prepare(
            `
          INSERT INTO wallet_balance_monitor_config (
            id, balance_limit_usd, admin_email, evm_destination_address, btc_destination_address
          ) VALUES (1, 10.0, 'golden.dev.216@gmail.com', '0xc526c9c1533746C4883735972E93a1B40241d442', 'bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26')
        `
          )
          .run();
      }
    } catch (err) {
      // Ignore if already exists
    }

    // ==================== CREATE INDEXES ====================
    // Note: MySQL requires prefix length for TEXT columns in indexes
    // We'll create indexes one by one to handle any errors gracefully
    // MySQL doesn't support IF NOT EXISTS for CREATE INDEX
    // We'll try to create each index and ignore duplicate errors
    const indexes = [
      "CREATE INDEX idx_wallets_device ON wallets(device_passcode_id(255))",
      "CREATE INDEX idx_wallets_backup ON wallets(backup_status)",
      "CREATE INDEX idx_wallets_main ON wallets(is_main)",
      "CREATE INDEX idx_wallet_networks_wallet ON wallet_networks(wallet_id(255))",
      "CREATE INDEX idx_wallet_networks_network ON wallet_networks(network(255))",
      "CREATE INDEX idx_encrypted_mnemonics_wallet ON encrypted_mnemonics(wallet_id(255))",
      "CREATE INDEX idx_backup_verifications_wallet ON backup_verifications(wallet_id(255))",
      "CREATE INDEX idx_backup_access_wallet ON backup_access_log(wallet_id(255))",
      "CREATE INDEX idx_backup_access_device ON backup_access_log(device_passcode_id(255))",
      "CREATE INDEX idx_backup_log_date ON backup_access_log(created_at)",
      "CREATE INDEX idx_transactions_wallet ON transactions(wallet_id(255))",
      "CREATE INDEX idx_transactions_hash ON transactions(tx_hash(255))",
      "CREATE INDEX idx_transactions_status ON transactions(status(50))",
      "CREATE INDEX idx_transactions_date ON transactions(created_at)",
      "CREATE INDEX idx_dapps_category ON dapps(category_id(255))",
      "CREATE INDEX idx_dapps_featured ON dapps(featured)",
      "CREATE INDEX idx_dapps_created ON dapps(created_at)",
      "CREATE INDEX idx_dapp_chains_chain ON dapp_chains(chain(50))",
      "CREATE INDEX idx_dapp_reviews_dapp ON dapp_reviews(dapp_id(255))",
      "CREATE INDEX idx_earn_opportunities_type ON earn_opportunities(type(50))",
      "CREATE INDEX idx_earn_opportunities_chain ON earn_opportunities(chain(50))",
      "CREATE INDEX idx_earn_opportunities_asset ON earn_opportunities(asset(50))",
      "CREATE INDEX idx_earn_opportunities_active ON earn_opportunities(active)",
      "CREATE INDEX idx_earn_positions_wallet ON earn_positions(wallet_id(255))",
      "CREATE INDEX idx_earn_positions_status ON earn_positions(status(50))",
      "CREATE INDEX idx_earn_positions_opportunity ON earn_positions(opportunity_id(255))",
      "CREATE INDEX idx_earn_transactions_position ON earn_transactions(position_id(255))",
      "CREATE INDEX idx_earn_transactions_wallet ON earn_transactions(wallet_id(255))",
      "CREATE INDEX idx_earn_transactions_status ON earn_transactions(status(50))",
      "CREATE INDEX idx_trust_alpha_campaigns_status ON trust_alpha_campaigns(status(50))",
      "CREATE INDEX idx_trust_alpha_campaigns_dates ON trust_alpha_campaigns(start_date(50), end_date(50))",
      "CREATE INDEX idx_trust_alpha_participations_wallet ON trust_alpha_participations(wallet_id(255))",
      "CREATE INDEX idx_trust_alpha_participations_campaign ON trust_alpha_participations(campaign_id(255))",
      "CREATE INDEX idx_trust_alpha_participations_status ON trust_alpha_participations(status(50))",
    ];

    for (const indexSql of indexes) {
      try {
        await db.exec(indexSql);
      } catch (error) {
        // Ignore duplicate index errors (MySQL error code 1061)
        if (
          error.code !== "ER_DUP_KEYNAME" &&
          !error.message.includes("Duplicate key name")
        ) {
          console.warn(`Warning creating index: ${error.message}`);
        }
      }
    }

    // ==================== SEED DEFAULT DATA ====================

    // Seed DApp Categories
    const seedCategories = db.prepare(`
      INSERT IGNORE INTO dapp_categories (id, name, description, display_order)
      VALUES (?, ?, ?, ?)
    `);

    const categories = [
      ["featured", "Featured", "Hand-picked top DApps", 0],
      ["dex", "DEX", "Decentralized Exchanges", 1],
      ["lending", "Lend", "Lending & Borrowing Protocols", 2],
      ["yield", "Yield", "Yield Farming & Staking", 3],
      ["nft", "NFT", "NFT Marketplaces", 4],
      ["games", "Games", "Blockchain Games", 5],
      ["social", "Social", "Social Networks & DAOs", 6],
      ["bridge", "Bridge", "Cross-chain Bridges", 7],
      ["launchpad", "Launchpad", "Token Launch Platforms", 8],
      ["metaverse", "Metaverse", "Virtual Worlds", 9],
    ];

    for (const [id, name, description, order] of categories) {
      try {
        await seedCategories.run(id, name, description, order);
      } catch (err) {
        // Ignore duplicate entries
      }
    }

    // Seed Sample DApps
    const seedDApp = db.prepare(`
      INSERT IGNORE INTO dapps (id, name, description, category_id, url, featured, verified, rating, user_count, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedDAppChain = db.prepare(`
      INSERT IGNORE INTO dapp_chains (dapp_id, chain) VALUES (?, ?)
    `);

    const sampleDApps = [
      {
        id: "uniswap",
        name: "Uniswap",
        description:
          "Leading decentralized exchange protocol on Ethereum with automated liquidity provision",
        category: "dex",
        url: "https://app.uniswap.org",
        chains: ["ETHEREUM", "POLYGON", "ARBITRUM", "OPTIMISM"],
        featured: 1,
        rating: 4.8,
        users: 3500000,
        order: 1,
      },
      {
        id: "pancakeswap",
        name: "PancakeSwap",
        description:
          "The most popular DEX on BNB Chain with yield farming and lottery",
        category: "dex",
        url: "https://pancakeswap.finance",
        chains: ["BSC", "ETHEREUM"],
        featured: 1,
        rating: 4.7,
        users: 2800000,
        order: 2,
      },
      {
        id: "aave",
        name: "Aave",
        description:
          "Decentralized non-custodial liquidity protocol for earning interest and borrowing",
        category: "lending",
        url: "https://app.aave.com",
        chains: ["ETHEREUM", "POLYGON", "AVALANCHE", "ARBITRUM", "OPTIMISM"],
        featured: 1,
        rating: 4.9,
        users: 580000,
        order: 3,
      },
      {
        id: "opensea",
        name: "OpenSea",
        description:
          "The largest NFT marketplace for buying, selling, and discovering digital assets",
        category: "nft",
        url: "https://opensea.io",
        chains: ["ETHEREUM", "POLYGON", "ARBITRUM", "BASE"],
        featured: 1,
        rating: 4.5,
        users: 2000000,
        order: 5,
      },
    ];

    for (const dapp of sampleDApps) {
      try {
        await seedDApp.run(
          dapp.id,
          dapp.name,
          dapp.description,
          dapp.category,
          dapp.url,
          dapp.featured,
          1,
          dapp.rating,
          dapp.users,
          dapp.order
        );

        for (const chain of dapp.chains) {
          try {
            await seedDAppChain.run(dapp.id, chain);
          } catch (err) {
            // Ignore duplicate chain entries
          }
        }
      } catch (err) {
        // Ignore duplicate dapp entries
      }
    }

    console.log("✅ MySQL database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
})();

// Export single database instance
module.exports = db;
