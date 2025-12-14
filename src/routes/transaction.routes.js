const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { validate } = require('../middleware/validation.middleware');
const { body, param, query } = require('express-validator');
const rateLimiter = require('../security/rate-limiter.service');

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Send and receive cryptocurrency on all supported blockchains
 */

/**
 * @swagger
 * /transactions/send:
 *   post:
 *     summary: Send cryptocurrency (Universal endpoint for all chains)
 *     tags: [Transactions]
 *     description: |
 *       **Universal send endpoint supporting ALL blockchains**
 *       
 *       Sends native tokens or tokens on any supported blockchain.
 *       
 *       **Supported Chains:**
 *       - EVM: Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Base
 *       - UTXO: Bitcoin, Litecoin, Dogecoin
 *       - Other: Solana, XRP, Cosmos, Tron
 *       
 *       **Security:**
 *       - Private keys are decrypted only for transaction signing
 *       - All transactions are logged and audited
 *       - Rate limited to prevent abuse
 *       - Gas estimation included
 *       
 *       **Rate Limiting:** 20 transactions per 10 minutes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *               - to
 *               - amount
 *             properties:
 *               walletId:
 *                 type: string
 *                 description: Wallet ID from database
 *               chainId:
 *                 type: string
 *                 enum: [ETHEREUM, BSC, POLYGON, BITCOIN, SOLANA, ARBITRUM, OPTIMISM, AVALANCHE]
 *               to:
 *                 type: string
 *                 description: Recipient address
 *               amount:
 *                 type: string
 *                 description: Amount to send (in native currency or token)
 *               tokenAddress:
 *                 type: string
 *                 description: Token contract address (optional, for ERC-20/BEP-20 tokens)
 *               memo:
 *                 type: string
 *                 description: Transaction memo/note (optional, chain-dependent)
 *           examples:
 *             sendETH:
 *               summary: Send 0.5 ETH on Ethereum
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: ETHEREUM
 *                 to: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 amount: "0.5"
 *             sendBNB:
 *               summary: Send 1 BNB on BSC
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: BSC
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: "1.0"
 *             sendUSDT:
 *               summary: Send 100 USDT (BEP-20) on BSC
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: BSC
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: "100"
 *                 tokenAddress: "0x55d398326f99059fF775485246999027B3197955"
 *             sendBTC:
 *               summary: Send 0.01 BTC
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: BITCOIN
 *                 to: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                 amount: "0.01"
 *             sendSOL:
 *               summary: Send 5 SOL on Solana
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: SOLANA
 *                 to: 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
 *                 amount: "5.0"
 *     responses:
 *       200:
 *         description: Transaction sent successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Transaction sent successfully
 *                 txHash: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7"
 *                 from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: "0.5"
 *                 chain: ETHEREUM
 *                 explorerUrl: https://etherscan.io/tx/0x9e8d7c6b...
 *                 gasUsed: "21000"
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Wallet not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Transaction failed
 */
router.post(
  '/send',
  rateLimiter.transactionLimiter,
  [
    body('walletId').notEmpty().withMessage('walletId is required'),
    body('chainId').notEmpty().withMessage('chainId is required'),
    body('to').notEmpty().withMessage('recipient address is required'),
    body('amount').notEmpty().withMessage('amount is required'),
    body('tokenAddress').optional().isString(),
    body('memo').optional().isString(),
    validate
  ],
  transactionController.sendTransaction
);

/**
 * @swagger
 * /transactions/receive/{walletId}/{chainId}:
 *   get:
 *     summary: Get receive address for a specific blockchain
 *     tags: [Transactions]
 *     description: |
 *       Returns the wallet address for receiving funds on a specific blockchain.
 *       
 *       **Response includes:**
 *       - Wallet address
 *       - QR code URL for easy sharing
 *       - Chain-specific warnings
 *       - Network information
 *       
 *       **Use Cases:**
 *       - Display receive address in mobile app
 *       - Generate QR code for payments
 *       - Share address with others
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ETHEREUM, BSC, POLYGON, BITCOIN, SOLANA, ARBITRUM, OPTIMISM]
 *         description: Blockchain identifier
 *         examples:
 *           ethereum:
 *             value: ETHEREUM
 *           bsc:
 *             value: BSC
 *           bitcoin:
 *             value: BITCOIN
 *     responses:
 *       200:
 *         description: Receive address details
 *         content:
 *           application/json:
 *             examples:
 *               ethereum:
 *                 summary: Ethereum Receive Address
 *                 value:
 *                   success: true
 *                   data:
 *                     walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     chain: ETHEREUM
 *                     chainName: Ethereum
 *                     symbol: ETH
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     qrCode: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=0x742d35Cc...
 *                     message: Share this address to receive funds
 *                     warning: Only send ETH to this address
 *               bitcoin:
 *                 summary: Bitcoin Receive Address
 *                 value:
 *                   success: true
 *                   data:
 *                     walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     chain: BITCOIN
 *                     chainName: Bitcoin
 *                     symbol: BTC
 *                     address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                     qrCode: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=bc1qxy...
 *                     message: Share this address to receive funds
 *                     warning: Only send BTC to this address
 *       404:
 *         description: Wallet or chain not found
 */
router.get(
  '/receive/:walletId/:chainId',
  [
    param('walletId').notEmpty().withMessage('walletId is required'),
    param('chainId').notEmpty().withMessage('chainId is required'),
    validate
  ],
  transactionController.getReceiveAddress
);

/**
 * @swagger
 * /transactions/history/{walletId}/{chainId}:
 *   get:
 *     summary: Get transaction history for a wallet on specific chain
 *     tags: [Transactions]
 *     description: |
 *       Fetches transaction history from blockchain explorer APIs.
 *       
 *       **Data Sources:**
 *       - Etherscan for Ethereum
 *       - BscScan for BSC
 *       - PolygonScan for Polygon
 *       - Blockchain.info for Bitcoin
 *       - Solscan for Solana
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Transaction history
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: ETHEREUM
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 page: 1
 *                 pageSize: 20
 *                 transactions:
 *                   - hash: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b..."
 *                     from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                     value: "0.5"
 *                     timestamp: 1705920000
 *                     blockNumber: 19234567
 *                     status: success
 *                     gasUsed: "21000"
 *                     gasPrice: "25.5"
 */
router.get(
  '/history/:walletId/:chainId',
  [
    param('walletId').notEmpty(),
    param('chainId').notEmpty(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  transactionController.getTransactionHistory
);

/**
 * @swagger
 * /transactions/estimate-fee:
 *   post:
 *     summary: Estimate transaction gas/fee
 *     tags: [Transactions]
 *     description: |
 *       Estimates the transaction fee before sending.
 *       
 *       **Use Cases:**
 *       - Display fee to user before confirmation
 *       - Check if wallet has sufficient balance for gas
 *       - Compare fees across different times
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainId
 *               - to
 *               - amount
 *             properties:
 *               chainId:
 *                 type: string
 *               to:
 *                 type: string
 *               amount:
 *                 type: string
 *               tokenAddress:
 *                 type: string
 *           examples:
 *             ethTransfer:
 *               summary: Estimate ETH Transfer Fee
 *               value:
 *                 chainId: ETHEREUM
 *                 to: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 amount: "0.5"
 *             tokenTransfer:
 *               summary: Estimate USDT Transfer Fee
 *               value:
 *                 chainId: BSC
 *                 to: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 amount: "100"
 *                 tokenAddress: "0x55d398326f99059fF775485246999027B3197955"
 *     responses:
 *       200:
 *         description: Fee estimation
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 chain: ETHEREUM
 *                 gasPrice: "25.5"
 *                 gasLimit: "21000"
 *                 estimatedFee: "0.0005355"
 *                 estimatedFeeUSD: null
 *                 currency: ETH
 */
router.post(
  '/estimate-fee',
  [
    body('chainId').notEmpty(),
    body('to').notEmpty(),
    body('amount').notEmpty(),
    body('tokenAddress').optional().isString(),
    validate
  ],
  transactionController.estimateTransactionFee
);

/**
 * @swagger
 * /transactions/validate-address:
 *   post:
 *     summary: Validate blockchain address
 *     tags: [Transactions]
 *     description: |
 *       Validates if an address is correctly formatted for a specific blockchain.
 *       
 *       **Use Cases:**
 *       - Validate address before sending
 *       - Prevent user errors
 *       - Check address format
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
 *               address:
 *                 type: string
 *           examples:
 *             validEth:
 *               summary: Valid Ethereum Address
 *               value:
 *                 chainId: ETHEREUM
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             invalidEth:
 *               summary: Invalid Ethereum Address
 *               value:
 *                 chainId: ETHEREUM
 *                 address: "0xinvalid"
 *             validBtc:
 *               summary: Valid Bitcoin Address
 *               value:
 *                 chainId: BITCOIN
 *                 address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             examples:
 *               valid:
 *                 summary: Valid Address
 *                 value:
 *                   success: true
 *                   data:
 *                     chainId: ETHEREUM
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     isValid: true
 *                     addressType: EVM
 *               invalid:
 *                 summary: Invalid Address
 *                 value:
 *                   success: true
 *                   data:
 *                     chainId: ETHEREUM
 *                     address: "0xinvalid"
 *                     isValid: false
 *                     addressType: null
 */
router.post(
  '/validate-address',
  [
    body('chainId').notEmpty(),
    body('address').notEmpty(),
    validate
  ],
  transactionController.validateAddress
);

module.exports = router;




