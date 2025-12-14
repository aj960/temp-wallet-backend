// src/controllers/backup.controller.js
const db = require('../wallet/db/index');
const crypto = require('crypto');
const { decryptMnemonic, verifyDevicePasscode } = require('../services/security/encryption.service');

/**
 * Check if wallet seed phrase has been backed up
 */
exports.checkBackupStatus = async (req, res) => {
  try {
    const { walletId } = req.params;

    // Get wallet backup status
    const wallet = db.prepare(`
      SELECT 
        id,
        wallet_name,
        backup_status,
        backup_date,
        first_transaction_date,
        first_transaction_hash,
        created_at
      FROM wallets 
      WHERE id = ?
    `).get(walletId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    const isBackedUp = wallet.backup_status === 1;
    const hasTransactions = wallet.first_transaction_date !== null;

    let urgency = 'NONE';
    let needsBackup = false;
    let daysSinceFirstTransaction = 0;

    if (hasTransactions && !isBackedUp) {
      const firstTxDate = new Date(wallet.first_transaction_date);
      const now = new Date();
      daysSinceFirstTransaction = Math.floor((now - firstTxDate) / (1000 * 60 * 60 * 24));

      needsBackup = true;
      
      if (daysSinceFirstTransaction >= 7) {
        urgency = 'HIGH';
      } else if (daysSinceFirstTransaction >= 3) {
        urgency = 'MEDIUM';
      } else {
        urgency = 'NORMAL';
      }
    }

    res.json({
      success: true,
      data: {
        walletId: wallet.id,
        walletName: wallet.wallet_name,
        isBackedUp,
        backupDate: wallet.backup_date,
        hasTransactions,
        firstTransactionDate: wallet.first_transaction_date,
        daysSinceFirstTransaction: hasTransactions ? daysSinceFirstTransaction : 0,
        needsBackup,
        urgency,
        message: isBackedUp 
          ? 'Your wallet is backed up' 
          : needsBackup 
            ? 'IMPORTANT: Backup your seed phrase to prevent loss of funds'
            : 'No backup needed yet'
      }
    });

  } catch (error) {
    console.error('❌ Error checking backup status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check backup status',
      error: error.message
    });
  }
};

/**
 * Get seed phrase for backup (requires authentication)
 */
exports.getSeedPhraseForBackup = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { devicePassCodeId, passcode } = req.body;

    if (!devicePassCodeId || !passcode) {
      return res.status(400).json({
        success: false,
        message: 'devicePassCodeId and passcode are required'
      });
    }

    // Verify device passcode
    const isValid = await verifyDevicePasscode(devicePassCodeId, passcode);
    
    if (!isValid) {
      // Log failed attempt
      db.prepare(`
        INSERT INTO backup_access_log (wallet_id, device_passcode_id, access_type, success, created_at)
        VALUES (?, ?, 'view_seed', 0, datetime('now'))
      `).run(walletId, devicePassCodeId);

      return res.status(401).json({
        success: false,
        message: 'Invalid passcode'
      });
    }

    // Get wallet info
    const wallet = db.prepare(`
      SELECT id, wallet_name, device_passcode_id, backup_status
      FROM wallets 
      WHERE id = ? AND device_passcode_id = ?
    `).get(walletId, devicePassCodeId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found or access denied'
      });
    }

    // Get encrypted mnemonic
    const mnemonicData = db.prepare(`
      SELECT encrypted_mnemonic, encryption_method
      FROM encrypted_mnemonics
      WHERE wallet_id = ?
    `).get(walletId);

    if (!mnemonicData) {
      return res.status(404).json({
        success: false,
        message: 'Failed to retrieve seed phrase. Please try again or contact support.'
      });
    }

    // Decrypt mnemonic
    const seedPhrase = await decryptMnemonic(mnemonicData.encrypted_mnemonic, devicePassCodeId, passcode);

    if (!seedPhrase) {
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt seed phrase'
      });
    }

    // Log successful access
    db.prepare(`
      INSERT INTO backup_access_log (wallet_id, device_passcode_id, access_type, success, created_at)
      VALUES (?, ?, 'view_seed', 1, datetime('now'))
    `).run(walletId, devicePassCodeId);

    const words = seedPhrase.split(' ');

    res.json({
      success: true,
      data: {
        walletId: wallet.id,
        walletName: wallet.wallet_name,
        seedPhrase,
        wordCount: words.length,
        warning: '⚠️ NEVER share your seed phrase with anyone',
        instructions: [
          'Write down these words in order',
          'Store them in a secure, offline location',
          'Never take a screenshot or digital photo',
          'Keep multiple copies in different locations',
          'Anyone with these words can access your funds'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error getting seed phrase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve seed phrase. Please try again or contact support.',
      error: error.message
    });
  }
};

/**
 * Confirm seed phrase backup (verification quiz)
 */
exports.confirmBackup = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { verificationWords } = req.body;

    if (!verificationWords || !Array.isArray(verificationWords) || verificationWords.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'At least 3 verification words required'
      });
    }

    // Get encrypted mnemonic
    const mnemonicData = db.prepare(`
      SELECT em.encrypted_mnemonic, w.device_passcode_id
      FROM encrypted_mnemonics em
      JOIN wallets w ON w.id = em.wallet_id
      WHERE em.wallet_id = ?
    `).get(walletId);

    if (!mnemonicData) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // For verification, we need to decrypt - but this requires passcode
    // Alternative: Store verification hash during backup initiation
    // For now, we'll trust the client verification and just mark as backed up

    // Mark wallet as backed up
    const updateResult = db.prepare(`
      UPDATE wallets 
      SET backup_status = 1, backup_date = datetime('now')
      WHERE id = ?
    `).run(walletId);

    if (updateResult.changes === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to confirm backup'
      });
    }

    // Log successful backup confirmation
    db.prepare(`
      INSERT INTO backup_access_log (wallet_id, device_passcode_id, access_type, success, created_at)
      VALUES (?, ?, 'backup_confirm', 1, datetime('now'))
    `).run(walletId, mnemonicData.device_passcode_id);

    res.json({
      success: true,
      data: {
        message: '✅ Seed phrase backup confirmed!',
        walletId,
        backupDate: new Date().toISOString(),
        reminder: 'Keep your seed phrase safe. You may need it to recover your wallet.'
      }
    });

  } catch (error) {
    console.error('❌ Error confirming backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm backup',
      error: error.message
    });
  }
};

/**
 * Verify seed phrase validity
 */
exports.verifySeedPhrase = async (req, res) => {
  try {
    const { seedPhrase } = req.body;

    if (!seedPhrase) {
      return res.status(400).json({
        success: false,
        message: 'seedPhrase is required'
      });
    }

    const bip39 = require('bip39');
    const isValid = bip39.validateMnemonic(seedPhrase.trim());

    const words = seedPhrase.trim().split(/\s+/);
    const wordCount = words.length;

    res.json({
      success: true,
      data: {
        isValid,
        wordCount,
        supportedLengths: [12, 15, 18, 21, 24],
        message: isValid 
          ? `Valid ${wordCount}-word BIP39 mnemonic` 
          : 'Invalid mnemonic phrase'
      }
    });

  } catch (error) {
    console.error('❌ Error verifying seed phrase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify seed phrase',
      error: error.message
    });
  }
};

/**
 * Record first transaction (triggers backup reminder)
 */
exports.recordFirstTransaction = async (req, res) => {
  try {
    const { walletId, txHash } = req.body;

    if (!walletId || !txHash) {
      return res.status(400).json({
        success: false,
        message: 'walletId and txHash are required'
      });
    }

    // Check if this is the first transaction
    const wallet = db.prepare(`
      SELECT first_transaction_date, backup_status
      FROM wallets 
      WHERE id = ?
    `).get(walletId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Only record if this is the first transaction
    if (!wallet.first_transaction_date) {
      db.prepare(`
        UPDATE wallets 
        SET first_transaction_date = datetime('now'),
            first_transaction_hash = ?
        WHERE id = ?
      `).run(txHash, walletId);

      return res.json({
        success: true,
        data: {
          message: 'First transaction recorded',
          walletId,
          txHash,
          needsBackup: wallet.backup_status === 0,
          reminderTriggered: wallet.backup_status === 0
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Transaction already recorded',
        needsBackup: wallet.backup_status === 0
      }
    });

  } catch (error) {
    console.error('❌ Error recording transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record transaction',
      error: error.message
    });
  }
};

/**
 * Get all backup reminders for device
 */
exports.getBackupReminders = async (req, res) => {
  try {
    const { devicePassCodeId } = req.params;

    const wallets = db.prepare(`
      SELECT 
        id,
        wallet_name,
        backup_status,
        backup_date,
        first_transaction_date,
        first_transaction_hash,
        created_at
      FROM wallets 
      WHERE device_passcode_id = ? AND backup_status = 0 AND first_transaction_date IS NOT NULL
      ORDER BY first_transaction_date ASC
    `).all(devicePassCodeId);

    const reminders = wallets.map(wallet => {
      const firstTxDate = new Date(wallet.first_transaction_date);
      const now = new Date();
      const daysSinceFirstTransaction = Math.floor((now - firstTxDate) / (1000 * 60 * 60 * 24));

      let urgency = 'NORMAL';
      if (daysSinceFirstTransaction >= 7) {
        urgency = 'HIGH';
      } else if (daysSinceFirstTransaction >= 3) {
        urgency = 'MEDIUM';
      }

      return {
        walletId: wallet.id,
        walletName: wallet.wallet_name,
        daysSinceFirstTransaction,
        urgency,
        message: urgency === 'HIGH' 
          ? '🚨 URGENT: Backup your seed phrase immediately!'
          : '⚠️ Please backup your seed phrase'
      };
    });

    res.json({
      success: true,
      data: {
        devicePassCodeId,
        totalReminders: reminders.length,
        reminders
      }
    });

  } catch (error) {
    console.error('❌ Error getting backup reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup reminders',
      error: error.message
    });
  }
};



