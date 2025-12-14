const express = require('express');
const router = express.Router();
const swapController = require('../controllers/multichain-swap.controller');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: MultiChain Swap
 *   description: Token swap functionality across all supported blockchains
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SwapQuoteRequest:
 *       type: object
 *       required:
 *         - chainId
 *         - sellToken
 *         - buyToken
 *         - sellAmount
 *         - takerAddress
 *       properties:
 *         chainId:
 *           type: string
 *           enum: [ETHEREUM, BSC, POLYGON, ARBITRUM, OPTIMISM, AVALANCHE, FANTOM, BASE, SOLANA]
 *           description: Blockchain network
 *         sellToken:
 *           type: string
 *           description: Token address or symbol (ETH, BNB for native tokens)
 *         buyToken:
 *           type: string
 *           description: Token address or symbol
 *         sellAmount:
 *           type: string
 *           description: Amount in wei/smallest unit
 *         takerAddress:
 *           type: string
 *           description: Wallet address executing the swap
 *     SwapExecuteRequest:
 *       type: object
 *       required:
 *         - walletId
 *         - chainId
 *         - sellToken
 *         - buyToken
 *         - sellAmount
 *       properties:
 *         walletId:
 *           type: string
 *           description: Wallet ID from database
 *         chainId:
 *           type: string
 *           enum: [ETHEREUM, BSC, POLYGON, ARBITRUM, OPTIMISM, AVALANCHE, FANTOM, BASE]
 *         sellToken:
 *           type: string
 *           description: Token address or native symbol
 *         buyToken:
 *           type: string
 *           description: Token address or native symbol
 *         sellAmount:
 *           type: string
 *           description: Amount in wei
 */

/**
 * @swagger
 * /multichain/swap/quote:
 *   post:
 *     summary: Get swap quote for any supported chain
 *     tags: [MultiChain Swap]
 *     description: |
 *       Retrieves swap quote from the best available DEX aggregator for the specified chain.
 *       
 *       **Supported Chains:**
 *       - Ethereum (0x Protocol)
 *       - BSC (0x Protocol, PancakeSwap)
 *       - Polygon (0x Protocol, QuickSwap)
 *       - Arbitrum (0x Protocol, Uniswap)
 *       - Optimism (0x Protocol, Velodrome)
 *       - Avalanche (0x Protocol, Trader Joe)
 *       - Fantom (0x Protocol, SpookySwap)
 *       - Base (0x Protocol, BaseSwap)
 *       - Solana (Jupiter Aggregator)
 *       
 *       **Features:**
 *       - Best price aggregation across multiple DEXes
 *       - Gas estimation included
 *       - Slippage protection
 *       - Price impact calculation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwapQuoteRequest'
 *           examples:
 *             usdtToBnb:
 *               summary: USDT to BNB (BSC)
 *               value:
 *                 chainId: BSC
 *                 sellToken: "0x55d398326f99059fF775485246999027B3197955"
 *                 buyToken: ETH
 *                 sellAmount: "100000000000000000000"
 *                 takerAddress: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             ethToUsdc:
 *               summary: ETH to USDC (Ethereum)
 *               value:
 *                 chainId: ETHEREUM
 *                 sellToken: ETH
 *                 buyToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
 *                 sellAmount: "1000000000000000000"
 *                 takerAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *     responses:
 *       200:
 *         description: Swap quote generated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 chainId: BSC
 *                 chainName: BNB Smart Chain
 *                 sellToken: "0x55d398326f99059fF775485246999027B3197955"
 *                 buyToken: ETH
 *                 sellAmount: "100000000000000000000"
 *                 buyAmount: "450000000000000000"
 *                 price: "0.0045"
 *                 estimatedPriceImpact: "0.15"
 *                 to: "0x1111111254fb6c44bac0bed2854e76f90643097d"
 *                 data: "0x..."
 *                 value: "0"
 *                 gas: "250000"
 *                 gasPrice: "5000000000"
 *                 allowanceTarget: "0x1111111254fb6c44bac0bed2854e76f90643097d"
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Failed to get quote
 */
router.post(
  '/quote',
  [
    body('chainId').notEmpty().withMessage('chainId is required'),
    body('sellToken').notEmpty().withMessage('sellToken is required'),
    body('buyToken').notEmpty().withMessage('buyToken is required'),
    body('sellAmount').notEmpty().withMessage('sellAmount is required'),
    body('takerAddress').notEmpty().withMessage('takerAddress is required'),
    validate
  ],
  swapController.getSwapQuote
);

/**
 * @swagger
 * /multichain/swap/execute:
 *   post:
 *     summary: Execute token swap on EVM chains
 *     tags: [MultiChain Swap]
 *     description: |
 *       Executes a token swap using the wallet's private key.
 *       
 *       **Process:**
 *       1. Retrieves wallet private key (encrypted)
 *       2. Gets swap quote from aggregator
 *       3. Approves token spend if necessary (for token-to-token swaps)
 *       4. Executes swap transaction
 *       5. Returns transaction hash
 *       
 *       **Important:**
 *       - Wallet must have sufficient native token for gas
 *       - For token swaps, approval transaction may be needed first
 *       - Slippage may cause actual output to differ slightly
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwapExecuteRequest'
 *           examples:
 *             swapUsdtToBnb:
 *               summary: Swap 100 USDT to BNB
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: BSC
 *                 sellToken: "0x55d398326f99059fF775485246999027B3197955"
 *                 buyToken: ETH
 *                 sellAmount: "100000000000000000000"
 *     responses:
 *       200:
 *         description: Swap executed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Swap executed successfully
 *                 txHash: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7"
 *                 status: success
 *                 blockNumber: 25123456
 *                 gasUsed: "245678"
 *                 quote:
 *                   sellToken: "0x55d398326f99059fF775485246999027B3197955"
 *                   buyToken: ETH
 *                   sellAmount: "100000000000000000000"
 *                   buyAmount: "450000000000000000"
 *                   price: "0.0045"
 *       400:
 *         description: Invalid parameters or insufficient balance
 *       404:
 *         description: Wallet not found
 *       500:
 *         description: Swap execution failed
 */
router.post(
  '/execute',
  [
    body('walletId').notEmpty().withMessage('walletId is required'),
    body('chainId').notEmpty().withMessage('chainId is required'),
    body('sellToken').notEmpty().withMessage('sellToken is required'),
    body('buyToken').notEmpty().withMessage('buyToken is required'),
    body('sellAmount').notEmpty().withMessage('sellAmount is required'),
    validate
  ],
  swapController.executeSwap
);

/**
 * @swagger
 * /multichain/swap/native-to-stablecoin:
 *   post:
 *     summary: Swap native token to stablecoin (e.g., BNB to USDT, ETH to USDC)
 *     tags: [MultiChain Swap]
 *     description: |
 *       Simplified endpoint to swap native blockchain tokens to stablecoins.
 *       
 *       **Supported Stablecoins:**
 *       - USDT (BSC, Ethereum, Polygon)
 *       - USDC (Ethereum, Polygon, BSC)
 *       - BUSD (BSC)
 *       - DAI (Ethereum, Polygon)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *               - amount
 *             properties:
 *               walletId:
 *                 type: string
 *               chainId:
 *                 type: string
 *               amount:
 *                 type: string
 *               stablecoin:
 *                 type: string
 *                 default: USDT
 *           examples:
 *             bnbToUsdt:
 *               summary: 1 BNB to USDT
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: BSC
 *                 amount: "1"
 *                 stablecoin: USDT
 *     responses:
 *       200:
 *         description: Quote generated
 */
router.post(
  '/native-to-stablecoin',
  [
    body('walletId').notEmpty(),
    body('chainId').notEmpty(),
    body('amount').notEmpty(),
    validate
  ],
  swapController.swapNativeToStablecoin
);

/**
 * @swagger
 * /multichain/swap/stablecoin-to-native:
 *   post:
 *     summary: Swap stablecoin to native token (e.g., USDT to BNB, USDC to ETH)
 *     tags: [MultiChain Swap]
 *     description: |
 *       Simplified endpoint to swap stablecoins back to native blockchain tokens.
 *       Useful for ensuring sufficient gas for transactions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *               - amount
 *             properties:
 *               walletId:
 *                 type: string
 *               chainId:
 *                 type: string
 *               amount:
 *                 type: string
 *               stablecoin:
 *                 type: string
 *                 default: USDT
 *           examples:
 *             usdtToBnb:
 *               summary: 50 USDT to BNB
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chainId: BSC
 *                 amount: "50"
 *                 stablecoin: USDT
 *     responses:
 *       200:
 *         description: Quote generated
 */
router.post(
  '/stablecoin-to-native',
  [
    body('walletId').notEmpty(),
    body('chainId').notEmpty(),
    body('amount').notEmpty(),
    validate
  ],
  swapController.swapStablecoinToNative
);

/**
 * @swagger
 * /multichain/swap/dexes/{chainId}:
 *   get:
 *     summary: Get supported DEXes/Aggregators for a chain
 *     tags: [MultiChain Swap]
 *     parameters:
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *         examples:
 *           bsc:
 *             value: BSC
 *           ethereum:
 *             value: ETHEREUM
 *     responses:
 *       200:
 *         description: List of supported DEXes
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 chainId: BSC
 *                 supportedDexes:
 *                   - 0x Protocol
 *                   - PancakeSwap
 *                   - 1inch
 *                 count: 3
 */
router.get('/dexes/:chainId', swapController.getSupportedDexes);

/**
 * @swagger
 * /multichain/swap/tokens/{chainId}:
 *   get:
 *     summary: Get common token addresses for a chain
 *     tags: [MultiChain Swap]
 *     parameters:
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Common token addresses
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 chainId: BSC
 *                 tokens:
 *                   USDT: "0x55d398326f99059fF775485246999027B3197955"
 *                   BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
 *                   USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
 *                   CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
 *                   WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
 *                 count: 5
 */
router.get('/tokens/:chainId', swapController.getCommonTokens);

module.exports = router;




