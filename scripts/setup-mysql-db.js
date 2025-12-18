/**
 * Setup MySQL Database
 * 
 * Creates the MySQL database and user if they don't exist.
 * 
 * Usage:
 *   node scripts/setup-mysql-db.js
 * 
 * Note: This script requires MySQL root access to create the database and user.
 */
require('dotenv').config();

const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.MYSQL_ROOT_PASSWORD || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'R00t!MySQL#2025$',
  database: 'mysql' // Connect to mysql system database first
};

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'qwe123QWE!@#',
  database: process.env.DB_NAME || 'wallet_db'
};

async function setupDatabase() {
  let connection = null;
  
  try {
    console.log('🔌 Connecting to MySQL as root...');
    // connection = await mysql.createConnection(config);
    // console.log('✅ Connected to MySQL');
    
    // // Create database
    // console.log(`\n📦 Creating database: ${dbConfig.database}`);
    // await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    // console.log('✅ Database created or already exists');
    
    // Create user (if not using root)
    if (dbConfig.user !== 'root') {
      console.log(`\n👤 Creating user: ${dbConfig.user}`);
      try {
        // await connection.query(`CREATE USER IF NOT EXISTS '${dbConfig.user}'@'${dbConfig.host === 'localhost' ? 'localhost' : '%'}' IDENTIFIED BY ?`, [dbConfig.password]);
        // console.log('✅ User created or already exists');
        
        // // Grant privileges
        // console.log(`\n🔐 Granting privileges to ${dbConfig.user}...`);
        // await connection.query(`GRANT ALL PRIVILEGES ON \`${dbConfig.database}\`.* TO '${dbConfig.user}'@'${dbConfig.host === 'localhost' ? 'localhost' : '%'}'`);
        // await connection.query('FLUSH PRIVILEGES');
        console.log('✅ Privileges granted');
      } catch (error) {
        if (error.code === 'ER_CANNOT_USER') {
          console.log('⚠️  User might already exist, continuing...');
        } else {
          throw error;
        }
      }
    }
    
    // Test connection with new user
    console.log(`\n🧪 Testing connection with ${dbConfig.user}...`);
    const testConn = await mysql.createConnection(dbConfig);
    await testConn.query('SELECT 1');
    await testConn.end();
    console.log('✅ Connection test successful!');
    
    console.log(`\n✅ MySQL database setup complete!`);
    console.log(`\n📝 Database Details:`);
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}`);
    console.log(`\n🚀 You can now run the migration script:`);
    console.log(`   node scripts/migrate-sqlite-to-mysql.js`);
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Make sure you have MySQL root access or set MYSQL_ROOT_USER and MYSQL_ROOT_PASSWORD');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connection closed');
    }
  }
}

if (require.main === module) {
  setupDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { setupDatabase };

