require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/db/index');

async function viewAdmins() {
  try {
    console.log('🔄 Connecting to database...');
    await db.waitForReady();
    console.log('✅ Database connected\n');

    // Check if table exists
    try {
      const tableCheck = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = 'admins'
      `).get();
      
      if (!tableCheck || tableCheck.count === 0) {
        console.log('❌ Admins table does not exist!');
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Error checking admins table:', e.message);
      process.exit(1);
    }

    // Get all admins
    console.log('📋 Fetching all admin records...\n');
    const admins = await db.prepare('SELECT * FROM admins ORDER BY id ASC').all();

    if (admins.length === 0) {
      console.log('⚠️  No admin records found in the table.');
      process.exit(0);
    }

    // Display results
    console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                    ADMIN TABLE RECORDS                                                  ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Records: ${admins.length.toString().padEnd(95)}║`);
    console.log('╠════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
    console.log('');

    admins.forEach((admin, index) => {
      console.log(`📌 Admin #${index + 1}`);
      console.log('─'.repeat(110));
      console.log(`   ID:          ${admin.id || 'N/A'}`);
      console.log(`   Name:        ${admin.name || 'N/A'}`);
      console.log(`   Email:       ${admin.email || 'N/A'}`);
      console.log(`   Password:    ${admin.password || 'N/A'}`);
      console.log(`   Role:        ${admin.role || 'N/A'}`);
      console.log(`   Created At:  ${admin.created_at || admin.createdAt || 'N/A'}`);
      console.log('');
    });

    console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                    END OF RECORDS                                                      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════════╝');

    // Also display as JSON for easy copying
    console.log('\n📄 JSON Format:');
    console.log(JSON.stringify(admins, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error viewing admins:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
viewAdmins();

