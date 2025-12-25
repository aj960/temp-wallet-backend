# SQLite to MySQL Migration Guide

This document describes the migration from SQLite to MySQL and important changes you need to be aware of.

## Overview

The database has been migrated from SQLite to MySQL. The MySQL wrapper (`src/db/mysql-wrapper.js`) provides a compatible API that mimics `better-sqlite3`, but **all database operations are now asynchronous**.

## Important Changes

### 1. Async/Await Required

All database operations now return Promises and must be used with `await`:

**Before (SQLite - synchronous):**
```javascript
const wallet = db.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
db.prepare('INSERT INTO wallets (id, name) VALUES (?, ?)').run(id, name);
```

**After (MySQL - asynchronous):**
```javascript
const wallet = await db.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
await db.prepare('INSERT INTO wallets (id, name) VALUES (?, ?)').run(id, name);
```

### 2. Files That Need Updates

The following files use synchronous database calls and need to be updated to use `await`:

- `src/services/monitoring/wallet-balance-monitor.service.js`
- `src/services/monitoring/balance-monitor.service.js`
- `src/wallet/services/wallet.service.js`
- `src/controllers/admin.controller.js`
- `src/repositories/wallet.repository.js`
- `src/services/earn/earn-position.service.js`
- `src/services/earn/earn.service.js`
- `src/services/earn/trust-alpha.service.js`
- `src/wallet/models/wallet.model.js`
- `src/wallet/models/walletNetwork.model.js`
- `src/repositories/transaction.repository.js`
- `src/controllers/devicePasscodes.controller.js`
- `src/controllers/dapp.controller.js`
- `src/controllers/monitoring.controller.js`

### 3. Database Configuration

The MySQL connection uses the following environment variables (with defaults):

- `DB_HOST` (default: `localhost`)
- `DB_USER` (default: `app_user`)
- `DB_PASSWORD` (default: `qwe123QWE!@#`)
- `DB_NAME` (default: `wallet_db`)

### 4. Running the Migration

1. **Ensure MySQL is running** and the database exists:
   ```bash
   mysql -u app_user -p
   CREATE DATABASE IF NOT EXISTS wallet_db;
   ```

2. **Run the migration script**:
   ```bash
   node tools/migrate-sqlite-to-mysql.js
   ```

3. **Verify the migration**:
   - Check that all tables were created
   - Verify row counts match between SQLite and MySQL
   - Test the application

4. **Update code** to use `await` for all database operations

### 5. SQL Compatibility

The MySQL wrapper automatically converts SQLite-specific syntax to MySQL:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
- `datetime('now')` → `CURRENT_TIMESTAMP`
- `INSERT OR IGNORE` → `INSERT IGNORE`
- `TEXT` columns remain as `TEXT` (MySQL supports TEXT)

### 6. Indexes

MySQL requires prefix lengths for TEXT columns in indexes. The migration script handles this automatically.

## Testing

After migration, test the following:
1. User authentication
2. Wallet creation and management
3. Transaction recording
4. DApp functionality
5. Monitoring services

## Rollback

If you need to rollback to SQLite:
1. Restore the original `src/db/index.js` from version control
2. Restart the application
3. The SQLite database file should still be in `data/wallets.db`

## Notes

- The SQLite database file is preserved and not deleted during migration
- Foreign key constraints are enabled in MySQL
- All existing SQL queries should work without modification (just add `await`)
- The MySQL wrapper handles most SQLite-to-MySQL conversions automatically

