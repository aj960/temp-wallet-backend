require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../src/db/index');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function clearAdmins() {
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

    // Get current admin count
    const countResult = await db.prepare('SELECT COUNT(*) as count FROM admins').get();
    const adminCount = countResult ? countResult.count : 0;

    if (adminCount === 0) {
      console.log('ℹ️  Admin table is already empty. No records to delete.');
      rl.close();
      process.exit(0);
    }

    // Show current admins
    console.log(`📋 Found ${adminCount} admin record(s) in the table:\n`);
    const admins = await db.prepare('SELECT id, name, email, role FROM admins ORDER BY id ASC').all();
    
    admins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ID: ${admin.id} | Email: ${admin.email} | Name: ${admin.name} | Role: ${admin.role}`);
    });

    console.log('\n⚠️  WARNING: This will DELETE ALL admin records from the database!');
    console.log('⚠️  This action cannot be undone!\n');

    // Ask for confirmation
    const answer = await askQuestion('Are you sure you want to delete all admin records? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('\n❌ Operation cancelled. No records were deleted.');
      rl.close();
      process.exit(0);
    }

    // Double confirmation
    const confirm = await askQuestion('Type "DELETE ALL" to confirm: ');
    
    if (confirm !== 'DELETE ALL') {
      console.log('\n❌ Confirmation failed. No records were deleted.');
      rl.close();
      process.exit(0);
    }

    console.log('\n🗑️  Deleting all admin records...');

    // Delete all admins
    const deleteResult = await db.prepare('DELETE FROM admins').run();

    console.log(`\n✅ Successfully deleted ${deleteResult.changes} admin record(s) from the table.`);
    console.log('✅ Admin table is now empty.\n');

    // Verify deletion
    const verifyCount = await db.prepare('SELECT COUNT(*) as count FROM admins').get();
    if (verifyCount.count === 0) {
      console.log('✅ Verification: Admin table is confirmed empty.');
    } else {
      console.log(`⚠️  Warning: Expected 0 records, but found ${verifyCount.count} record(s).`);
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error clearing admins:', error.message);
    console.error('   Stack:', error.stack);
    rl.close();
    process.exit(1);
  }
}

// Run the script
clearAdmins();

