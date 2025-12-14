/**
 * Complete Wallet Repository Layer
 * Database operations for wallet management
 * 
 * Location: src/repositories/wallet.repository.js
 */

const db = require('../db/index');
const encryptionService = require('../services/security/encryption.service');
const crypto = require('crypto');

class WalletRepository {
  /**
   * Create new wallet with encrypted credentials
   */
  async createWallet(walletData, mnemonic, privateKeys) {
    const { id, name, devicePasscodeId, isMain, addresses } = walletData;

    const transaction = db.transaction(() => {
      // Encrypt mnemonic for encrypted_mnemonics table (backup)
      const encryptedMnemonic = encryptionService.encrypt(mnemonic);

      // Insert wallet with raw mnemonic
      db.prepare(`
        INSERT INTO wallets (
          id, name, wallet_name, device_passcode_id, 
          public_address, mnemonic, is_main, is_single_coin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(
        id,
        name,
        name,
        devicePasscodeId,
        addresses[Object.keys(addresses)[0]], // Primary address
        mnemonic, // Store raw mnemonic
        isMain ? 1 : 0
      );

      // Insert encrypted mnemonic for backup
      db.prepare(`
        INSERT INTO encrypted_mnemonics (wallet_id, encrypted_mnemonic, encryption_method, created_at)
        VALUES (?, ?, 'aes-256-gcm', datetime('now'))
      `).run(id, encryptedMnemonic);

      // Insert wallet networks
      Object.entries(addresses).forEach(([chainId, address]) => {
        const networkId = crypto.randomBytes(16).toString('hex');
        db.prepare(`
          INSERT INTO wallet_networks (id, wallet_id, address, network, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(networkId, id, address, chainId.toUpperCase());
      });

      // Insert encrypted credentials
      const credId = crypto.randomBytes(16).toString('hex');
      const encryptedKeys = encryptionService.encrypt(JSON.stringify(privateKeys));
      
      db.prepare(`
        INSERT INTO credentials (
          unique_id, public_address, private_key, mnemonic_passphrase,
          wallet_id, device_passcode_id, record_created_date, record_updated_date
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        credId,
        addresses[Object.keys(addresses)[0]],
        encryptedKeys,
        encryptedMnemonic,
        id,
        devicePasscodeId
      );
    });

    transaction();
    return this.findById(id);
  }

  /**
   * Create single-chain wallet (imported via private key)
   */
  async createSingleChainWallet(walletData, privateKey, chainId) {
    const { id, name, devicePasscodeId, addresses } = walletData;

    const transaction = db.transaction(() => {
      // For single-chain wallets from private key, we don't have mnemonic
      // Store empty string for mnemonic
      db.prepare(`
        INSERT INTO wallets (
          id, name, wallet_name, device_passcode_id,
          public_address, mnemonic, is_main, is_single_coin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, datetime('now'))
      `).run(
        id,
        name,
        name,
        devicePasscodeId,
        addresses[chainId],
        '' // No mnemonic for private key imported wallets
      );

      const networkId = crypto.randomBytes(16).toString('hex');
      db.prepare(`
        INSERT INTO wallet_networks (id, wallet_id, address, network, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(networkId, id, addresses[chainId], chainId.toUpperCase());

      const encryptedKey = encryptionService.encrypt(privateKey);
      const credId = crypto.randomBytes(16).toString('hex');
      
      db.prepare(`
        INSERT INTO credentials (
          unique_id, public_address, private_key, mnemonic_passphrase,
          wallet_id, device_passcode_id, record_created_date, record_updated_date
        ) VALUES (?, ?, ?, '', ?, ?, datetime('now'), datetime('now'))
      `).run(
        credId,
        addresses[chainId],
        encryptedKey,
        id,
        devicePasscodeId
      );
    });

    transaction();
    return this.findById(id);
  }

  /**
   * Find wallet by ID
   */
  findById(walletId) {
    const wallet = db.prepare(`
      SELECT * FROM wallets WHERE id = ?
    `).get(walletId);

    if (!wallet) return null;

    const networks = db.prepare(`
      SELECT id, address, network, balance, created_at
      FROM wallet_networks WHERE wallet_id = ?
    `).all(walletId);

    return {
      ...wallet,
      isMain: Boolean(wallet.is_main),
      isSingleCoin: Boolean(wallet.is_single_coin),
      backupStatus: Boolean(wallet.backup_status),
      networks
    };
  }

  /**
   * Find all wallets for a device
   */
  findByDevice(devicePasscodeId) {
    const wallets = db.prepare(`
      SELECT * FROM wallets WHERE device_passcode_id = ?
      ORDER BY is_main DESC, created_at DESC
    `).all(devicePasscodeId);

    return wallets.map(w => ({
      ...w,
      isMain: Boolean(w.is_main),
      isSingleCoin: Boolean(w.is_single_coin),
      backupStatus: Boolean(w.backup_status),
      networks: db.prepare(`
        SELECT id, address, network, balance, created_at
        FROM wallet_networks WHERE wallet_id = ?
      `).all(w.id)
    }));
  }

  /**
   * Get wallet credentials (decrypted)
   */
  async getCredentials(walletId) {
    const creds = db.prepare(`
      SELECT * FROM credentials WHERE wallet_id = ?
    `).get(walletId);

    if (!creds) return null;

    const mnemonic = db.prepare(`
      SELECT encrypted_mnemonic FROM encrypted_mnemonics WHERE wallet_id = ?
    `).get(walletId);

    try {
      const decryptedMnemonic = mnemonic 
        ? encryptionService.decrypt(mnemonic.encrypted_mnemonic)
        : null;

      const decryptedKeys = encryptionService.decrypt(creds.private_key);
      const privateKeys = JSON.parse(decryptedKeys);

      return {
        mnemonic: decryptedMnemonic,
        privateKeys,
        publicAddress: creds.public_address
      };
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return null;
    }
  }

  /**
   * Verify device access and get credentials
   */
  async verifyAndGetCredentials(walletId, devicePasscodeId) {
    const wallet = db.prepare(`
      SELECT device_passcode_id FROM wallets WHERE id = ?
    `).get(walletId);

    if (!wallet || wallet.device_passcode_id !== devicePasscodeId) {
      return null;
    }

    return this.getCredentials(walletId);
  }

  /**
   * Update wallet
   */
  updateWallet(walletId, updates) {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    values.push(walletId);

    db.prepare(`
      UPDATE wallets SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    return this.findById(walletId);
  }

  /**
   * Unset main wallet for device
   */
  unsetMainWallet(devicePasscodeId) {
    db.prepare(`
      UPDATE wallets SET is_main = 0
      WHERE device_passcode_id = ?
    `).run(devicePasscodeId);
  }

  /**
   * Delete wallet and all related data
   */
  deleteWallet(walletId) {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM wallet_networks WHERE wallet_id = ?').run(walletId);
      db.prepare('DELETE FROM credentials WHERE wallet_id = ?').run(walletId);
      db.prepare('DELETE FROM encrypted_mnemonics WHERE wallet_id = ?').run(walletId);
      db.prepare('DELETE FROM transactions WHERE wallet_id = ?').run(walletId);
      db.prepare('DELETE FROM wallets WHERE id = ?').run(walletId);
    });

    transaction();
  }

  /**
   * Check if mnemonic already exists
   */
  async findByMnemonic(mnemonic) {
    const encryptedMnemonic = encryptionService.encrypt(mnemonic);
    
    const result = db.prepare(`
      SELECT wallet_id FROM encrypted_mnemonics WHERE encrypted_mnemonic = ?
    `).get(encryptedMnemonic);

    if (!result) return null;
    return this.findById(result.wallet_id);
  }
}

module.exports = new WalletRepository();




