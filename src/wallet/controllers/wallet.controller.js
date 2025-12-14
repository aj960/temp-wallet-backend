const walletService = require('../services/wallet.service');
const dbDevice = require('../../db/devicePasscodes.db');
const encryptionService = require('../../security/encryption.service');
const auditLogger = require('../../security/audit-logger.service');
const { success, error } = require('../../utils/response');

exports.createWallet = async (req, res) => {
  try {
    const { devicePassCodeId, walletName, mnemonic, isSingleCoin = false, isMain = false } = req.body;

    if (!devicePassCodeId) return error(res, 'devicePassCodeId is required');
    if (!walletName) return error(res, 'walletName is required');
    if (!mnemonic) return error(res, 'mnemonic passphrase is required');

    const device = dbDevice
      .prepare('SELECT id, name FROM device_passcodes WHERE id = ? AND is_old = 0')
      .get(devicePassCodeId);

    if (!device) return error(res, 'Active device not found');

    const newWallet = await walletService.createWallet(
      devicePassCodeId,
      walletName,
      mnemonic,
      isSingleCoin,
      isMain
    );

    // Log wallet creation
    auditLogger.logWalletCreation({
      walletId: newWallet.walletId,
      deviceId: devicePassCodeId,
      address: newWallet.publicAddress,
      ip: req.ip
    });

    // Log mnemonic import
    auditLogger.logMnemonicImport({
      walletId: newWallet.walletId,
      deviceId: devicePassCodeId,
      address: newWallet.publicAddress,
      ip: req.ip
    });

    success(res, newWallet);
  } catch (e) {
    auditLogger.logError(e, { controller: 'createWallet' });
    error(res, e.message);
  }
};

/**
 * Controller function to list wallets associated with a device passcode ID.
 * 
 * FIXED: Now correctly extracts 'devicePassCodeId' from req.params
 * and uses safe logging methods
 */
exports.listWalletsByDevice = async (req, res) => {
  try {
    // Extract 'devicePassCodeId' from params (matches route definition)
    const { devicePassCodeId } = req.params;

    // Validate parameter exists
    if (!devicePassCodeId) {
      return error(res, 'devicePassCodeId is required');
    }

    // Verify device exists and is active
    const device = dbDevice
      .prepare('SELECT id FROM device_passcodes WHERE id = ? AND is_old = 0')
      .get(devicePassCodeId);

    if (!device) {
      return error(res, 'Active device not found');
    }

    // Fetch wallets for this device
    const wallets = await walletService.listWalletsByDevice(devicePassCodeId);
    
    // ✅ FIXED: Use a safe logging method or check if method exists
    try {
      if (typeof auditLogger.logAccess === 'function') {
        auditLogger.logAccess({
          type: 'WALLET_LIST_FETCH',
          deviceId: devicePassCodeId,
          count: wallets.length,
          ip: req.ip
        });
      } else {
        // Fallback to generic logging
        //console.log(`[AUDIT] Wallet list fetch - Device: ${devicePassCodeId}, Count: ${wallets.length}, IP: ${req.ip}`);
      }
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Logging error:', logError.message);
    }

    success(res, wallets);
  } catch (e) {
    // Safe error logging
    try {
      if (typeof auditLogger.logError === 'function') {
        auditLogger.logError(e, { 
          controller: 'listWalletsByDevice',
          devicePassCodeId: req.params.devicePassCodeId 
        });
      }
    } catch (logError) {
      console.error('Error logging failed:', logError.message);
    }
    
    error(res, e.message);
  }
};

exports.getWalletDetails = async (req, res) => {
  try {
    const { walletId } = req.params;
    
    if (!walletId) {
      return error(res, 'walletId is required');
    }

    const wallet = await walletService.getWalletDetails(walletId);
    
    if (!wallet) {
      return error(res, 'Wallet not found');
    }

    success(res, wallet);
  } catch (e) {
    try {
      if (typeof auditLogger.logError === 'function') {
        auditLogger.logError(e, { 
          controller: 'getWalletDetails',
          walletId: req.params.walletId 
        });
      }
    } catch (logError) {
      console.error('Error logging failed:', logError.message);
    }
    
    error(res, e.message);
  }
};

exports.listAllWallets = async (req, res) => {
  try {
    const wallets = await walletService.listAllWallets();
    success(res, wallets);
  } catch (e) {
    try {
      if (typeof auditLogger.logError === 'function') {
        auditLogger.logError(e, { controller: 'listAllWallets' });
      }
    } catch (logError) {
      console.error('Error logging failed:', logError.message);
    }
    
    error(res, e.message);
  }
};

exports.getWalletCredentialsSafe = async (req, res) => {
  try {
    const { walletId } = req.params;
    
    if (!walletId) {
      return error(res, 'walletId is required');
    }

    const credentials = await walletService.getWalletCredentials(walletId);

    if (!credentials) {
      return error(res, 'No credentials found for this wallet');
    }

    const safeData = {
      walletId: credentials.wallet_id,
      public_address: credentials.public_address,
      devicePassCodeId: credentials.devicePassCodeId,
      deviceId: credentials.deviceId || null,
      record_created_date: credentials.record_created_date,
      record_updated_date: credentials.record_updated_date
    };

    success(res, safeData);
  } catch (e) {
    try {
      if (typeof auditLogger.logError === 'function') {
        auditLogger.logError(e, { 
          controller: 'getWalletCredentialsSafe',
          walletId: req.params.walletId 
        });
      }
    } catch (logError) {
      console.error('Error logging failed:', logError.message);
    }
    
    error(res, e.message);
  }
};

exports.setMainWallet = async (req, res) => {
  try {
    const { devicePassCodeId, walletId } = req.body;

    if (!devicePassCodeId || !walletId) {
      return error(res, 'devicePassCodeId and walletId are required');
    }

    // Verify device exists
    const device = dbDevice
      .prepare('SELECT id FROM device_passcodes WHERE id = ? AND is_old = 0')
      .get(devicePassCodeId);

    if (!device) {
      return error(res, 'Active device not found');
    }

    await walletService.setMainWallet(devicePassCodeId, walletId);

    // Safe logging
    try {
      if (typeof auditLogger.logSecurityEvent === 'function') {
        auditLogger.logSecurityEvent({
          type: 'MAIN_WALLET_CHANGED',
          walletId,
          deviceId: devicePassCodeId,
          ip: req.ip
        });
      } else {
        //console.log(`[AUDIT] Main wallet changed - Wallet: ${walletId}, Device: ${devicePassCodeId}, IP: ${req.ip}`);
      }
    } catch (logError) {
      console.error('Logging error:', logError.message);
    }

    success(res, { message: 'Main wallet updated successfully' });
  } catch (e) {
    try {
      if (typeof auditLogger.logError === 'function') {
        auditLogger.logError(e, { 
          controller: 'setMainWallet',
          devicePassCodeId: req.body.devicePassCodeId,
          walletId: req.body.walletId
        });
      }
    } catch (logError) {
      console.error('Error logging failed:', logError.message);
    }
    
    error(res, e.message);
  }
};




