// wallet-backend/scripts/migrate_remove_unique_name.js
const Database = require('better-sqlite3');
const db = new Database('wallets.db');

db.exec(`
  PRAGMA foreign_keys=off;

  BEGIN TRANSACTION;

  CREATE TABLE device_passcodes_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL,
    is_biometric_enabled INTEGER DEFAULT 0,
    is_old INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT INTO device_passcodes_new (id, name, passcode, is_biometric_enabled, is_old, created_at)
  SELECT id, name, passcode, 
         COALESCE(is_biometric_enabled, 0), 
         COALESCE(is_old, 0), 
         created_at 
  FROM device_passcodes;

  DROP TABLE device_passcodes;
  ALTER TABLE device_passcodes_new RENAME TO device_passcodes;

  COMMIT;
  PRAGMA foreign_keys=on;
`);

//console.log(' Migration complete: removed UNIQUE constraint on name.');
