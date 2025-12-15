const { walletDB } = require('../db');
const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

class WalletNetworkModel {
  static async create({ wallet_id, address, network }) {
    const id = generateId();

    await walletDB.prepare(`
      INSERT INTO wallet_networks (id, wallet_id, address, network)
      VALUES (?, ?, ?, ?)
    `).run(id, wallet_id, address, network);

    return { id, wallet_id, address, network };
  }

  static async findByWallet(wallet_id) {
    return await walletDB
      .prepare(`SELECT * FROM wallet_networks WHERE wallet_id = ? ORDER BY created_at DESC`)
      .all(wallet_id);
  }

  static async findById(id) {
    return await walletDB
      .prepare(`SELECT * FROM wallet_networks WHERE id = ?`)
      .get(id);
  }

  static async delete(id) {
    const result = await walletDB.prepare(`DELETE FROM wallet_networks WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}

module.exports = WalletNetworkModel;
