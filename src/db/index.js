/**
 * Centralized Database Instance - CLEAN VERSION
 * All columns use snake_case for consistency
 * 
 * This replaces src/db/index.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Determine database path (root level data directory)
const dbPath = path.join(__dirname, '../../data/wallets.db');

// Create single database instance
const db = new Database(dbPath, { 
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined 
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

//console.log(`✅ Database initialized at: ${dbPath}`);

// ==================== CHECK IF DATABASE EXISTS ====================
// Only drop tables if explicitly requested via RESET_DB environment variable
// This prevents data loss on server restart
const fs = require('fs');
const dbExists = fs.existsSync(dbPath);
const shouldResetDB = process.env.RESET_DB === 'true';

if (shouldResetDB) {
  console.log('⚠️  RESET_DB=true - Dropping all existing tables...');
  db.exec(`
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
  `);
} else if (dbExists) {
  console.log('✅ Database exists - Preserving existing data');
} else {
  console.log('📦 Creating new database...');
}

// ==================== INITIALIZE ALL TABLES ====================

// ==================== ADMINS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'superadmin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ==================== DEVICE PASSCODES TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS device_passcodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL,
    is_biometric_enabled INTEGER DEFAULT 0,
    is_old INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ==================== WALLETS TABLE (✅ ALL snake_case) ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    name TEXT,
    wallet_name TEXT,
    device_passcode_id TEXT,
    public_address TEXT,
    mnemonic TEXT,
    backup_status INTEGER DEFAULT 0,
    backup_date TEXT,
    first_transaction_date TEXT,
    first_transaction_hash TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    is_main INTEGER DEFAULT 0,
    is_single_coin INTEGER DEFAULT 0,
    FOREIGN KEY (device_passcode_id) REFERENCES device_passcodes(id)
  )
`);

// Add mnemonic column to existing wallets table if it doesn't exist
try {
  db.exec(`ALTER TABLE wallets ADD COLUMN mnemonic TEXT`);
} catch (err) {
  // Column already exists, ignore error
  if (!err.message.includes('duplicate column name')) {
    console.warn('Warning: Could not add mnemonic column:', err.message);
  }
}

// ==================== WALLET NETWORKS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS wallet_networks (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    address TEXT NOT NULL,
    network TEXT NOT NULL,
    balance TEXT DEFAULT '0',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
  )
`);

// ==================== CREDENTIALS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS credentials (
    unique_id TEXT PRIMARY KEY,
    public_address TEXT NOT NULL,
    private_key TEXT NOT NULL,
    mnemonic_passphrase TEXT NOT NULL,
    wallet_id TEXT NOT NULL,
    device_passcode_id TEXT,
    device_id TEXT,
    record_created_date TEXT DEFAULT (datetime('now')),
    record_updated_date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
  )
`);

// ==================== ENCRYPTED MNEMONICS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS encrypted_mnemonics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id TEXT NOT NULL UNIQUE,
    encrypted_mnemonic TEXT NOT NULL,
    encryption_method TEXT DEFAULT 'aes-256-gcm',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
  )
`);

// ==================== BACKUP VERIFICATION TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS backup_verifications (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    verification_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
  )
`);

// ==================== BACKUP ACCESS LOG TABLE ====================
db.exec(`
  DROP TABLE IF EXISTS backup_access_log;
  
  CREATE TABLE IF NOT EXISTS backup_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id TEXT NOT NULL,
    device_passcode_id TEXT NOT NULL,
    access_type TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
    -- ✅ NO FOREIGN KEY - just store the ID as text
  )
`);

//console.log('✅ backup_access_log table recreated without foreign key constraint');

// ==================== TRANSACTIONS TABLE ====================
db.exec(`
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
    status TEXT DEFAULT 'pending',
    block_number INTEGER,
    gas_used TEXT,
    gas_price TEXT,
    tx_fee TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
  )
`);

// ==================== DAPP CATEGORIES TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS dapp_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ==================== DAPPS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS dapps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id TEXT NOT NULL,
    url TEXT NOT NULL,
    icon_url TEXT,
    banner_url TEXT,
    featured INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 1,
    rating REAL DEFAULT 0.0,
    user_count INTEGER DEFAULT 0,
    total_volume TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES dapp_categories(id)
  )
`);

// ==================== DAPP CHAINS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS dapp_chains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dapp_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    contract_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE,
    UNIQUE(dapp_id, chain)
  )
`);

// ==================== DAPP STATS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS dapp_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dapp_id TEXT NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    daily_active_users INTEGER DEFAULT 0,
    total_volume TEXT,
    total_transactions INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE
  )
`);

// ==================== DAPP REVIEWS TABLE ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS dapp_reviews (
    id TEXT PRIMARY KEY,
    dapp_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE
  )
`);

// ==================== CREATE INDEXES ====================
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_wallets_device ON wallets(device_passcode_id);
  CREATE INDEX IF NOT EXISTS idx_wallets_backup ON wallets(backup_status);
  CREATE INDEX IF NOT EXISTS idx_wallets_main ON wallets(is_main);
  
  CREATE INDEX IF NOT EXISTS idx_wallet_networks_wallet ON wallet_networks(wallet_id);
  CREATE INDEX IF NOT EXISTS idx_wallet_networks_network ON wallet_networks(network);
  
  CREATE INDEX IF NOT EXISTS idx_encrypted_mnemonics_wallet ON encrypted_mnemonics(wallet_id);
  
  CREATE INDEX IF NOT EXISTS idx_backup_verifications_wallet ON backup_verifications(wallet_id);
  CREATE INDEX IF NOT EXISTS idx_backup_access_wallet ON backup_access_log(wallet_id);
  CREATE INDEX IF NOT EXISTS idx_backup_access_device ON backup_access_log(device_passcode_id);
  CREATE INDEX IF NOT EXISTS idx_backup_log_date ON backup_access_log(created_at DESC);
  
  CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at DESC);
  
  CREATE INDEX IF NOT EXISTS idx_dapps_category ON dapps(category_id);
  CREATE INDEX IF NOT EXISTS idx_dapps_featured ON dapps(featured);
  CREATE INDEX IF NOT EXISTS idx_dapps_created ON dapps(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_dapp_chains_chain ON dapp_chains(chain);
  CREATE INDEX IF NOT EXISTS idx_dapp_reviews_dapp ON dapp_reviews(dapp_id);
`);

// ==================== SEED DEFAULT DATA ====================

// Seed DApp Categories
const seedCategories = db.prepare(`
  INSERT OR IGNORE INTO dapp_categories (id, name, description, display_order)
  VALUES (?, ?, ?, ?)
`);

const categories = [
  ['featured', 'Featured', 'Hand-picked top DApps', 0],
  ['dex', 'DEX', 'Decentralized Exchanges', 1],
  ['lending', 'Lend', 'Lending & Borrowing Protocols', 2],
  ['yield', 'Yield', 'Yield Farming & Staking', 3],
  ['nft', 'NFT', 'NFT Marketplaces', 4],
  ['games', 'Games', 'Blockchain Games', 5],
  ['social', 'Social', 'Social Networks & DAOs', 6],
  ['bridge', 'Bridge', 'Cross-chain Bridges', 7],
  ['launchpad', 'Launchpad', 'Token Launch Platforms', 8],
  ['metaverse', 'Metaverse', 'Virtual Worlds', 9]
];

categories.forEach(([id, name, description, order]) => {
  try {
    seedCategories.run(id, name, description, order);
  } catch (err) {
    // Ignore duplicate entries
  }
});

// Seed Sample DApps
const seedDApp = db.prepare(`
  INSERT OR IGNORE INTO dapps (id, name, description, category_id, url, featured, verified, rating, user_count, display_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedDAppChain = db.prepare(`
  INSERT OR IGNORE INTO dapp_chains (dapp_id, chain) VALUES (?, ?)
`);

const sampleDApps = [
  {
    id: 'uniswap',
    name: 'Uniswap',
    description: 'Leading decentralized exchange protocol on Ethereum with automated liquidity provision',
    category: 'dex',
    url: 'https://app.uniswap.org',
    chains: ['ETHEREUM', 'POLYGON', 'ARBITRUM', 'OPTIMISM'],
    featured: 1,
    rating: 4.8,
    users: 3500000,
    order: 1
  },
  {
    id: 'pancakeswap',
    name: 'PancakeSwap',
    description: 'The most popular DEX on BNB Chain with yield farming and lottery',
    category: 'dex',
    url: 'https://pancakeswap.finance',
    chains: ['BSC', 'ETHEREUM'],
    featured: 1,
    rating: 4.7,
    users: 2800000,
    order: 2
  },
  {
    id: 'aave',
    name: 'Aave',
    description: 'Decentralized non-custodial liquidity protocol for earning interest and borrowing',
    category: 'lending',
    url: 'https://app.aave.com',
    chains: ['ETHEREUM', 'POLYGON', 'AVALANCHE', 'ARBITRUM', 'OPTIMISM'],
    featured: 1,
    rating: 4.9,
    users: 580000,
    order: 3
  },
  {
    id: 'opensea',
    name: 'OpenSea',
    description: 'The largest NFT marketplace for buying, selling, and discovering digital assets',
    category: 'nft',
    url: 'https://opensea.io',
    chains: ['ETHEREUM', 'POLYGON', 'ARBITRUM', 'BASE'],
    featured: 1,
    rating: 4.5,
    users: 2000000,
    order: 5
  }
];

sampleDApps.forEach(dapp => {
  try {
    seedDApp.run(
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

    dapp.chains.forEach(chain => {
      try {
        seedDAppChain.run(dapp.id, chain);
      } catch (err) {
        // Ignore duplicate chain entries
      }
    });
  } catch (err) {
    // Ignore duplicate dapp entries
  }
});

//console.log('✅ All database tables initialized with seed data');
//console.log('✅ All columns use snake_case naming convention');

// Export single database instance
module.exports = db;




