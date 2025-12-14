/**
 * Repository Index - Central export for all repositories
 * Location: src/repositories/index.js
 */

const walletRepository = require('./wallet.repository');
const transactionRepository = require('./transaction.repository');

module.exports = {
  walletRepository,
  transactionRepository
};


