// src/wallet/models/wallet.model.js
const db = require('../db');
const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

class WalletModel {
  static create({ name, passcode }) {
    // Mark old wallets for the same device as obsolete
    db.prepare(`UPDATE wallets SET is_old = 1 WHERE name = ?`).run(name);

    const id = generateId();
    db.prepare(`
      INSERT INTO wallets (id, name, passcode, is_old, is_biometric_enabled)
      VALUES (?, ?, ?, 0, 0)
    `).run(id, name, passcode);

    return { id, name };
  }

  static findAll() {
    return db.prepare(`SELECT * FROM wallets ORDER BY created_at DESC`).all();
  }

  static findById(id) {
    return db.prepare(`SELECT * FROM wallets WHERE id = ?`).get(id);
  }

  static findActiveByName(name) {
    return db.prepare(`
      SELECT * FROM wallets WHERE name = ? AND is_old = 0
    `).get(name);
  }

  static update(id, { name, passcode, isBiometricEnabled }) {
    let updates = [];
    let params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (passcode) { updates.push('passcode = ?'); params.push(passcode); }
    if (isBiometricEnabled !== undefined) { 
      updates.push('is_biometric_enabled = ?'); 
      params.push(isBiometricEnabled ? 1 : 0); 
    }

    if (updates.length === 0) return false;

    const query = `UPDATE wallets SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);
    const result = db.prepare(query).run(...params);
    return result.changes > 0;
  }

  static delete(id) {
    return db.prepare(`DELETE FROM wallets WHERE id = ?`).run(id).changes > 0;
  }

  static updateBiometric(name, isEnabled) {
    const result = db.prepare(`
      UPDATE wallets SET is_biometric_enabled = ? 
      WHERE name = ? AND is_old = 0
    `).run(isEnabled ? 1 : 0, name);
    return result.changes > 0;
  }
}

module.exports = WalletModel;
