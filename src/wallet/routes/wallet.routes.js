const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { validate } = require('../../middleware/validation.middleware');
const { 
  validateWalletCreation, 
  validateIdParam,
  validateDevicePassCodeIdParam,  // ✅ Import the new validator
  validateWalletIdParam 
} = require('../../utils/validators');
const rateLimiter = require('../../security/rate-limiter.service');

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Secure wallet management with validation
 */

/**
 * @swagger
 * /wallet/create:
 *   post:
 *     summary: Create a new wallet (Rate limited)
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - devicePassCodeId
 *               - walletName
 *               - mnemonic
 *             properties:
 *               devicePassCodeId:
 *                 type: string
 *                 minLength: 32
 *                 maxLength: 64
 *                 example: "58e634c7e4f7704f6dfd9018e5bd7726"
 *               walletName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 pattern: '^[a-zA-Z0-9\s\-_]+$'
 *                 example: "Main Wallet"
 *               mnemonic:
 *                 type: string
 *                 example: "crane short avocado love outer control dress same myself tiger prevent must"
 *               isMain:
 *                 type: boolean
 *                 default: false
 *               isSingleCoin:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Wallet created successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post(
  '/create',
  rateLimiter.walletCreationLimiter,
  validateWalletCreation,
  validate,
  walletController.createWallet
);

/**
 * @swagger
 * /wallet/device/{devicePassCodeId}:
 *   get:
 *     summary: Get all wallets for a device
 *     tags: [Wallet]
 *     parameters:
 *       - in: path
 *         name: devicePassCodeId
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 32
 *           maxLength: 64
 *         description: Device passcode ID
 *     responses:
 *       200:
 *         description: List of wallets
 *       400:
 *         description: Invalid device ID
 *       404:
 *         description: Device not found
 */
router.get(
  '/device/:devicePassCodeId',
  validateDevicePassCodeIdParam,  // ✅ Use the correct validator
  validate,
  walletController.listWalletsByDevice
);

/**
 * @swagger
 * /wallet/{walletId}:
 *   get:
 *     summary: Get wallet details
 *     tags: [Wallet]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet details
 *       404:
 *         description: Wallet not found
 */
router.get(
  '/:walletId',
  validateWalletIdParam,  // ✅ Use wallet-specific validator
  validate,
  walletController.getWalletDetails
);

/**
 * @swagger
 * /wallet:
 *   get:
 *     summary: List all wallets (Admin/Debug)
 *     tags: [Wallet]
 *     responses:
 *       200:
 *         description: All wallets
 */
router.get('/', walletController.listAllWallets);

/**
 * @swagger
 * /wallet/{walletId}/credentials:
 *   get:
 *     summary: Get wallet credentials (public data only)
 *     tags: [Wallet]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet credentials (safe)
 *       404:
 *         description: Credentials not found
 */
router.get(
  '/:walletId/credentials',
  validateWalletIdParam,  // ✅ Use wallet-specific validator
  validate,
  walletController.getWalletCredentialsSafe
);

/**
 * @swagger
 * /wallet/set-main:
 *   post:
 *     summary: Set main wallet for device
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - devicePassCodeId
 *               - walletId
 *             properties:
 *               devicePassCodeId:
 *                 type: string
 *               walletId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Main wallet updated
 *       400:
 *         description: Validation error
 */
router.post(
  '/set-main',
  walletController.setMainWallet
);

module.exports = router;