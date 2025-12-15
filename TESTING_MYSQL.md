# Testing the Application with MySQL

## Prerequisites

1. ✅ **MySQL is running** on localhost
2. ✅ **Database created**: `wallet_db`
3. ✅ **User configured**: `app_user` with password `qwe123QWE!@#`
4. ✅ **Data migrated** from SQLite to MySQL

## Environment Variables

Make sure your `.env` file (or environment) has these variables set (optional, defaults are provided):

```bash
DB_HOST=localhost
DB_USER=app_user
DB_PASSWORD=qwe123QWE!@#
DB_NAME=wallet_db
```

## Starting the Application

1. **Start the server:**
   ```bash
   npm start
   # or
   node src/server.js
   ```

2. **Check the console output** - You should see:
   - `✅ MySQL connected successfully`
   - `✅ MySQL database initialized successfully`
   - `Server running on 0.0.0.0:8083`

## Testing Checklist

### 1. Health Check
```bash
curl http://localhost:8083/health
```
Should return status 200 with server info.

### 2. Database Connection Test
Check the console logs when the app starts - you should see MySQL connection messages.

### 3. Test Admin Login
```bash
curl -X POST http://localhost:8083/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin@email.com","password":"your-password"}'
```

### 4. Test Wallet Operations
```bash
# Create a wallet
curl -X POST http://localhost:8083/multichain/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Wallet","devicePassCodeId":"test-id"}'
```

### 5. Test Database Queries
All database operations should work as before, but now using MySQL instead of SQLite.

## Common Issues

### Issue: "MySQL connection error"
**Solution:** 
- Verify MySQL is running: `systemctl status mysql`
- Check credentials in `.env` or use defaults
- Ensure database exists: `mysql -u app_user -p -e "USE wallet_db;"`

### Issue: "Table doesn't exist"
**Solution:**
- Run the migration script again: `node scripts/migrate-sqlite-to-mysql.js`
- Or restart the app (tables are created on startup)

### Issue: "Async/await errors"
**Solution:**
- All database calls should use `await`
- Make sure functions are marked as `async`
- Check console for specific error messages

### Issue: "Foreign key constraint fails"
**Solution:**
- Ensure data was migrated in the correct order
- Check that referenced records exist in parent tables

## Verification

1. **Check MySQL tables:**
   ```bash
   mysql -u app_user -p wallet_db -e "SHOW TABLES;"
   ```

2. **Verify data:**
   ```bash
   mysql -u app_user -p wallet_db -e "SELECT COUNT(*) FROM wallets;"
   mysql -u app_user -p wallet_db -e "SELECT COUNT(*) FROM admins;"
   ```

3. **Check application logs** for any errors

## Rollback (if needed)

If you need to rollback to SQLite:
1. Restore `src/db/index.js` from git history
2. Restart the application
3. SQLite database file should still be in `data/wallets.db`

## Performance Notes

- MySQL should perform better than SQLite for concurrent operations
- Connection pooling is enabled (10 connections)
- All queries are now async, which is better for Node.js

## Next Steps

1. Monitor application logs for any errors
2. Test all major features (wallet creation, transactions, etc.)
3. Verify data integrity
4. Consider setting up MySQL backups

