require("dotenv").config({ path: __dirname + "/../.env" });

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

// Security imports
const SecurityConfig = require("./config/security.config");
const rateLimiter = require("./security/rate-limiter.service");
const {
  sanitizeInputs,
  validateContentType,
  preventParamPollution,
} = require("./middleware/input-sanitizer.middleware");
const auditLogger = require("./security/audit-logger.service");

// Route imports
const adminRoutes = require("./routes/admin.routes");
const devicePasscodeRoutes = require("./routes/devicePasscodes.routes");
const multichainRoutes = require("./routes/multichain.routes");
const transactionRoutes = require("./routes/transaction.routes");
const backupRoutes = require("./routes/backup.routes");
const marketRoutes = require("./routes/market.routes");
const dappRoutes = require("./routes/dapp.routes");
const monitoringRoutes = require("./routes/monitoring.routes");

// Wallet routes
const walletRoutes = require("./wallet/routes/wallet.routes");
const accountRoutes = require("./wallet/routes/walletNetwork.routes");
const staticNetworkRouter = require("./wallet/routes/StaticNetworkProviderRoute");
const staticNetworkImagesRouter = require("./wallet/routes/StaticNetworkImagesProviderRoute");

const { swaggerUi, swaggerSpec, swaggerOptions } = require("./swagger");
const registerQuickNode = require("./integration/api/quicknode");
const registerZeroX = require("./integration/api/0x");
const logger = require("./middleware/logger");

const app = express();

// ==========================================
// 0. CORS FIRST (BEFORE EVERYTHING - ALLOW ALL ORIGINS)
// ==========================================
// Manual CORS handler to prevent duplicate headers from Kubernetes ingress
// IMPORTANT: Disable CORS in your Kubernetes ingress configuration!
// If ingress adds CORS headers, they will conflict with these.

app.use((req, res, next) => {
  // Remove any existing CORS headers first (in case ingress added them)
  const corsHeaderNames = [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Credentials",
    "Access-Control-Expose-Headers",
    "Access-Control-Max-Age",
  ];

  corsHeaderNames.forEach((header) => {
    try {
      res.removeHeader(header);
    } catch (e) {
      // Header might not exist, ignore
    }
  });

  // Get origin from request
  const origin = req.headers.origin;

  // Set CORS headers - allow all origins
  // Use origin if provided, otherwise allow all
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, X-Requested-With, Accept, Origin"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// ==========================================
// 1. BODY PARSING
// ==========================================
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// ==========================================
// 2. API DOCUMENTATION (BEFORE SECURITY MIDDLEWARE!)
// ==========================================
app.use("/api-docs", swaggerUi.serve);
app.get("/api-docs", swaggerUi.setup(swaggerSpec, swaggerOptions));

// ==========================================
// 3. SECURITY CONFIGURATION (CORS SKIPPED - ALREADY CONFIGURED ABOVE)
// ==========================================
// Skip CORS in SecurityConfig since we configured it above
// SecurityConfig.configureWithoutCORS(app);

// EARN FEATURE ROUTES (ADD THIS IMPORT)
// ==========================================
const earnRoutes = require("./routes/earn.routes");

// ==========================================
// REGISTER EARN ROUTES (ADD THIS IN THE ROUTES SECTION)
// ==========================================

// Earn feature
app.use("/earn", earnRoutes);

// ==========================================
// 4. INPUT SANITIZATION
// ==========================================
app.use(sanitizeInputs);
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    return validateContentType(req, res, next);
  }
  next();
});
app.use(preventParamPollution);

// ==========================================
// 5. LOGGING
// ==========================================
app.use(logger);

// ==========================================
// 6. RATE LIMITING
// ==========================================

// Apply specific rate limiters to sensitive routes
app.use("/admin/login", rateLimiter.authLimiter);
app.use("/admin/register", rateLimiter.authLimiter);
app.use("/device-passcodes/validate", rateLimiter.devicePasscodeLimiter);
app.use("/wallet/create", rateLimiter.walletCreationLimiter);
app.use("/multichain/wallet/create", rateLimiter.walletCreationLimiter);
app.use("/quicknode/tx", rateLimiter.transactionLimiter);
app.use("/0x/swap", rateLimiter.transactionLimiter);
app.use("/transactions/send", rateLimiter.transactionLimiter);

// ==========================================
// 7. HEALTH CHECK (no rate limit)
// ==========================================
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    features: {
      multichain: true,
      supportedChains: [
        "BTC",
        "ETH",
        "BSC",
        "POLYGON",
        "ARBITRUM",
        "OPTIMISM",
        "AVALANCHE",
        "FANTOM",
        "BASE",
        "SOL",
        "XRP",
        "ATOM",
        "TRX",
        "LTC",
        "DOGE",
      ],
    },
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "TrustWallet-Like Multi-Chain Backend",
    version: "2.0.0",
    description: "Production-grade multi-blockchain wallet backend",
    supportedChains: {
      EVM: [
        "Ethereum",
        "BSC",
        "Polygon",
        "Arbitrum",
        "Optimism",
        "Avalanche",
        "Fantom",
        "Base",
      ],
      UTXO: ["Bitcoin", "Litecoin", "Dogecoin"],
      Other: ["Solana", "XRP", "Cosmos", "Tron"],
    },
    endpoints: {
      docs: "/api-docs",
      health: "/health",
      admin: "/admin",
      devicePasscodes: "/device-passcodes",
      multichain: "/multichain",
      transactions: "/transactions",
      backup: "/backup",
      market: "/market",
      dapps: "/dapps",
      monitoring: "/monitoring",
      wallet: "/wallet",
      quicknode: "/quicknode",
      swap: "/0x",
    },
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 8. API ROUTES (NO /api PREFIX!)
// ==========================================

// Admin routes (authentication & profile)
app.use("/admin", adminRoutes);

// Device authentication
app.use("/device-passcodes", devicePasscodeRoutes);

// Multi-chain routes (PRIMARY)
app.use("/multichain", multichainRoutes);

// Transactions
app.use("/transactions", transactionRoutes);

// Backup & Recovery
app.use("/backup", backupRoutes);

// Market data
app.use("/market", marketRoutes);

// DApp discovery
app.use("/dapps", dappRoutes);

// Monitoring
app.use("/monitoring", monitoringRoutes);

// Legacy wallet routes (still supported)
app.use("/wallet", walletRoutes);
app.use("/wallet-network", accountRoutes);
app.use("/wallet/staticNetwork", staticNetworkRouter);
app.use("/wallet/staticNetwork/images", staticNetworkImagesRouter);

// Third-party integrations
registerQuickNode(app);
registerZeroX(app);

// ==========================================
// 9. ERROR HANDLING
// ==========================================
// SecurityConfig.applyErrorHandler(app);

// ==========================================
// 10. GRACEFUL SHUTDOWN
// ==========================================
process.on("SIGTERM", () => {
  auditLogger.logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  auditLogger.logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  auditLogger.logError(error, { type: "UNCAUGHT_EXCEPTION" });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  auditLogger.logger.error({
    type: "UNHANDLED_REJECTION",
    reason,
    promise,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 11. STARTUP LOG
// ==========================================
//console.log('\n🚀 TwwWin Wallet API - Routes Registered:');
//console.log('════════════════════════════════════════════════════');
//console.log('  ✅ GET  /                          - API Info');
//console.log('  ✅ GET  /health                    - Health Check');
//console.log('  ✅ GET  /api-docs                  - Swagger UI');
//console.log('\n📋 Admin Routes:');
//console.log('  ✅ POST /admin/login               - Admin Login');
//console.log('  ✅ POST /admin/register            - Admin Registration');
//console.log('  ✅ GET  /admin                     - List Admins');
//console.log('  ✅ GET  /admin/wallets             - List All Wallets');
//console.log('  ✅ GET  /admin/wallets/:id/seed    - Get Wallet Seed (ADMIN ONLY)');
//console.log('\n🔐 Device Authentication:');
//console.log('  ✅ POST /device-passcodes          - Create Passcode');
//console.log('  ✅ POST /device-passcodes/validate - Validate Passcode');
//console.log('  ✅ GET  /device-passcodes          - List Passcodes');
//console.log('\n💰 Multi-Chain Wallets:');
//console.log('  ✅ POST /multichain/wallet/create  - Create Multi-Chain Wallet');
//console.log('  ✅ GET  /multichain/wallet/:id/balances - Get All Balances');
//console.log('  ✅ GET  /multichain/wallet/:id/summary - Wallet Summary');
//console.log('  ✅ GET  /multichain/chains          - List Supported Chains');
//console.log('\n🔄 Multi-Chain Swaps:');
//console.log('  ✅ POST /multichain/swap/quote     - Get Swap Quote');
//console.log('  ✅ POST /multichain/swap/execute   - Execute Swap');
//console.log('  ✅ GET  /multichain/swap/tokens/:chainId - Supported Tokens');
//console.log('\n💸 Transactions:');
//console.log('  ✅ POST /transactions/send         - Send Crypto (Universal)');
//console.log('  ✅ GET  /transactions/receive/:walletId/:chainId - Receive Address');
//console.log('  ✅ GET  /transactions/history/:walletId/:chainId - Transaction History');
//console.log('  ✅ POST /transactions/estimate-fee - Estimate Fees');
//console.log('\n🔒 Backup & Recovery:');
//console.log('  ✅ GET  /backup/status/:walletId   - Check Backup Status');
//console.log('  ✅ POST /backup/seed-phrase/:walletId - Get Seed Phrase');
//console.log('  ✅ POST /backup/confirm/:walletId  - Confirm Backup');
//console.log('\n📊 Market Data:');
//console.log('  ✅ GET  /market/home               - Home Screen Data');
//console.log('  ✅ GET  /market/trending           - Trending Tokens');
//console.log('  ✅ GET  /market/token/:id          - Token Details');
//console.log('  ✅ GET  /market/earning            - Earning Opportunities');
//console.log('\n🎮 DApps:');
//console.log('  ✅ GET  /dapps/featured            - Featured DApps');
//console.log('  ✅ GET  /dapps/categories          - DApp Categories');
//console.log('  ✅ POST /dapps/search              - Search DApps');
//console.log('\n🔔 Monitoring:');
//console.log('  ✅ POST /monitoring/start          - Start Balance Monitoring');
//console.log('  ✅ POST /monitoring/threshold      - Set Balance Alert');
//console.log('  ✅ GET  /monitoring/status         - Get Monitoring Status');
//console.log('\n🔗 Integrations:');
//console.log('  ✅ *    /quicknode/*               - QuickNode RPC');
//console.log('  ✅ *    /0x/*                      - Token Swaps (0x Protocol)');
/**
 *  Earn routes:
 */

//console.log('\n💰 Earn Routes:');
//console.log('  ✅ GET  /earn/opportunities         - Get All Earning Opportunities');
//console.log('  ✅ GET  /earn/stablecoins           - Get Stablecoin Earn Options');
//console.log('  ✅ GET  /earn/staking               - Get Native Staking Options');
//console.log('  ✅ GET  /earn/trust-alpha           - Get Trust Alpha Campaigns');
//console.log('  ✅ GET  /earn/trust-alpha/:id       - Get Campaign Details');
//console.log('  ✅ POST /earn/start                 - Start Earning Position');
//console.log('  ✅ POST /earn/stop                  - Stop Earning / Withdraw');
//console.log('  ✅ POST /earn/claim-rewards         - Claim Rewards');
//console.log('  ✅ GET  /earn/positions/:walletId   - Get User Positions');
//console.log('  ✅ GET  /earn/position/:positionId  - Get Position Details');
//console.log('  ✅ POST /earn/estimate              - Estimate Earnings');
//console.log('  ✅ POST /earn/trust-alpha/join      - Join Trust Alpha Campaign');
//console.log('  ✅ GET  /earn/history/:walletId     - Get Earning History');
//console.log('  ✅ GET  /earn/stats/:walletId       - Get Earning Statistics');
//console.log('  ✅ GET  /earn/supported-assets      - Get Supported Assets');
//console.log('  ✅ POST /earn/refresh-rates         - Refresh APY Rates');
//console.log('════════════════════════════════════════════════════\n');

module.exports = app;
