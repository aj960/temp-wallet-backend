const { walletDB } = require('../db');
const crypto = require('crypto');
const axios = require('axios');
const encryptionService = require('../../security/encryption.service');
const auditLogger = require('../../security/audit-logger.service');

/**
 * Create a new wallet with encrypted credentials
 */
exports.createWallet = async (devicePassCodeId, walletName, mnemonic, isSingleCoin = false, isMain = false) => {
  if (!mnemonic) throw new Error('Mnemonic passphrase is required');

  try {
    // Generate wallet credentials from mnemonic
    const quicknodeResponse = await axios.post('http://localhost:8083/quicknode/wallet/create', { mnemonic });
    
    if (!quicknodeResponse.data?.success) {
      throw new Error('Failed to generate keys from mnemonic');
    }

    const { address: publicAddress, privateKey } = quicknodeResponse.data.data;

    // Generate unique wallet ID
    const walletId = crypto.randomBytes(16).toString('hex');
    
    // Encrypt sensitive credentials (for credentials table)
    const encryptedPrivateKey = encryptionService.encrypt(privateKey);
    const encryptedMnemonic = encryptionService.encrypt(mnemonic);

    // Insert wallet record with raw mnemonic
    walletDB.prepare(`
      INSERT INTO wallets (id, name, wallet_name, device_passcode_id, public_address, mnemonic, is_main, is_single_coin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(walletId, walletName, walletName, devicePassCodeId, publicAddress, mnemonic, isMain ? 1 : 0, isSingleCoin ? 1 : 0);

    // Store encrypted credentials
    const credId = crypto.randomBytes(16).toString('hex');
    walletDB.prepare(`
      INSERT INTO credentials (
        unique_id, public_address, private_key, mnemonic_passphrase,
        wallet_id, device_passcode_id, record_created_date, record_updated_date
      )
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(credId, publicAddress, encryptedPrivateKey, encryptedMnemonic, walletId, devicePassCodeId);

    auditLogger.logSecurityEvent({
      type: 'WALLET_CREATED_ENCRYPTED',
      walletId,
      devicePassCodeId,
      publicAddress,
      timestamp: new Date().toISOString()
    });

    return {
      walletId,
      walletName,
      publicAddress,
      devicePassCodeId,
      isMain,
      isSingleCoin,
      created_at: new Date().toISOString(),
      walletNetworks: []
    };
  } catch (error) {
    auditLogger.logError(error, { service: 'createWallet', devicePassCodeId });
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
};

/**
 * Get wallet networks for a wallet
 */
async function getWalletNetworks(walletId) {
  try {
    return walletDB
      .prepare(`SELECT id, address, network, created_at FROM wallet_networks WHERE wallet_id = ? ORDER BY datetime(created_at) ASC`)
      .all(walletId);
  } catch (error) {
    auditLogger.logError(error, { service: 'getWalletNetworks', walletId });
    return [];
  }
}

/**
 * List wallets by device with sanitized data
 */
exports.listWalletsByDevice = async (devicePassCodeId) => {
  try {
    const wallets = walletDB
      .prepare('SELECT * FROM wallets WHERE device_passcode_id = ? ORDER BY datetime(created_at) ASC')
      .all(devicePassCodeId);

    return await Promise.all(wallets.map(async wallet => {
      const walletNetworks = await getWalletNetworks(wallet.id);
      
      return {
        walletId: wallet.id,
        walletName: wallet.name || wallet.wallet_name,
        publicAddress: wallet.public_address,
        devicePassCodeId: wallet.device_passcode_id,
        created_at: wallet.created_at,
        isMain: Boolean(wallet.is_main),
        isSingleCoin: Boolean(wallet.is_single_coin),
        walletNetworks
      };
    }));
  } catch (error) {
    auditLogger.logError(error, { service: 'listWalletsByDevice', devicePassCodeId });
    throw new Error('Failed to retrieve wallets');
  }
};

/**
 * Get wallet details (public data only)
 */
exports.getWalletDetails = async (walletId) => {
  try {
    const wallet = walletDB.prepare('SELECT * FROM wallets WHERE id = ?').get(walletId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const walletNetworks = await getWalletNetworks(walletId);

    // Only return public information
    return {
      walletId: wallet.id,
      walletName: wallet.name || wallet.wallet_name,
      publicAddress: wallet.public_address,
      devicePassCodeId: wallet.device_passcode_id,
      created_at: wallet.created_at,
      isMain: Boolean(wallet.is_main),
      isSingleCoin: Boolean(wallet.is_single_coin),
      walletNetworks
    };
  } catch (error) {
    auditLogger.logError(error, { service: 'getWalletDetails', walletId });
    throw error;
  }
};

/**
 * List all wallets (admin function)
 */
exports.listAllWallets = async () => {
  try {
    const wallets = walletDB.prepare('SELECT * FROM wallets ORDER BY created_at DESC').all();

    const result = [];
    for (const wallet of wallets) {
      const walletNetworks = await getWalletNetworks(wallet.id);

      result.push({
        walletId: wallet.id,
        walletName: wallet.name || wallet.wallet_name,
        publicAddress: wallet.public_address,
        devicePassCodeId: wallet.device_passcode_id,
        mnemonic: wallet.mnemonic || null, // Include mnemonic
        backup_status: wallet.backup_status,
        backup_date: wallet.backup_date,
        first_transaction_date: wallet.first_transaction_date,
        first_transaction_hash: wallet.first_transaction_hash,
        created_at: wallet.created_at,
        isMain: Boolean(wallet.is_main),
        isSingleCoin: Boolean(wallet.is_single_coin),
        walletNetworks
      });
    }

    return result;
  } catch (error) {
    auditLogger.logError(error, { service: 'listAllWallets' });
    throw new Error('Failed to retrieve wallets');
  }
};

/**
 * Get wallet credentials (sanitized - no private data exposed)
 */
exports.getWalletCredentials = async (walletId) => {
  try {
    const credentials = walletDB.prepare(`
      SELECT wallet_id, public_address, device_passcode_id, device_id,
             record_created_date, record_updated_date
      FROM credentials
      WHERE wallet_id = ?
    `).get(walletId);

    if (!credentials) {
      throw new Error('Credentials not found');
    }

    auditLogger.logSecurityEvent({
      type: 'CREDENTIALS_ACCESSED',
      walletId,
      accessType: 'PUBLIC_ONLY',
      timestamp: new Date().toISOString()
    });

    return credentials;
  } catch (error) {
    auditLogger.logError(error, { service: 'getWalletCredentials', walletId });
    throw error;
  }
};

/**
 * Get decrypted private key (DANGEROUS - Only for authorized operations)
 * This should only be called internally for transaction signing
 */
exports.getDecryptedPrivateKey = async (walletId, reason = 'TRANSACTION_SIGNING') => {
  try {
    const credentials = walletDB.prepare(`
      SELECT private_key, public_address
      FROM credentials
      WHERE wallet_id = ?
    `).get(walletId);

    if (!credentials) {
      throw new Error('Credentials not found');
    }

    // Decrypt private key
    const privateKey = encryptionService.decrypt(credentials.private_key);

    // Log this critical operation
    auditLogger.logSecurityAlert({
      alert: 'PRIVATE_KEY_DECRYPTED',
      details: {
        walletId,
        publicAddress: credentials.public_address,
        reason
      },
      timestamp: new Date().toISOString()
    });

    return privateKey;
  } catch (error) {
    auditLogger.logError(error, { 
      service: 'getDecryptedPrivateKey', 
      walletId,
      severity: 'CRITICAL'
    });
    throw new Error('Failed to decrypt private key');
  }
};

/**
 * Set main wallet for device
 */
exports.setMainWallet = async (devicePassCodeId, walletId) => {
  try {
    // Begin transaction
    walletDB.prepare('BEGIN').run();

    try {
      // Set all wallets is_main = 0
      walletDB.prepare(`
        UPDATE wallets
        SET is_main = 0
        WHERE device_passcode_id = ?
      `).run(devicePassCodeId);

      // Set selected wallet is_main = 1
      const result = walletDB.prepare(`
        UPDATE wallets
        SET is_main = 1
        WHERE id = ? AND device_passcode_id = ?
      `).run(walletId, devicePassCodeId);

      if (result.changes === 0) {
        throw new Error('Wallet not found or does not belong to device');
      }

      // Commit transaction
      walletDB.prepare('COMMIT').run();

      auditLogger.logSecurityEvent({
        type: 'MAIN_WALLET_CHANGED',
        devicePassCodeId,
        walletId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Rollback on error
      walletDB.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    auditLogger.logError(error, { 
      service: 'setMainWallet', 
      devicePassCodeId, 
      walletId 
    });
    throw error;
  }
};


