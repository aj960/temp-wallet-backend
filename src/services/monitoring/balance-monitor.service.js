const { walletDB } = require('../../wallet/db');
const multichainService = require('../multichain/multichain.service');
const notificationService = require('./notification.service');
const auditLogger = require('../../security/audit-logger.service');

class BalanceMonitorService {
  constructor() {
    this.monitoringIntervals = new Map();
    this.thresholds = new Map();
    this.isRunning = false;
    this.firstDepositNotified = new Set(); // Track wallet:chain combinations that have sent first deposit notifications
  }

  /**
   * Start monitoring all wallets
   */
  startGlobalMonitoring(intervalMs = 300000) { // 5 minutes default
    if (this.isRunning) {
      //console.log('Balance monitoring already running');
      return;
    }

    this.isRunning = true;
    
    this.globalInterval = setInterval(async () => {
      try {
        await this.checkAllWallets();
      } catch (error) {
        auditLogger.logError(error, { service: 'BalanceMonitor' });
      }
    }, intervalMs);

    auditLogger.logger.info({
      type: 'BALANCE_MONITORING_STARTED',
      interval: intervalMs,
      timestamp: new Date().toISOString()
    });

    //console.log(`✅ Global balance monitoring started (${intervalMs}ms interval)`);
  }

  /**
   * Stop global monitoring
   */
  stopGlobalMonitoring() {
    if (this.globalInterval) {
      clearInterval(this.globalInterval);
      this.isRunning = false;
      
      auditLogger.logger.info({
        type: 'BALANCE_MONITORING_STOPPED',
        timestamp: new Date().toISOString()
      });
      
      //console.log('⛔ Global balance monitoring stopped');
    }
  }

  /**
   * Check all wallets for balance changes
   */
  async checkAllWallets() {
    try {
      const wallets = await walletDB.prepare('SELECT * FROM wallets').all();
      
      for (const wallet of wallets) {
        try {
          await this.checkWalletBalance(wallet.id);
        } catch (error) {
          console.error(`Error checking wallet ${wallet.id}:`, error.message);
        }
      }
    } catch (error) {
      auditLogger.logError(error, { service: 'checkAllWallets' });
    }
  }

  /**
   * Check specific wallet balance
   */
  async checkWalletBalance(walletId) {
    try {
      const networks = await walletDB
        .prepare('SELECT * FROM wallet_networks WHERE wallet_id = ?')
        .all(walletId);

      for (const network of networks) {
        const currentBalance = await this.fetchBalance(
          network.network,
          network.address
        );

        // Check for first deposit
        const lastBalance = await this.getLastRecordedBalance(walletId, network.network);
        const firstDepositKey = `${walletId}:${network.network}`;
        
        // Detect first deposit: lastBalance is null/0 and currentBalance > 0
        if (
          (!lastBalance || parseFloat(lastBalance) === 0) &&
          parseFloat(currentBalance) > 0 &&
          !this.firstDepositNotified.has(firstDepositKey)
        ) {
          await this.handleFirstDeposit(walletId, network, currentBalance);
          this.firstDepositNotified.add(firstDepositKey);
        }

        const threshold = this.getThreshold(walletId, network.network);
        
        if (threshold && parseFloat(currentBalance) < parseFloat(threshold.minBalance)) {
          await this.handleLowBalance(walletId, network, currentBalance, threshold);
        }

        // Check for significant balance changes
        if (lastBalance) {
          const change = parseFloat(currentBalance) - parseFloat(lastBalance);
          const percentChange = Math.abs((change / parseFloat(lastBalance)) * 100);

          if (percentChange > 10) { // 10% change threshold
            await this.handleBalanceChange(
              walletId,
              network,
              lastBalance,
              currentBalance,
              change
            );
          }
        }

        // Update recorded balance
        await this.recordBalance(walletId, network.network, currentBalance);
      }
    } catch (error) {
      auditLogger.logError(error, { 
        service: 'checkWalletBalance',
        walletId 
      });
    }
  }

  /**
   * Fetch balance from blockchain
   */
  async fetchBalance(chain, address) {
    try {
      const balanceData = await multichainService.getBalance(chain, address);
      return balanceData.balance;
    } catch (error) {
      console.error(`Failed to fetch balance for ${chain}:${address}`, error.message);
      return '0';
    }
  }

  /**
   * Handle first deposit detection
   */
  async handleFirstDeposit(walletId, network, currentBalance) {
    try {
      const wallet = await walletDB.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
      
      // Try to get the most recent RECEIVE transaction from database
      let transaction = null;
      try {
        transaction = await walletDB
          .prepare(`
            SELECT * FROM transactions 
            WHERE wallet_id = ? 
            AND network = ? 
            AND tx_type = 'RECEIVE' 
            AND status = 'confirmed'
            ORDER BY created_at DESC 
            LIMIT 1
          `)
          .get(walletId, network.network);
      } catch (error) {
        // If transaction table doesn't exist or query fails, continue without tx info
        console.warn('Could not fetch transaction for first deposit:', error.message);
      }

      const depositData = {
        walletId,
        walletName: wallet?.name || wallet?.wallet_name || 'Unknown Wallet',
        chain: network.network,
        address: network.address,
        amount: currentBalance,
        symbol: transaction?.token_symbol || network.network,
        toAddress: network.address,
        timestamp: transaction?.created_at || new Date().toISOString()
      };

      // Add transaction details if available
      if (transaction) {
        depositData.txHash = transaction.tx_hash;
        depositData.fromAddress = transaction.from_address;
      }

      // Log first deposit
      auditLogger.logger.info({
        type: 'FIRST_DEPOSIT_DETECTED',
        ...depositData
      });

      // Send admin notification
      await notificationService.sendFirstDepositNotification(depositData);
    } catch (error) {
      auditLogger.logError(error, {
        service: 'handleFirstDeposit',
        walletId,
        network: network.network
      });
    }
  }

  /**
   * Handle low balance alert
   */
  async handleLowBalance(walletId, network, currentBalance, threshold) {
    const wallet = await walletDB.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
    
    const alertData = {
      type: 'LOW_BALANCE',
      walletId,
      walletName: wallet.name || wallet.wallet_name,
      chain: network.network,
      address: network.address,
      currentBalance,
      threshold: threshold.minBalance,
      timestamp: new Date().toISOString()
    };

    // Log alert
    auditLogger.logSecurityAlert({
      alert: 'LOW_BALANCE_DETECTED',
      details: alertData,
      ip: 'system'
    });

    // Send notification
    if (threshold.email) {
      await notificationService.sendLowBalanceAlert(threshold.email, alertData);
    }

    // Trigger webhook
    if (threshold.webhookUrl) {
      await this.triggerWebhook(threshold.webhookUrl, alertData);
    }
  }

  /**
   * Handle significant balance change
   */
  async handleBalanceChange(walletId, network, oldBalance, newBalance, change) {
    const wallet = await walletDB.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
    
    const changeData = {
      type: 'BALANCE_CHANGE',
      walletId,
      walletName: wallet.name || wallet.wallet_name,
      chain: network.network,
      address: network.address,
      oldBalance,
      newBalance,
      change: change.toFixed(8),
      percentChange: ((change / parseFloat(oldBalance)) * 100).toFixed(2),
      timestamp: new Date().toISOString()
    };

    auditLogger.logger.info({
      type: 'SIGNIFICANT_BALANCE_CHANGE',
      ...changeData
    });

    const threshold = this.getThreshold(walletId, network.network);
    
    if (threshold && threshold.email) {
      await notificationService.sendBalanceChangeAlert(threshold.email, changeData);
    }
  }

  /**
   * Set threshold for wallet
   */
  setThreshold(walletId, chain, config) {
    const key = `${walletId}:${chain}`;
    this.thresholds.set(key, {
      walletId,
      chain,
      minBalance: config.minBalance,
      email: config.email,
      webhookUrl: config.webhookUrl,
      enabled: config.enabled !== false,
      createdAt: new Date().toISOString()
    });

    auditLogger.logger.info({
      type: 'THRESHOLD_CONFIGURED',
      walletId,
      chain,
      minBalance: config.minBalance,
      timestamp: new Date().toISOString()
    });

    return this.thresholds.get(key);
  }

  /**
   * Get threshold for wallet
   */
  getThreshold(walletId, chain) {
    const key = `${walletId}:${chain}`;
    return this.thresholds.get(key);
  }

  /**
   * Remove threshold
   */
  removeThreshold(walletId, chain) {
    const key = `${walletId}:${chain}`;
    return this.thresholds.delete(key);
  }

  /**
   * Get all thresholds for wallet
   */
  getWalletThresholds(walletId) {
    const results = [];
    for (const [key, threshold] of this.thresholds) {
      if (threshold.walletId === walletId) {
        results.push(threshold);
      }
    }
    return results;
  }

  /**
   * Record balance in memory (you can extend this to use DB)
   */
  async recordBalance(walletId, chain, balance) {
    const key = `balance:${walletId}:${chain}`;
    // Store in memory or database
    this[key] = {
      balance,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get last recorded balance
   */
  async getLastRecordedBalance(walletId, chain) {
    const key = `balance:${walletId}:${chain}`;
    const record = this[key];
    return record ? record.balance : null;
  }

  /**
   * Trigger webhook
   */
  async triggerWebhook(url, data) {
    try {
      const axios = require('axios');
      await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      auditLogger.logger.info({
        type: 'WEBHOOK_TRIGGERED',
        url,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      auditLogger.logError(error, { 
        service: 'triggerWebhook',
        url 
      });
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeThresholds: this.thresholds.size,
      thresholds: Array.from(this.thresholds.values())
    };
  }
}

module.exports = new BalanceMonitorService();



