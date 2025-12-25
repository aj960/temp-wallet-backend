require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/db/index'); // ✅ Use centralized database
const authService = require('../src/security/auth.service');

async function initializeDefaultAdmin() {
  try {
    // Wait for database to be ready
    await db.waitForReady();

    // Check if admin table exists
    try {
      const tableCheck = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = 'admins'
      `).get();
      
      if (!tableCheck || tableCheck.count === 0) {
        console.log('⚠️  Admins table does not exist yet. It will be created on first use.');
        return { error: 'Admins table does not exist' };
      }
    } catch (e) {
      console.error('❌ Error checking admins table:', e.message);
      return { error: e.message };
    }

    // Check if admin table is blank (count = 0)
    const countResult = await db.prepare('SELECT COUNT(*) as count FROM admins').get();
    const adminCount = countResult ? countResult.count : 0;

    // If table is not blank, check if the specific admin exists
    if (adminCount > 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@wallet.local';
      const existingAdmin = await db.prepare('SELECT * FROM admins WHERE email = ?').get(adminEmail);
      
      if (existingAdmin) {
        console.log(`✅ Admin account already exists: ${adminEmail}`);
        return { exists: true, email: adminEmail };
      }
      
      // Table has admins but not the one from .env
      console.log(`ℹ️  Admin table has ${adminCount} admin(s), but not the one from .env`);
      return { exists: true, email: adminEmail };
    }

    // Table is blank - create initial admin from .env
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@wallet.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisSecurePassword123!@#';
    const adminName = process.env.ADMIN_NAME || 'Default Admin';
    const adminRole = process.env.ADMIN_ROLE || 'superadmin';

    if (!adminEmail || !adminPassword) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
      return { error: 'ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file' };
    }

    console.log('🔧 Creating initial admin account from .env...');
    
    // Hash password
    const hashedPassword = await authService.hashPassword(adminPassword);
    
    // Insert admin
    const stmt = db.prepare(
      'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)'
    );
    
    const info = await stmt.run(adminName, adminEmail, hashedPassword, adminRole);

    console.log('✅ Initial admin created successfully!');
    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║          INITIAL ADMIN CREDENTIALS             ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Email:    ${adminEmail.padEnd(38)}║`);
    console.log(`║  Password: ${adminPassword.substring(0, 20).padEnd(38)}║`);
    console.log(`║  Role:     ${adminRole.padEnd(38)}║`);
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');
    console.log('⚠️  SECURITY WARNING: Change this password immediately!');
    console.log('📝 Use POST /admin/login to authenticate');
    console.log('');

    return { 
      created: true, 
      id: info.lastInsertRowid,
      email: adminEmail
    };

  } catch (error) {
    console.error('❌ Error initializing default admin:', error.message);
    console.error('   Stack:', error.stack);
    return { error: error.message };
  }
}

// If run directly (not imported)
if (require.main === module) {
  initializeDefaultAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initializeDefaultAdmin;