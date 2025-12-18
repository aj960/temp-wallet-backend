/**
 * MySQL Wrapper - Compatible with better-sqlite3 API
 * This allows existing code to work with minimal changes
 */

const mysql = require("mysql2/promise");

class MySQLWrapper {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.connection = null;
    this.ready = false;
    this.initPromise = null;
    this.pendingOperations = [];
  }

  async _init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const maxRetries = 5;
      const retryDelay = 3000; // 3 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(
            `🔄 Attempting MySQL connection (${attempt}/${maxRetries})...`
          );
          console.log(`   Host: ${this.config.host || "localhost"}`);
          console.log(`   Database: ${this.config.database || "wallet_db"}`);

          // Create connection pool with timeout settings
          this.pool = mysql.createPool({
            host: this.config.host || "localhost",
            user: this.config.user || "app_user",
            password: this.config.password || "",
            database: this.config.database || "wallet_db",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            connectTimeout: 10000, // 10 seconds
            acquireTimeout: 10000, // 10 seconds
            timeout: 10000, // 10 seconds
          });

          // Create a single connection for synchronous-like operations
          this.connection = await mysql.createConnection({
            host: this.config.host || "localhost",
            user: this.config.user || "app_user",
            password: this.config.password || "",
            database: this.config.database || "wallet_db",
            multipleStatements: true,
            connectTimeout: 10000, // 10 seconds
          });

          // Test the connection
          await this.connection.query("SELECT 1");

          // Enable foreign keys
          await this.connection.query("SET FOREIGN_KEY_CHECKS = 1");

          this.ready = true;
          console.log("✅ MySQL connected successfully");
          return this;
        } catch (error) {
          console.error(
            `❌ MySQL connection error (attempt ${attempt}/${maxRetries}):`,
            error.message
          );

          if (attempt < maxRetries) {
            console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          } else {
            console.error("❌ Failed to connect to MySQL after all retries");
            console.error("   Please check:");
            console.error(
              `   1. DB_HOST is correct (current: ${
                this.config.host || "localhost"
              })`
            );
            console.error("   2. MySQL service is running and accessible");
            console.error("   3. Network connectivity between pods/services");
            console.error("   4. Database credentials are correct");
            throw error;
          }
        }
      }
    })();

    return this.initPromise;
  }

  // Ensure connection is ready before executing
  async _ensureReady() {
    if (!this.ready) {
      await this._init();
    }
  }

  // Mimic better-sqlite3's exec method (synchronous-style, but async internally)
  async exec(sql) {
    // Convert SQLite-specific syntax to MySQL
    let mysqlSql = this.convertSQLiteToMySQL(sql);

    await this._ensureReady();

    try {
      // Split multiple statements if needed
      const statements = mysqlSql.split(";").filter((s) => s.trim().length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          await this.connection.query(statement);
        }
      }
    } catch (error) {
      // Ignore "table already exists" and "duplicate column" errors
      if (
        error.code === "ER_TABLE_EXISTS_ERROR" ||
        error.code === "ER_DUP_FIELDNAME" ||
        error.code === "ER_DUP_KEYNAME" ||
        error.message.includes("Duplicate column name") ||
        error.message.includes("Duplicate entry") ||
        error.message.includes("Duplicate key name")
      ) {
        // Silently ignore
        return;
      } else {
        console.error("SQL Error:", error.message);
        console.error("SQL:", mysqlSql.substring(0, 200));
        throw error;
      }
    }
  }

  // Mimic better-sqlite3's prepare method
  prepare(sql) {
    let mysqlSql = this.convertSQLiteToMySQL(sql);

    return {
      run: async (...params) => {
        await this._ensureReady();
        try {
          const [results] = await this.connection.query(mysqlSql, params);
          return {
            changes: results.affectedRows || 0,
            lastInsertRowid: results.insertId || 0,
          };
        } catch (error) {
          // Ignore duplicate key errors for INSERT IGNORE
          if (
            error.code === "ER_DUP_ENTRY" &&
            mysqlSql.toUpperCase().includes("INSERT IGNORE")
          ) {
            return { changes: 0, lastInsertRowid: 0 };
          }
          throw error;
        }
      },
      get: async (...params) => {
        await this._ensureReady();
        try {
          const [results] = await this.connection.query(mysqlSql, params);
          return results[0] || null;
        } catch (error) {
          throw error;
        }
      },
      all: async (...params) => {
        await this._ensureReady();
        try {
          const [results] = await this.connection.query(mysqlSql, params);
          return results || [];
        } catch (error) {
          throw error;
        }
      },
    };
  }

  // Convert SQLite SQL to MySQL SQL
  convertSQLiteToMySQL(sql) {
    let mysqlSql = sql;

    // Remove SQLite-specific pragmas first (already handled in connect)
    mysqlSql = mysqlSql.replace(/PRAGMA\s+[^;]+;/gi, "");

    // Convert data types - order matters!
    // Only convert if not already MySQL-compatible (don't convert VARCHAR to TEXT)
    mysqlSql = mysqlSql.replace(
      /\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi,
      "INT AUTO_INCREMENT PRIMARY KEY"
    );
    mysqlSql = mysqlSql.replace(
      /\bINTEGER\s+PRIMARY\s+KEY\b/gi,
      "INT PRIMARY KEY"
    );
    mysqlSql = mysqlSql.replace(/\bINTEGER\b/gi, "INT");
    // Only convert TEXT if it's not part of VARCHAR - preserve VARCHAR columns
    // Don't convert TEXT that's already in MySQL format (no conversion needed)
    mysqlSql = mysqlSql.replace(/\bREAL\b/gi, "DECIMAL(20, 8)");

    // Convert datetime functions
    mysqlSql = mysqlSql.replace(
      /datetime\s*\(\s*['"]now['"]\s*\)/gi,
      "CURRENT_TIMESTAMP"
    );
    mysqlSql = mysqlSql.replace(
      /DEFAULT\s+\(datetime\s*\(\s*['"]now['"]\s*\)\)/gi,
      "DEFAULT CURRENT_TIMESTAMP"
    );

    // Convert INSERT OR IGNORE to INSERT IGNORE
    mysqlSql = mysqlSql.replace(/\bINSERT\s+OR\s+IGNORE\b/gi, "INSERT IGNORE");

    // Convert AUTOINCREMENT to AUTO_INCREMENT (standalone, not in PRIMARY KEY)
    mysqlSql = mysqlSql.replace(/\bAUTOINCREMENT\b/gi, "AUTO_INCREMENT");

    // Convert CHECK constraints - MySQL 8.0+ supports CHECK
    // Keep as is for MySQL 8.0+, but ensure syntax is valid

    // Handle TEXT PRIMARY KEY (SQLite allows TEXT as PK, MySQL needs VARCHAR or keep TEXT)
    // MySQL TEXT can be PRIMARY KEY but it's better to use VARCHAR for fixed-length keys
    // For now, keep TEXT as is since it works in MySQL

    // Convert IF NOT EXISTS syntax (MySQL supports it)
    // Keep as is

    return mysqlSql;
  }

  // Mimic pragma (no-op for MySQL, but keep for compatibility)
  pragma(setting) {
    // MySQL doesn't use pragmas, but we handle common ones
    if (setting.includes("foreign_keys")) {
      // Already handled in connect()
      return;
    }
    if (setting.includes("journal_mode")) {
      // MySQL uses InnoDB by default, no equivalent
      return;
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
    }
    if (this.pool) {
      await this.pool.end();
    }
  }

  // Helper method to wait for initialization (for synchronous-style code)
  async waitForReady() {
    await this._ensureReady();
  }
}

module.exports = MySQLWrapper;
