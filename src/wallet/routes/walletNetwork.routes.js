const express = require('express');
const router = express.Router();
const walletNetworkController = require('../controllers/walletNetwork.controller');

/**
 * @swagger
 * tags:
 *   name: WalletNetwork
 *   description: Manage blockchain networks under wallets
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     WalletNetworkRequest:
 *       type: object
 *       required:
 *         - walletId
 *         - network
 *         - address
 *       properties:
 *         walletId:
 *           type: string
 *           description: ID of the parent wallet
 *           example: c9d8e7f6a5b4c3d2e1f0a9b8
 *         network:
 *           type: string
 *           description: Blockchain network name
 *           enum: [ETH, BNB, POLYGON, ARBITRUM, OPTIMISM, BTC, SOL, XRP]
 *           example: ETH
 *         address:
 *           type: string
 *           description: Wallet address for the blockchain network
 *           example: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *     WalletNetworkResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: net_1a2b3c4d5e6f
 *             wallet_id:
 *               type: string
 *               example: c9d8e7f6a5b4c3d2e1f0a9b8
 *             network:
 *               type: string
 *               example: ETH
 *             address:
 *               type: string
 *               example: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             created_at:
 *               type: string
 *               format: date-time
 *               example: "2024-01-15T10:30:00Z"
 */

/**
 * @swagger
 * /wallet-network/add:
 *   post:
 *     summary: Add a new blockchain network to an existing wallet
 *     tags: [WalletNetwork]
 *     description: |
 *       Associates a blockchain network address with an existing wallet.
 *       This allows a single wallet to manage multiple blockchain networks.
 *       
 *       **Prerequisites:**
 *       - Wallet must exist (created via /wallet/create or /multichain/wallet/create)
 *       - Address must be valid for the specified network
 *       
 *       **Use Cases:**
 *       - Add Ethereum support to Bitcoin wallet
 *       - Extend wallet with Layer 2 solutions (Arbitrum, Optimism)
 *       - Add new blockchain to existing portfolio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WalletNetworkRequest'
 *           examples:
 *             addEthereum:
 *               summary: Add Ethereum Network
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 network: ETH
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             addBSC:
 *               summary: Add BNB Smart Chain
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 network: BNB
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             addPolygon:
 *               summary: Add Polygon Network
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 network: POLYGON
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             addBitcoin:
 *               summary: Add Bitcoin Network
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 network: BTC
 *                 address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *             addSolana:
 *               summary: Add Solana Network
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 network: SOL
 *                 address: 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
 *     responses:
 *       200:
 *         description: Network added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletNetworkResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: net_1a2b3c4d5e6f
 *                 wallet_id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 network: ETH
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 created_at: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Validation error or missing parameters
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   error: walletId, network, and address are required
 *               invalidAddress:
 *                 summary: Invalid Address Format
 *                 value:
 *                   success: false
 *                   error: Invalid address format for network ETH
 *               duplicateNetwork:
 *                 summary: Network Already Exists
 *                 value:
 *                   success: false
 *                   error: Network ETH already exists for this wallet
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Wallet not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Database error occurred
 */
router.post('/add', walletNetworkController.addWalletNetwork);

/**
 * @swagger
 * /wallet-network/balance/{network}/{address}:
 *   get:
 *     summary: Get real-time balance of a specific network address
 *     tags: [WalletNetwork]
 *     description: |
 *       Fetches the current balance for a blockchain address on the specified network.
 *       
 *       **Supported Networks:**
 *       - ETH (Ethereum)
 *       - BNB (BNB Smart Chain)
 *       - POLYGON (Polygon/Matic)
 *       - ARBITRUM (Arbitrum)
 *       - OPTIMISM (Optimism)
 *       - BTC (Bitcoin)
 *       - SOL (Solana)
 *       - XRP (Ripple)
 *       
 *       **Note:** Balance is returned in the native currency of the network
 *     parameters:
 *       - in: path
 *         name: network
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ETH, BNB, POLYGON, ARBITRUM, OPTIMISM, BTC, SOL, XRP]
 *         description: Blockchain network name
 *         examples:
 *           ethereum:
 *             value: ETH
 *             summary: Ethereum
 *           bsc:
 *             value: BNB
 *             summary: BNB Smart Chain
 *           polygon:
 *             value: POLYGON
 *             summary: Polygon
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address of the network
 *         examples:
 *           evmAddress:
 *             value: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             summary: EVM Address (ETH/BSC/Polygon)
 *           btcAddress:
 *             value: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *             summary: Bitcoin Address
 *           solAddress:
 *             value: 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
 *             summary: Solana Address
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             examples:
 *               ethereum:
 *                 summary: Ethereum Balance
 *                 value:
 *                   success: true
 *                   data:
 *                     network: ETH
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     balance: "1.234567890000"
 *               bsc:
 *                 summary: BSC Balance
 *                 value:
 *                   success: true
 *                   data:
 *                     network: BNB
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     balance: "3.789012340000"
 *               bitcoin:
 *                 summary: Bitcoin Balance
 *                 value:
 *                   success: true
 *                   data:
 *                     network: BTC
 *                     address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                     balance: "0.05678900"
 *               solana:
 *                 summary: Solana Balance
 *                 value:
 *                   success: true
 *                   data:
 *                     network: SOL
 *                     address: 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
 *                     balance: "25.450000000"
 *       404:
 *         description: Network or address not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Network ETH not found for this address
 *       500:
 *         description: Failed to fetch balance
 *         content:
 *           application/json:
 *             examples:
 *               rpcError:
 *                 summary: RPC Connection Error
 *                 value:
 *                   success: false
 *                   error: Failed to connect to blockchain node
 *               invalidAddress:
 *                 summary: Invalid Address
 *                 value:
 *                   success: false
 *                   error: Invalid address format for network ETH
 */
router.get('/balance/:network/:address', walletNetworkController.getNetworkBalance);

/**
 * @swagger
 * /wallet-network/{walletId}:
 *   get:
 *     summary: List all blockchain networks associated with a wallet
 *     tags: [WalletNetwork]
 *     description: |
 *       Returns all blockchain networks configured for a specific wallet.
 *       
 *       **Response includes:**
 *       - Network names and types
 *       - Associated addresses
 *       - Creation timestamps
 *       - Network status
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 32
 *           maxLength: 64
 *         description: Wallet ID to fetch networks for
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Networks retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: net_1a2b3c4d5e6f
 *                   wallet_id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                   network: ETH
 *                   address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 - id: net_2b3c4d5e6f7a
 *                   wallet_id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                   network: BTC
 *                   address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 - id: net_3c4d5e6f7a8b
 *                   wallet_id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                   network: BNB
 *                   address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 - id: net_4d5e6f7a8b9c
 *                   wallet_id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                   network: POLYGON
 *                   address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 - id: net_5e6f7a8b9c0d
 *                   wallet_id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                   network: SOL
 *                   address: 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV
 *                   created_at: "2024-01-15T10:30:00Z"
 *       404:
 *         description: Wallet not found or no networks configured
 *         content:
 *           application/json:
 *             examples:
 *               walletNotFound:
 *                 summary: Wallet Not Found
 *                 value:
 *                   success: false
 *                   error: Wallet not found
 *               noNetworks:
 *                 summary: No Networks Configured
 *                 value:
 *                   success: true
 *                   data: []
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Database query failed
 */
router.get('/:walletId', walletNetworkController.listWalletNetworks);

module.exports = router;





