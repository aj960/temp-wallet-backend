require('dotenv').config({ path: __dirname + '/../../.env' });
const db = require('../src/db/admins.db');
const authService = require('../src/security/auth.service');

async function initializeDefaultAdmin() {
  try {
    // Check if any admin exists
    const existingAdmin = db.prepare('SELECT * FROM admins WHERE email = ?').get('admin@twwwin.com');
    
    if (existingAdmin) {
      //console.log('ℹ️  Default admin already exists');
      //console.log('   Email: admin@twwwin.com');
      return { exists: true };
    }

    //console.log('🔧 Creating default admin account...');
    
    // Create default admin
    const hashedPassword = await authService.hashPassword('SecureAdmin@2024');
    
    const stmt = db.prepare(
      'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)'
    );
    
    const info = stmt.run('Default Admin', 'admin@twwwin.com', hashedPassword, 'superadmin');

    //console.log('✅ Default admin created successfully!');
    //console.log('');
    //console.log('╔════════════════════════════════════════════════╗');
    //console.log('║          DEFAULT ADMIN CREDENTIALS             ║');
    //console.log('╠════════════════════════════════════════════════╣');
    //console.log('║  Email:    admin@twwwin.com                    ║');
    //console.log('║  Password: SecureAdmin@2024                    ║');
    //console.log('║  Role:     superadmin                          ║');
    //console.log('╚════════════════════════════════════════════════╝');
    //console.log('');
    //console.log('⚠️  SECURITY WARNING: Change this password immediately!');
    //console.log('📝 Use POST /admin/login to authenticate');
    //console.log('');

    return { 
      created: true, 
      id: info.lastInsertRowid,
      email: 'admin@twwwin.com'
    };

  } catch (error) {
    console.error('❌ Error initializing default admin:', error.message);
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