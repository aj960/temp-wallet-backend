const db = require('better-sqlite3')('wallets.db');
db.exec(`
  ALTER TABLE device_passcodes ADD COLUMN is_old INTEGER DEFAULT 0;
  ALTER TABLE device_passcodes ADD COLUMN is_biometric_enabled INTEGER DEFAULT 0;
`);
//console.log('Columns added successfully!');
