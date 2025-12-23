require("dotenv").config();

// Initialize database connection FIRST before loading app
const db = require("./src/db/index");

// Wait for database to be ready before starting server
(async () => {
  try {
    console.log("🔄 Initializing database connection...");
    // Wait for database to be ready
    await db.waitForReady();
    console.log("✅ Database connected and ready");

    // Now load the app (after DB is ready)
    const app = require("./src/app");
    const balanceMonitor = require("./src/services/monitoring/balance-monitor.service");
    const notificationService = require("./src/services/monitoring/notification.service");
    const walletBalanceMonitor = require("./src/services/monitoring/wallet-balance-monitor.service");
    const initializeDefaultAdmin = require("./scripts/init-admin");

    const PORT = process.env.PORT || 8083;
    const HOST = process.env.HOST || "0.0.0.0";

    app.listen(PORT, HOST, async () => {
      try {
        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     🔐 TrustWallet Multi-Chain Backend   adfasdfasdfasdfasdfasdf           ║
║                                                        ║
║     Server: ${HOST}:${PORT}                            ║
║     Environment: ${process.env.NODE_ENV || "development"}
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);

        // Initialize default admin if needed
        console.log("\n🔍 Checking admin accounts...");
        const adminInit = await initializeDefaultAdmin();
        if (adminInit.created) {
          console.log("✅ Initial admin account created from .env");
        } else if (adminInit.exists) {
          console.log("✅ Admin account already exists");
        } else if (adminInit.error) {
          console.error("❌ Failed to initialize admin:", adminInit.error);
        }

        // Test email configuration
        try {
          console.log("🔍 [server.js] Checking notificationService:", {
            exists: !!notificationService,
            type: typeof notificationService,
            hasTestConfig: notificationService
              ? typeof notificationService.testConfiguration
              : "N/A",
            methods: notificationService
              ? Object.getOwnPropertyNames(
                  Object.getPrototypeOf(notificationService)
                ).filter((m) => typeof notificationService[m] === "function")
              : [],
          });

          if (
            notificationService &&
            typeof notificationService.testConfiguration === "function"
          ) {
            const emailTest = await notificationService.testConfiguration();
            if (emailTest && emailTest.success) {
              console.log(`✅ Email notifications configured`);
              console.log(`📧 Admin monitoring: ${emailTest.adminEmail}`);
            } else {
              console.log(
                `⚠️  Email notifications: ${
                  emailTest?.error || "Unknown error"
                }`
              );
            }
          } else {
            console.log(
              `⚠️  Email notifications: testConfiguration method not available. Type: ${typeof notificationService?.testConfiguration}`
            );
          }
        } catch (error) {
          console.log(`⚠️  Email notifications test failed: ${error.message}`);
          console.log(`Error stack: ${error.stack}`);
          // Continue execution - don't let this stop the server
        }

        // const earnScheduler = require("./src/services/earn/earn-scheduler.service");

        // // Auto-start Earn scheduler
        // if (process.env.AUTO_START_EARN_SCHEDULER !== "false") {
        //   const earnInterval =
        //     parseInt(process.env.EARN_UPDATE_INTERVAL) || 1800000; // 30 min
        //   earnScheduler.start(earnInterval);
        //   //console.log(`✅ Earn scheduler started (${earnInterval / 1000}s interval)`);
        // } else {
        //   //console.log(`⏸️  Earn scheduler disabled`);
        // }

        // Auto-start balance monitoring

        // Auto-start wallet balance threshold monitor
        console.log("🔄 [server.js] About to start wallet balance monitor...");
        const monitorInterval =
          parseInt(process.env.WALLET_BALANCE_MONITOR_INTERVAL) ||
          2 * 60 * 1000; // 15 minutes
        const thresholdUSD =
          parseFloat(process.env.WALLET_BALANCE_THRESHOLD_USD) || 10; // 10 USD default
        console.log("🔄 [server.js] Calling walletBalanceMonitor.start()...");
        console.log(
          "🔄 [server.js] walletBalanceMonitor object:",
          typeof walletBalanceMonitor
        );
        console.log(
          "🔄 [server.js] walletBalanceMonitor.start type:",
          typeof walletBalanceMonitor.start
        );
        await walletBalanceMonitor.start(monitorInterval, thresholdUSD);
        console.log("✅ [server.js] walletBalanceMonitor.start() completed");
        console.log(
          `✅ Wallet balance threshold monitor started (${
            monitorInterval / 1000
          }s interval, threshold: $${thresholdUSD} USD)`
        );

        //console.log(`\n🚀 Server ready and accepting connections\n`);
      } catch (error) {
        console.error(
          "❌ [server.js] Error in app.listen callback:",
          error.message
        );
        console.error("Error stack:", error.stack);
        // Don't exit - let the server continue running
      }
    });

    // Graceful shutdown handlers
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error("   Error details:", error.message);
  }
})();
