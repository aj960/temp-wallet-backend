const { walletDB } = require('../db');
const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

class WalletNetworkModel {
  static create({ wallet_id, address, network }) {
    const id = generateId();

    walletDB.prepare(`
      INSERT INTO wallet_networks (id, wallet_id, address, network)
      VALUES (?, ?, ?, ?)
    `).run(id, wallet_id, address, network);

    return { id, wallet_id, address, network };
  }

  static findByWallet(wallet_id) {
    return walletDB
      .prepare(`SELECT * FROM wallet_networks WHERE wallet_id = ? ORDER BY created_at DESC`)
      .all(wallet_id);
  }

  static findById(id) {
    return walletDB
      .prepare(`SELECT * FROM wallet_networks WHERE id = ?`)
      .get(id);
  }

  static delete(id) {
    return walletDB.prepare(`DELETE FROM wallet_networks WHERE id = ?`).run(id).changes > 0;
  }
}

module.exports = WalletNetworkModel;
