require('dotenv').config();

// Initialize database connection first
const db = require('./db/index');

// Wait for database to be ready before starting server
(async () => {
  try {
    // Ensure database is initialized
    await db.waitForReady();
    console.log('✅ Database ready');
    
    // Now start the server
    const app = require('./app');
    const PORT = process.env.PORT || 8083;
    const HOST = process.env.HOST || '0.0.0.0';

    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      console.log(`📊 Database: MySQL (${process.env.DB_NAME || 'wallet_db'})`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
