/**
 * Balance Routes
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Fetch native and token balances via PublicNode (free, no API keys)
 * - All balance queries now use PublicNode RPC endpoints
 * - Automatic failover to Ankr backup if needed
 */

const express = require('express');
const router = express.Router();
const { getNativeBalance, getTokenBalance } = require('../controller/balance.controller'); // ✅ Updated import

/**
 * @swagger
 * tags:
 *   name: BSC Balance
 *   description: Fetch native and token balances via PublicNode (FREE RPC)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     NativeBalanceRequest:
 *       type: object
 *       required:
 *         - address
 *       properties:
 *         address:
 *           type: string
 *           description: Wallet address (EVM compatible)
 *           example: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *         chainId:
 *           type: string
 *           description: Chain identifier (optional, defaults to 'bsc')
 *           example: bsc
 *     TokenBalanceRequest:
 *       type: object
 *       required:
 *         - address
 *         - tokenAddress
 *       properties:
 *         address:
 *           type: string
 *           description: Wallet address
 *           example: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *         tokenAddress:
 *           type: string
 *           description: ERC20/BEP20 token contract address
 *           example: "0x55d398326f99059fF775485246999027B3197955"
 *         chainId:
 *           type: string
 *           description: Chain identifier (optional, defaults to 'bsc')
 *           example: bsc
 */

/**
 * @swagger
 * /bsc/balance/native:
 *   post:
 *     summary: Get native coin balance (BNB, ETH, MATIC, etc.) via PublicNode
 *     tags: [BSC Balance]
 *     description: |
 *       Fetches the native cryptocurrency balance for an address on any supported EVM chain.
 *       
 *       **✅ NOW USING PUBLICNODE:**
 *       - 100% FREE (no API keys needed)
 *       - 1M requests/day per IP
 *       - Automatic failover to Ankr backup
 *       - 99.99% uptime guarantee
 *       
 *       **Supported Networks:**
 *       - BNB Smart Chain (BNB)
 *       - Ethereum (ETH)
 *       - Polygon (MATIC)
 *       - Arbitrum (ETH)
 *       - Optimism (ETH)
 *       - Avalanche (AVAX)
 *       - Base (ETH)
 *       - Fantom (FTM)
 *       
 *       **Use Cases:**
 *       - Check wallet balance before transactions
 *       - Verify gas availability
 *       - Portfolio balance tracking
 *       
 *       **Note:** Balance returned in human-readable format (e.g., 1.234567890000)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NativeBalanceRequest'
 *           examples:
 *             bscWallet:
 *               summary: BSC Wallet Balance (via PublicNode)
 *               description: Check BNB balance using PublicNode free RPC
 *               value:
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 chainId: bsc
 *             ethWallet:
 *               summary: Ethereum Wallet Balance (via PublicNode)
 *               description: Check ETH balance using PublicNode free RPC
 *               value:
 *                 address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 chainId: ethereum
 *             polygonWallet:
 *               summary: Polygon Wallet Balance (via PublicNode)
 *               value:
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 chainId: polygon
 *     responses:
 *       200:
 *         description: Native balance retrieved successfully via PublicNode
 *         content:
 *           application/json:
 *             examples:
 *               withBalance:
 *                 summary: Wallet with Balance
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     balance: 3.789012340000
 *                     chainId: bsc
 *                     rpcProvider: PublicNode
 *               emptyWallet:
 *                 summary: Empty Wallet
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x0000000000000000000000000000000000000000"
 *                     balance: 0
 *                     chainId: bsc
 *                     rpcProvider: PublicNode
 *       400:
 *         description: Missing or invalid address
 *       500:
 *         description: PublicNode provider failure (automatic failover to Ankr)
 */
router.post('/native', getNativeBalance);

/**
 * @swagger
 * /bsc/balance/token:
 *   post:
 *     summary: Get ERC20/BEP20 token balance via PublicNode (FREE)
 *     tags: [BSC Balance]
 *     description: |
 *       Fetches the balance of any ERC20/BEP20 token using PublicNode free RPC.
 *       
 *       **✅ NOW USING PUBLICNODE:**
 *       - No API keys required
 *       - Free unlimited access (1M req/day soft limit)
 *       - Automatic failover support
 *       - Multi-chain support (BSC, Ethereum, Polygon, etc.)
 *       
 *       **Common Token Addresses (BSC):**
 *       - USDT: 0x55d398326f99059fF775485246999027B3197955
 *       - BUSD: 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56
 *       - CAKE: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
 *       - USDC: 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
 *       
 *       **Common Token Addresses (Ethereum):**
 *       - USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
 *       - USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *       - DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F
 *       
 *       **Features:**
 *       - Automatic decimal handling
 *       - Token symbol retrieval
 *       - Human-readable balance format
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenBalanceRequest'
 *           examples:
 *             usdtBSC:
 *               summary: USDT Balance (BSC via PublicNode)
 *               description: Check USDT balance using PublicNode free RPC
 *               value:
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 tokenAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                 chainId: bsc
 *             usdtETH:
 *               summary: USDT Balance (Ethereum via PublicNode)
 *               description: Check USDT balance on Ethereum using PublicNode
 *               value:
 *                 address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
 *                 chainId: ethereum
 *     responses:
 *       200:
 *         description: Token balance retrieved successfully via PublicNode
 *         content:
 *           application/json:
 *             examples:
 *               usdtBalance:
 *                 summary: USDT Balance (BSC)
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     token: USDT
 *                     balance: 1250.50
 *                     tokenAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                     chainId: bsc
 *                     rpcProvider: PublicNode
 *       400:
 *         description: Missing address or tokenAddress
 *       500:
 *         description: Failed to fetch token balance (automatic failover to Ankr)
 */
router.post('/token', getTokenBalance);

module.exports = router;





