const express = require('express');
const router = express.Router();
const {
  generateMnemonic,
  validateMnemonic,
  createWallet,
  deriveWallet,
  recoverWallet
} = require('../controller/wallet.controller');

/**
 * @swagger
 * tags:
 *   name: QuickNode Wallet
 *   description: Wallet generation, validation and recovery
 */

/**
 * @swagger
 * /quicknode/wallet/mnemonic:
 *   get:
 *     summary: Generate a new 12-word mnemonic phrase
 *     tags: [QuickNode Wallet]
 *     responses:
 *       200:
 *         description: Mnemonic generated successfully
 */

/**
 * @swagger
 * /quicknode/wallet/validate:
 *   post:
 *     summary: Validate a mnemonic phrase
 *     tags: [QuickNode Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mnemonic:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation result
 */

/**
 * @swagger
 * /quicknode/wallet/create:
 *   post:
 *     summary: Create a wallet from a mnemonic
 *     tags: [QuickNode Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mnemonic:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet created successfully
 */

/**
 * @swagger
 * /quicknode/wallet/derive:
 *   post:
 *     summary: Derive child wallet using custom derivation path
 *     tags: [QuickNode Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mnemonic:
 *                 type: string
 *               derivationPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Derived wallet address returned
 */

/**
 * @swagger
 * /quicknode/wallet/recover:
 *   post:
 *     summary: Recover wallet using mnemonic
 *     tags: [QuickNode Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mnemonic:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet recovered successfully
 */

router.get('/mnemonic', generateMnemonic);
router.post('/validate', validateMnemonic);
router.post('/create', createWallet);
router.post('/derive', deriveWallet);
router.post('/recover', recoverWallet);

module.exports = router;
