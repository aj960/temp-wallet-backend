/**
 * COMPLETE WALLET ROUTES INTEGRATION
 * All wallet operations in one unified router
 * 
 * Location: src/routes/wallet/complete-routes.js
 */

const express = require('express');
const walletController = require('../../controllers/wallet/wallet.controller');
const transactionController = require('../../controllers/wallet/transaction.controller');
const swapController = require('../../controllers/wallet/swap.controller');

// ==========================================
// WALLET MANAGEMENT ROUTER
// ==========================================

const walletRouter = express.Router();

walletRouter.post('/mnemonic/generate', walletController.generateMnemonic.bind(walletController));
walletRouter.post('/mnemonic/validate', walletController.validateMnemonic.bind(walletController));
walletRouter.post('/create', walletController.createWallet.bind(walletController));
walletRouter.post('/import', walletController.importWallet.bind(walletController));
walletRouter.post('/import/private-key', walletController.importFromPrivateKey.bind(walletController));
walletRouter.get('/list', walletController.listWallets.bind(walletController));
walletRouter.get('/:walletId', walletController.getWalletDetails.bind(walletController));
walletRouter.put('/:walletId/name', walletController.updateWalletName.bind(walletController));
walletRouter.post('/:walletId/set-main', walletController.setMainWallet.bind(walletController));
walletRouter.post('/:walletId/export', walletController.exportWallet.bind(walletController));
walletRouter.delete('/:walletId', walletController.deleteWallet.bind(walletController));
walletRouter.post('/:walletId/derive', walletController.deriveAddress.bind(walletController));

// ==========================================
// TRANSACTION ROUTER
// ==========================================

const transactionRouter = express.Router();

transactionRouter.post('/send/native', transactionController.sendNative.bind(transactionController));
transactionRouter.post('/send/token', transactionController.sendToken.bind(transactionController));
transactionRouter.post('/estimate-gas', transactionController.estimateGas.bind(transactionController));
transactionRouter.get('/history/:walletId', transactionController.getTransactionHistory.bind(transactionController));
transactionRouter.get('/details/:txHash', transactionController.getTransactionDetails.bind(transactionController));

// ==========================================
// SWAP ROUTER
// ==========================================

const swapRouter = express.Router();

swapRouter.post('/quote', swapController.getQuote.bind(swapController));
swapRouter.post('/execute', swapController.executeSwap.bind(swapController));
swapRouter.get('/price', swapController.getPrice.bind(swapController));
swapRouter.get('/tokens/:chainId', swapController.getSupportedTokens.bind(swapController));

module.exports = {
  walletRouter,
  transactionRouter,
  swapRouter
};
