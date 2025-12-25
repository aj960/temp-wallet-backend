/**
 * Migration Script: SQLite to MySQL
 * 
 * This script migrates all data from SQLite database to MySQL database.
 * 
 * Usage:
 *   node scripts/migrate-sqlite-to-mysql.js
 * 
 * Environment Variables:
 *   DB_HOST - MySQL host (default: localhost)
 *   DB_USER - MySQL user (default: app_user)
 *   DB_PASSWORD - MySQL password (default: qwe123QWE!@#)
 *   DB_NAME - MySQL database name (default: wallet_db)
 *   SQLITE_DB_PATH - Path to SQLite database (default: data/wallets.db)
 */

require('dotenv').config();

const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Configuration
const sqlitePath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/wallets.db');
console.log(process.env.DB_HOST, process.env.DB_NAME, process.env.DB_PASSWORD, process.env.DB_USER)
const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'qwe123QWE!@#',
  database: process.env.DB_NAME || 'wallet_db'
};

// Table order for migration (respecting foreign key constraints)
const tableOrder = [
  'admins',
  'device_passcodes',
  'wallets',
  'wallet_networks',
  'credentials',
  'encrypted_mnemonics',
  'backup_verifications',
  'backup_access_log',
  'transactions',
  'dapp_categories',
  'dapps',
  'dapp_chains',
  'dapp_stats',
  'dapp_reviews',
  'wallet_balance_monitor_config',
  'earn_opportunities',
  'earn_positions',
  'earn_transactions',
  'earn_apy_history',
  'trust_alpha_campaigns',
  'trust_alpha_participations'
];

// Convert SQLite SQL to MySQL SQL
function convertSQLiteToMySQL(sql) {
  let mysqlSql = sql;
  
  // Remove SQLite-specific pragmas
  mysqlSql = mysqlSql.replace(/PRAGMA\s+[^;]+;/gi, '');
  
  // Convert data types
  mysqlSql = mysqlSql.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  mysqlSql = mysqlSql.replace(/\bINTEGER\s+PRIMARY\s+KEY\b/gi, 'INT PRIMARY KEY');
  mysqlSql = mysqlSql.replace(/\bINTEGER\b/gi, 'INT');
  mysqlSql = mysqlSql.replace(/\bREAL\b/gi, 'DECIMAL(20, 8)');
  
  // Convert datetime functions
  mysqlSql = mysqlSql.replace(/datetime\s*\(\s*['"]now['"]\s*\)/gi, 'CURRENT_TIMESTAMP');
  mysqlSql = mysqlSql.replace(/DEFAULT\s+\(datetime\s*\(\s*['"]now['"]\s*\)\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
  
  // Convert AUTOINCREMENT
  mysqlSql = mysqlSql.replace(/\bAUTOINCREMENT\b/gi, 'AUTO_INCREMENT');
  
  // Remove DESC from index creation (MySQL handles it differently)
  mysqlSql = mysqlSql.replace(/\s+DESC\b/gi, '');
  
  return mysqlSql;
}

async function createAllTables(mysqlConn) {
  console.log('\n📦 Creating all tables in MySQL...');
  
  // Temporarily disable foreign key checks
  await mysqlConn.query('SET FOREIGN_KEY_CHECKS = 0');
  
  const tables = [
    // ADMINS TABLE
    `CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name TEXT NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(50) DEFAULT 'superadmin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // DEVICE PASSCODES TABLE
    `CREATE TABLE IF NOT EXISTS device_passcodes (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      passcode TEXT NOT NULL,
      is_biometric_enabled INT DEFAULT 0,
      is_old INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // WALLETS TABLE
    `CREATE TABLE IF NOT EXISTS wallets (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT,
      wallet_name TEXT,
      device_passcode_id VARCHAR(255),
      public_address TEXT,
      backup_status INT DEFAULT 0,
      backup_date TEXT,
      first_transaction_date TEXT,
      first_transaction_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_main INT DEFAULT 0,
      is_single_coin INT DEFAULT 0,
      mnemonic TEXT,
      FOREIGN KEY (device_passcode_id) REFERENCES device_passcodes(id)
    )`,
    
    // WALLET NETWORKS TABLE
    `CREATE TABLE IF NOT EXISTS wallet_networks (
      id VARCHAR(255) PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      network TEXT NOT NULL,
      balance TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    )`,
    
    // CREDENTIALS TABLE
    `CREATE TABLE IF NOT EXISTS credentials (
      unique_id VARCHAR(255) PRIMARY KEY,
      public_address TEXT NOT NULL,
      private_key TEXT NOT NULL,
      mnemonic_passphrase TEXT NOT NULL,
      wallet_id VARCHAR(255) NOT NULL,
      device_passcode_id VARCHAR(255),
      device_id TEXT,
      record_created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      record_updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    )`,
    
    // ENCRYPTED MNEMONICS TABLE
    `CREATE TABLE IF NOT EXISTS encrypted_mnemonics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL UNIQUE,
      encrypted_mnemonic TEXT NOT NULL,
      encryption_method VARCHAR(50) DEFAULT 'aes-256-gcm',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    )`,
    
    // BACKUP VERIFICATION TABLE
    `CREATE TABLE IF NOT EXISTS backup_verifications (
      id VARCHAR(255) PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL,
      verification_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used INT DEFAULT 0,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    )`,
    
    // BACKUP ACCESS LOG TABLE
    `CREATE TABLE IF NOT EXISTS backup_access_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL,
      device_passcode_id TEXT NOT NULL,
      access_type TEXT NOT NULL,
      success INT NOT NULL DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // TRANSACTIONS TABLE
    `CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(255) PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL,
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
    )`,
    
    // DAPP CATEGORIES TABLE
    `CREATE TABLE IF NOT EXISTS dapp_categories (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon_url TEXT,
      display_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // DAPPS TABLE
    `CREATE TABLE IF NOT EXISTS dapps (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id VARCHAR(255) NOT NULL,
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
    )`,
    
    // DAPP CHAINS TABLE
    `CREATE TABLE IF NOT EXISTS dapp_chains (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dapp_id VARCHAR(255) NOT NULL,
      chain VARCHAR(100) NOT NULL,
      contract_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE,
      UNIQUE(dapp_id, chain)
    )`,
    
    // DAPP STATS TABLE
    `CREATE TABLE IF NOT EXISTS dapp_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dapp_id VARCHAR(255) NOT NULL UNIQUE,
      total_users INT DEFAULT 0,
      daily_active_users INT DEFAULT 0,
      total_volume TEXT,
      total_transactions INT DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE
    )`,
    
    // DAPP REVIEWS TABLE
    `CREATE TABLE IF NOT EXISTS dapp_reviews (
      id VARCHAR(255) PRIMARY KEY,
      dapp_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      user_name TEXT,
      rating INT NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dapp_id) REFERENCES dapps(id) ON DELETE CASCADE
    )`,
    
    // WALLET BALANCE MONITOR CONFIG TABLE
    `CREATE TABLE IF NOT EXISTS wallet_balance_monitor_config (
      id INT PRIMARY KEY CHECK(id = 1),
      balance_limit_usd DECIMAL(20, 8) DEFAULT 10.0,
      admin_email VARCHAR(255) DEFAULT 'golden.dev.216@gmail.com',
      evm_destination_address VARCHAR(255) DEFAULT '0xc526c9c1533746C4883735972E93a1B40241d442',
      btc_destination_address VARCHAR(255) DEFAULT 'bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26',
      tron_destination_address VARCHAR(255) DEFAULT 'TXLhw9KrPZCfVxRwCAR6geEBhfnUW4r55b',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )`,
    
    // EARN OPPORTUNITIES TABLE
    `CREATE TABLE IF NOT EXISTS earn_opportunities (
      id VARCHAR(255) PRIMARY KEY,
      type TEXT NOT NULL,
      protocol TEXT NOT NULL,
      asset TEXT NOT NULL,
      chain TEXT NOT NULL,
      apy DECIMAL(20, 8) NOT NULL,
      tvl TEXT,
      min_amount TEXT,
      max_amount TEXT,
      lock_period INT DEFAULT 0,
      risk_level VARCHAR(50) DEFAULT 'medium',
      verified INT DEFAULT 1,
      active INT DEFAULT 1,
      protocol_url TEXT,
      icon_url TEXT,
      description TEXT,
      terms TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // EARN POSITIONS TABLE
    `CREATE TABLE IF NOT EXISTS earn_positions (
      id VARCHAR(255) PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL,
      opportunity_id VARCHAR(255) NOT NULL,
      amount TEXT NOT NULL,
      asset TEXT NOT NULL,
      chain TEXT NOT NULL,
      apy_at_start DECIMAL(20, 8) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      total_earned TEXT,
      last_claim_date TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      tx_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
      FOREIGN KEY (opportunity_id) REFERENCES earn_opportunities(id)
    )`,
    
    // EARN TRANSACTIONS TABLE
    `CREATE TABLE IF NOT EXISTS earn_transactions (
      id VARCHAR(255) PRIMARY KEY,
      position_id VARCHAR(255) NOT NULL,
      wallet_id VARCHAR(255) NOT NULL,
      type TEXT NOT NULL,
      amount TEXT NOT NULL,
      asset TEXT NOT NULL,
      tx_hash TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT,
      FOREIGN KEY (position_id) REFERENCES earn_positions(id) ON DELETE CASCADE,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    )`,
    
    // EARN APY HISTORY TABLE
    `CREATE TABLE IF NOT EXISTS earn_apy_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      opportunity_id VARCHAR(255) NOT NULL,
      apy DECIMAL(20, 8) NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (opportunity_id) REFERENCES earn_opportunities(id) ON DELETE CASCADE
    )`,
    
    // TRUST ALPHA CAMPAIGNS TABLE
    `CREATE TABLE IF NOT EXISTS trust_alpha_campaigns (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      description TEXT NOT NULL,
      lock_token TEXT NOT NULL,
      reward_token TEXT NOT NULL,
      lock_chain TEXT NOT NULL,
      reward_chain TEXT,
      total_rewards TEXT NOT NULL,
      pool_allocation TEXT,
      min_lock_amount TEXT,
      max_lock_amount TEXT,
      lock_period_days INT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      unlock_date TEXT,
      status VARCHAR(50) DEFAULT 'upcoming',
      participants INT DEFAULT 0,
      total_locked TEXT,
      website_url TEXT,
      twitter_url TEXT,
      telegram_url TEXT,
      icon_url TEXT,
      banner_url TEXT,
      terms TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // TRUST ALPHA PARTICIPATIONS TABLE
    `CREATE TABLE IF NOT EXISTS trust_alpha_participations (
      id VARCHAR(255) PRIMARY KEY,
      wallet_id VARCHAR(255) NOT NULL,
      campaign_id VARCHAR(255) NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES trust_alpha_campaigns(id) ON DELETE CASCADE
    )`
  ];

  for (let i = 0; i < tables.length; i++) {
    const tableSql = tables[i];
    try {
      const mysqlSql = convertSQLiteToMySQL(tableSql);
      await mysqlConn.query(mysqlSql);
      const tableName = tableSql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1] || `table_${i}`;
      console.log(`   ✅ Created table: ${tableName}`);
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
          error.code === 'ER_DUP_FIELDNAME' ||
          error.message.includes('Duplicate column name')) {
        const tableName = tableSql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1] || `table_${i}`;
        console.log(`   ⚠️  Table ${tableName} already exists, skipping...`);
      } else {
        console.error(`   ❌ Error creating table:`, error.message);
        console.error(`   SQL:`, tableSql.substring(0, 200));
        throw error;
      }
    }
  }
  
  // Re-enable foreign key checks
  await mysqlConn.query('SET FOREIGN_KEY_CHECKS = 1');
  
  // Verify tables exist
  const [tablesList] = await mysqlConn.query('SHOW TABLES');
  console.log(`\n✅ Created ${tablesList.length} tables in MySQL`);
  console.log(`   Tables: ${tablesList.map(t => Object.values(t)[0]).join(', ')}`);
}

async function migrateTable(sqliteDb, mysqlConn, tableName) {
  try {
    console.log(`\n📦 Migrating table: ${tableName}`);
    
    // Get all data from SQLite
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
    
    if (rows.length === 0) {
      console.log(`   ⚠️  Table ${tableName} is empty, skipping...`);
      return 0;
    }
    
    console.log(`   Found ${rows.length} rows`);
    
    // Get column names
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    const columnList = columns.join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    
    // Prepare INSERT statement
    const insertSql = `INSERT IGNORE INTO ${tableName} (${columnList}) VALUES (${placeholders})`;
    
    // Insert rows in batches
    let inserted = 0;
    const batchSize = 100;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        const values = columns.map(col => {
          const value = row[col];
          // Handle null values
          if (value === null || value === undefined) {
            return null;
          }
          // Convert boolean-like integers to proper integers
          if (typeof value === 'number') {
            return value;
          }
          // Keep strings as is
          return value;
        });
        
        try {
          await mysqlConn.query(insertSql, values);
          inserted++;
        } catch (error) {
          // Ignore duplicate key errors (INSERT IGNORE)
          if (error.code !== 'ER_DUP_ENTRY') {
            console.error(`   ❌ Error inserting row:`, error.message);
            console.error(`   Row data:`, JSON.stringify(row).substring(0, 200));
            throw error;
          }
        }
      }
    }
    
    console.log(`   ✅ Inserted ${inserted} rows into ${tableName}`);
    return inserted;
    
  } catch (error) {
    if (error.message.includes('no such table')) {
      console.log(`   ⚠️  Table ${tableName} does not exist in SQLite, skipping...`);
      return 0;
    }
    console.error(`   ❌ Error migrating table ${tableName}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting SQLite to MySQL Migration\n');
  console.log('SQLite Database:', sqlitePath);
  console.log('MySQL Database:', `${mysqlConfig.user}@${mysqlConfig.host}/${mysqlConfig.database}`);
  
  // Check if SQLite database exists
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite database not found at: ${sqlitePath}`);
    process.exit(1);
  }
  
  let sqliteDb = null;
  let mysqlConn = null;
  
  try {
    // Connect to SQLite
    console.log('\n📂 Connecting to SQLite database...');
    sqliteDb = new Database(sqlitePath, { readonly: true });
    console.log('✅ SQLite connected');
    
    // Connect to MySQL (first try without database, then create it if needed)
    console.log('\n📂 Connecting to MySQL...');
    try {
      mysqlConn = await mysql.createConnection(mysqlConfig);
      console.log('✅ MySQL connected');
    } catch (error) {
      if (error.code === 'ER_BAD_DB_ERROR') {
        // Database doesn't exist, create it
        console.log(`📦 Database ${mysqlConfig.database} doesn't exist, creating it...`);
        const tempConfig = { ...mysqlConfig };
        delete tempConfig.database;
        const tempConn = await mysql.createConnection(tempConfig);
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await tempConn.end();
        
        // Now connect to the new database
        mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('✅ MySQL database created and connected');
      } else {
        throw error;
      }
    }
    
    // Ensure we're using the correct database
    await mysqlConn.query(`USE \`${mysqlConfig.database}\``);
    
    // STEP 1: Create all tables first
    await createAllTables(mysqlConn);
    
    // STEP 2: Verify earn_opportunities table exists before migration
    const [checkTables] = await mysqlConn.query("SHOW TABLES LIKE 'earn_opportunities'");
    if (checkTables.length === 0) {
      throw new Error('earn_opportunities table was not created!');
    }
    console.log('\n✅ Verified earn_opportunities table exists');
    
    // STEP 3: Get table list from SQLite
    const sqliteTables = sqliteDb.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map(row => row.name);
    
    console.log(`\n📊 Found ${sqliteTables.length} tables in SQLite database`);
    
    // STEP 4: Migrate tables in order
    let totalRows = 0;
    for (const tableName of tableOrder) {
      if (sqliteTables.includes(tableName)) {
        const rows = await migrateTable(sqliteDb, mysqlConn, tableName);
        totalRows += rows;
      } else {
        console.log(`\n⚠️  Table ${tableName} not found in SQLite, skipping...`);
      }
    }
    
    // Migrate any additional tables not in the ordered list
    for (const tableName of sqliteTables) {
      if (!tableOrder.includes(tableName)) {
        console.log(`\n⚠️  Migrating additional table: ${tableName}`);
        const rows = await migrateTable(sqliteDb, mysqlConn, tableName);
        totalRows += rows;
      }
    }
    
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   Total rows migrated: ${totalRows}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Verify data in MySQL database`);
    console.log(`   2. Test the application with MySQL`);
    console.log(`   3. Backup SQLite database before removing it`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Close connections
    if (sqliteDb) {
      sqliteDb.close();
      console.log('\n🔌 SQLite connection closed');
    }
    if (mysqlConn) {
      await mysqlConn.end();
      console.log('🔌 MySQL connection closed');
    }
  }
}

// Run migration
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { migrateTable, main };
