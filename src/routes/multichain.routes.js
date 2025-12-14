const express = require('express');
const router = express.Router();
const multichainController = require('../controllers/multichain.controller');
const { validate } = require('../middleware/validation.middleware');
const { validateWalletCreation, validateIdParam, validateWalletIdParam } = require('../utils/validators');
const rateLimiter = require('../security/rate-limiter.service');

// 🆕 Import swap routes
const swapRoutes = require('./multichain-swap.routes');

/**
 * @swagger
 * tags:
 *   - name: MultiChain
 *     description: Multi-blockchain wallet management (BTC, ETH, SOL, XRP, etc.)
 *   - name: MultiChain Swap
 *     description: Decentralized exchange (DEX) operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MultiChainWalletRequest:
 *       type: object
 *       required:
 *         - devicePassCodeId
 *         - walletName
 *         - mnemonic
 *       properties:
 *         devicePassCodeId:
 *           type: string
 *           description: Valid device passcode ID from /device-passcodes endpoint
 *           example: 58e634c7e4f7704f6dfd9018e5bd7726
 *         walletName:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: User-friendly name for the wallet
 *           example: My Multi-Chain Wallet
 *         mnemonic:
 *           type: string
 *           description: 12-word BIP39 mnemonic phrase
 *           example: crane short avocado love outer control dress same myself tiger prevent must
 *         isMain:
 *           type: boolean
 *           default: false
 *           description: Set as main wallet for this device
 *     ChainBalance:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: a7b3c8d9e2f4g5h6i7j8k9l0
 *         chain:
 *           type: string
 *           example: ETHEREUM
 *         symbol:
 *           type: string
 *           example: ETH
 *         balance:
 *           type: string
 *           example: "1.234567890000"
 *         decimals:
 *           type: integer
 *           example: 18
 *         address:
 *           type: string
 *           example: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /multichain/wallet/create:
 *   post:
 *     summary: Create multi-chain wallet (supports ALL chains at once)
 *     tags: [MultiChain]
 *     description: |
 *       Creates wallet addresses for ALL supported blockchains from a single mnemonic.
 *       
 *       **Supported Chains (15+):**
 *       - **EVM Chains:** Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Base
 *       - **UTXO Chains:** Bitcoin, Litecoin, Dogecoin
 *       - **Other Chains:** Solana, XRP, Cosmos, Tron
 *       
 *       **Rate Limiting:** 10 wallets per hour per IP
 *       
 *       **Prerequisites:**
 *       1. Create device passcode first POST /device-passcodes
 *       2. Use the returned serverPasscodeId as devicePassCodeId
 *       3. Generate or import a valid 12-word BIP39 mnemonic
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MultiChainWalletRequest'
 *           examples:
 *             mainWallet:
 *               summary: Create Main Wallet
 *               description: Create a primary wallet with all blockchain support
 *               value:
 *                 devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                 walletName: Main Portfolio
 *                 mnemonic: crane short avocado love outer control dress same myself tiger prevent must
 *                 isMain: true
 *             secondaryWallet:
 *               summary: Create Secondary Wallet
 *               description: Create additional wallet for trading or specific purposes
 *               value:
 *                 devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                 walletName: Trading Wallet
 *                 mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
 *                 isMain: false
 *     responses:
 *       200:
 *         description: Multi-chain wallet created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 walletName: Main Portfolio
 *                 primaryAddress: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                 isMain: true
 *                 supportedChains: 15
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  '/wallet/create',
  rateLimiter.walletCreationLimiter,
  validateWalletCreation,
  validate,
  multichainController.createMultichainWallet  // ✅ FIXED: Changed from createMultiChainWallet to createMultichainWallet
);

/**
 * @swagger
 * /multichain/wallet/{walletId}/balances:
 *   get:
 *     summary: Get balances for ALL chains in wallet
 *     tags: [MultiChain]
 *     description: |
 *       Fetches real-time balances for all blockchain networks in the wallet.
 *       This endpoint queries all supported chains simultaneously.
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID returned from wallet creation
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Balances for all chains
 *       404:
 *         description: Wallet not found
 */
router.get(
  '/wallet/:walletId/balances',
  validateWalletIdParam,
  validate,
  multichainController.getMultiChainBalances
);

/**
 * @swagger
 * /multichain/wallet/{walletId}/chain/{chainId}/balance:
 *   get:
 *     summary: Get balance for specific chain
 *     tags: [MultiChain]
 *     description: Fetch real-time balance for a single blockchain network
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [BITCOIN, ETHEREUM, BSC, POLYGON, SOLANA, RIPPLE, ARBITRUM, OPTIMISM, AVALANCHE, FANTOM, BASE, COSMOS, TRON, LITECOIN, DOGECOIN]
 *         description: Blockchain identifier (case-insensitive)
 *     responses:
 *       200:
 *         description: Chain balance
 *       404:
 *         description: Chain not found
 */
router.get(
  '/wallet/:walletId/chain/:chainId/balance',
  multichainController.getChainBalance
);

/**
 * @swagger
 * /multichain/wallet/{walletId}/chain/{chainId}/address:
 *   get:
 *     summary: Get wallet address for specific chain
 *     tags: [MultiChain]
 *     description: Retrieve the blockchain-specific address for receiving funds
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chain address
 */
router.get(
  '/wallet/:walletId/chain/:chainId/address',
  multichainController.getChainAddress
);

/**
 * @swagger
 * /multichain/wallet/{walletId}/summary:
 *   get:
 *     summary: Get complete wallet summary with all chains and balances
 *     tags: [MultiChain]
 *     description: |
 *       Comprehensive wallet overview including wallet metadata, all blockchain addresses, and real-time balances for all chains
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Complete wallet summary
 */
router.get(
  '/wallet/:walletId/summary',
  validateWalletIdParam,
  validate,
  multichainController.getWalletSummary
);

/**
 * @swagger
 * /multichain/chains:
 *   get:
 *     summary: List all supported blockchain networks
 *     tags: [MultiChain]
 *     description: Returns metadata for all supported blockchains including network details, symbols, and capabilities
 *     responses:
 *       200:
 *         description: List of supported chains
 */
router.get(
  '/chains',
  multichainController.getSupportedChains
);

/**
 * @swagger
 * /multichain/validate-address:
 *   post:
 *     summary: Validate address for any blockchain
 *     tags: [MultiChain]
 *     description: |
 *       Validates if an address is correctly formatted for the specified blockchain.
 *       Useful before sending transactions to prevent errors.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainId
 *               - address
 *             properties:
 *               chainId:
 *                 type: string
 *                 description: Blockchain identifier
 *               address:
 *                 type: string
 *                 description: Address to validate
 *     responses:
 *       200:
 *         description: Validation result
 */
router.post(
  '/validate-address',
  multichainController.validateChainAddress
);

/**
 * @swagger
 * /multichain/wallet/add-chain:
 *   post:
 *     summary: Add single blockchain to existing wallet
 *     tags: [MultiChain]
 *     description: |
 *       Adds support for an additional blockchain to an existing wallet.
 *       Uses the wallet's existing mnemonic to derive the new chain address.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *             properties:
 *               walletId:
 *                 type: string
 *                 description: Existing wallet ID
 *               chainId:
 *                 type: string
 *                 description: Blockchain to add
 *     responses:
 *       200:
 *         description: Chain added successfully
 *       400:
 *         description: Chain already exists or not supported
 */
router.post(
  '/wallet/add-chain',
  multichainController.addChainToWallet
);

/**
 * @swagger
 * /multichain/wallet/{walletId}/chain/{chainId}:
 *   delete:
 *     summary: Remove blockchain from wallet
 *     tags: [MultiChain]
 *     description: |
 *       Removes a blockchain network from the wallet.
 *       **Warning:** This only removes the database entry. The blockchain address remains valid on-chain.
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *         example: DOGECOIN
 *     responses:
 *       200:
 *         description: Chain removed successfully
 *       404:
 *         description: Chain not found
 */
router.delete(
  '/wallet/:walletId/chain/:chainId',
  multichainController.removeChainFromWallet
);

// 🆕 MOUNT SWAP ROUTES
// All routes defined in multichain-swap.routes will be prefixed with /swap
router.use('/swap', swapRoutes);

module.exports = router;

