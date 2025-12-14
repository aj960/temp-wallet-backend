const balanceMonitor = require('../services/monitoring/balance-monitor.service');
const notificationService = require('../services/monitoring/notification.service');
const { success, error } = require('../utils/response');
const auditLogger = require('../security/audit-logger.service');

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
