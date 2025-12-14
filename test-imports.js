//console.log('Testing module resolution...');
try {
  const repos = require('./src/repositories');
  //console.log('✅ Success! Repositories loaded:', Object.keys(repos));
  //console.log('walletRepository type:', typeof repos.walletRepository);
  //console.log('transactionRepository type:', typeof repos.transactionRepository);
} catch (err) {
  //console.log('❌ Error:', err.message);
  //console.log('Stack:', err.stack);
}
