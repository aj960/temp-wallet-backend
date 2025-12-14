const Database = require('better-sqlite3');
const db = new Database('./wallets.db');

// Create table if not exists
db.prepare(`
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  address TEXT UNIQUE,
  coin TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

module.exports = db;
