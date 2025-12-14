/**
 * Complete Transaction Repository Layer
 * Database operations for transaction management
 * 
 * Location: src/repositories/transaction.repository.js
 */

const db = require('../db/index');

class TransactionRepository {
  /**
   * Create new transaction record
   */
  create(txData) {
    const {
      id,
      walletId,
      network,
      txHash,
      fromAddress,
      toAddress,
      amount,
      tokenAddress = null,
      tokenSymbol = null,
      txType,
      status = 'pending',
      blockNumber = null,
      gasUsed = null,
      gasPrice = null,
      txFee = null,
      metadata = null,
      createdAt
    } = txData;

    db.prepare(`
      INSERT INTO transactions (
        id, wallet_id, network, tx_hash, from_address, to_address,
        amount, token_address, token_symbol, tx_type, status,
        block_number, gas_used, gas_price, tx_fee, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, walletId, network, txHash, fromAddress, toAddress,
      amount, tokenAddress, tokenSymbol, txType, status,
      blockNumber, gasUsed, gasPrice, txFee, createdAt
    );

    return this.findById(id);
  }

  /**
   * Find transaction by ID
   */
  findById(txId) {
    return db.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(txId);
  }

  /**
   * Find transaction by hash
   */
  findByHash(txHash) {
    return db.prepare(`
      SELECT * FROM transactions WHERE tx_hash = ?
    `).get(txHash);
  }

  /**
   * Find transactions by wallet
   */
  findByWallet(walletId, filters = {}) {
    const { chainId, status, txType, limit = 50, offset = 0 } = filters;

    let query = 'SELECT * FROM transactions WHERE wallet_id = ?';
    const params = [walletId];

    if (chainId) {
      query += ' AND network = ?';
      params.push(chainId.toUpperCase());
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (txType) {
      query += ' AND tx_type = ?';
      params.push(txType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params);
  }

  /**
   * Update transaction
   */
  update(txId, updates) {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    values.push(txId);

    db.prepare(`
      UPDATE transactions SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);

    return this.findById(txId);
  }

  /**
   * Get transaction statistics
   */
  getStats(walletId, chainId = null) {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN tx_type = 'send' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN tx_type = 'receive' THEN 1 ELSE 0 END) as received
      FROM transactions
      WHERE wallet_id = ?
    `;

    const params = [walletId];

    if (chainId) {
      query += ' AND network = ?';
      params.push(chainId.toUpperCase());
    }

    return db.prepare(query).get(...params);
  }

  /**
   * Delete old pending transactions (cleanup)
   */
  deleteOldPending(daysOld = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    db.prepare(`
      DELETE FROM transactions
      WHERE status = 'pending'
      AND created_at < ?
    `).run(cutoff.toISOString());
  }
}

module.exports = new TransactionRepository();




