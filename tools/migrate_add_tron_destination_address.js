/**
 * Migration Script: Add tron_destination_address column
 * 
 * This script adds the tron_destination_address column to the wallet_balance_monitor_config table.
 * 
 * Usage:
 *   node scripts/migrate_add_tron_destination_address.js
 * 
 * Environment Variables:
 *   DB_HOST - MySQL host (default: localhost)
 *   DB_USER - MySQL user (default: app_user)
 *   DB_PASSWORD - MySQL password (default: qwe123QWE!@#)
 *   DB_NAME - MySQL database name (default: wallet_db)
 */

require('dotenv').config();

const mysql = require('mysql2/promise');

const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'qwe123QWE!@#',
  database: process.env.DB_NAME || 'wallet_db'
};

async function addTronDestinationAddressColumn() {
  let connection = null;
  
  try {
    console.log('🔌 Connecting to MySQL...');
    connection = await mysql.createConnection(mysqlConfig);
    console.log('✅ Connected to MySQL');
    
    // Check if column already exists
    console.log('\n🔍 Checking if tron_destination_address column exists...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'wallet_balance_monitor_config' 
      AND COLUMN_NAME = 'tron_destination_address'
    `, [mysqlConfig.database]);
    
    if (columns.length > 0) {
      console.log('✅ Column tron_destination_address already exists. Skipping migration.');
      return;
    }
    
    // Add the column
    console.log('\n📦 Adding tron_destination_address column...');
    await connection.query(`
      ALTER TABLE wallet_balance_monitor_config 
      ADD COLUMN tron_destination_address VARCHAR(255) DEFAULT 'TXLhw9KrPZCfVxRwCAR6geEBhfnUW4r55b' 
      AFTER btc_destination_address
    `);
    console.log('✅ Column tron_destination_address added successfully!');
    
    // Update existing row if it exists (set default value)
    console.log('\n🔄 Updating existing configuration...');
    const [rows] = await connection.query(`
      SELECT id FROM wallet_balance_monitor_config WHERE id = 1
    `);
    
    if (rows.length > 0) {
      // Row exists, update it with default value if tron_destination_address is NULL
      await connection.query(`
        UPDATE wallet_balance_monitor_config 
        SET tron_destination_address = 'TXLhw9KrPZCfVxRwCAR6geEBhfnUW4r55b'
        WHERE id = 1 AND tron_destination_address IS NULL
      `);
      console.log('✅ Existing configuration updated with default tron_destination_address');
    } else {
      console.log('ℹ️  No existing configuration found. Default value will be used when config is created.');
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('⚠️  Column already exists. This is safe to ignore.');
    } else {
      console.error('Error details:', error);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connection closed');
    }
  }
}

if (require.main === module) {
  addTronDestinationAddressColumn().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { addTronDestinationAddressColumn };

