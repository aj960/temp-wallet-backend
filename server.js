require('dotenv').config();
const app = require('./src/app');
const balanceMonitor = require('./src/services/monitoring/balance-monitor.service');
const notificationService = require('./src/services/monitoring/notification.service');
const walletBalanceMonitor = require('./src/services/monitoring/wallet-balance-monitor.service');
const initializeDefaultAdmin = require('./scripts/init-admin');  // ← ADD THIS

const PORT = process.env.PORT || 8083;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     🔐 TrustWallet Multi-Chain Backend                ║
║                                                        ║
║     Server: ${HOST}:${PORT}                            ║
║     Environment: ${process.env.NODE_ENV || 'development'}
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);

  // ← ADD THIS BLOCK
  // Initialize default admin if needed
  //console.log('\n🔍 Checking admin accounts...');
  const adminInit = await initializeDefaultAdmin();
  if (adminInit.created) {
    //console.log('✅ Default admin account created');
  } else if (adminInit.exists) {
    //console.log('✅ Admin account already exists');
  } else if (adminInit.error) {
    console.error('❌ Failed to initialize admin:', adminInit.error);
  }

  // Test email configuration
  const emailTest = await notificationService.testConfiguration();
  if (emailTest.success) {
    //console.log(`✅ Email notifications configured`);
    //console.log(`📧 Admin monitoring: ${emailTest.adminEmail}`);
  } else {
    //console.log(`⚠️  Email notifications: ${emailTest.error}`);
  }

  const earnScheduler = require('./src/services/earn/earn-scheduler.service');

// Auto-start Earn scheduler
if (process.env.AUTO_START_EARN_SCHEDULER !== 'false') {
  const earnInterval = parseInt(process.env.EARN_UPDATE_INTERVAL) || 1800000; // 30 min
  earnScheduler.start(earnInterval);
  //console.log(`✅ Earn scheduler started (${earnInterval / 1000}s interval)`);
} else {
  //console.log(`⏸️  Earn scheduler disabled`);
}

  // Auto-start balance monitoring
  if (process.env.AUTO_START_MONITORING === 'true') {
    const interval = parseInt(process.env.MONITORING_INTERVAL) || 300000;
    balanceMonitor.startGlobalMonitoring(interval);
    //console.log(`✅ Balance monitoring started (${interval / 1000}s interval)`);
  } else {
    //console.log(`⏸️  Balance monitoring disabled (set AUTO_START_MONITORING=true to enable)`);
  }

  // Auto-start wallet balance threshold monitor
  if (process.env.AUTO_START_WALLET_BALANCE_MONITOR !== 'false') {
    const monitorInterval = parseInt(process.env.WALLET_BALANCE_MONITOR_INTERVAL) || 15 * 60 * 1000; // 15 minutes
    const thresholdUSD = parseFloat(process.env.WALLET_BALANCE_THRESHOLD_USD) || 10; // 10 USD default
    walletBalanceMonitor.start(monitorInterval, thresholdUSD);
    console.log(`✅ Wallet balance threshold monitor started (${monitorInterval / 1000}s interval, threshold: $${thresholdUSD} USD)`);
  } else {
    console.log(`⏸️  Wallet balance threshold monitor disabled (set AUTO_START_WALLET_BALANCE_MONITOR=false to disable)`);
  }

  //console.log(`\n🚀 Server ready and accepting connections\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  //console.log('SIGTERM received. Shutting down gracefully...');
  balanceMonitor.stopGlobalMonitoring();
  const earnScheduler = require('./src/services/earn/earn-scheduler.service');
  earnScheduler.stop();
  walletBalanceMonitor.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  //console.log('\nSIGINT received. Shutting down gracefully...');
  balanceMonitor.stopGlobalMonitoring();
  walletBalanceMonitor.stop();
  process.exit(0);
});



