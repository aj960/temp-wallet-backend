const express = require('express');
const router = express.Router();
const marketController = require('../controllers/market.controller');
const { validate } = require('../middleware/validation.middleware');
const { query, param } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: Market
 *   description: Cryptocurrency market data, prices, and trends
 */

/**
 * @swagger
 * /market/home:
 *   get:
 *     summary: Get all home screen data (mobile optimized)
 *     tags: [Market]
 *     description: |
 *       **Single endpoint for mobile app home screen**
 *       
 *       Returns all necessary data for home screen in one request:
 *       - Market overview (total market cap, volume, BTC dominance)
 *       - Trending tokens (top 10 by 24h performance)
 *       - Top earning opportunities (staking, yield farming)
 *       - Top gainers and losers (5 each)
 *       - Meme coins / high volatility tokens
 *       
 *       **Data Sources:**
 *       - CoinCap API (free, unlimited)
 *       - Cosmos RPC (free)
 *       - Juno RPC (free)
 *       - Stargaze RPC (free)
 *     responses:
 *       200:
 *         description: Home screen data
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 overview:
 *                   totalMarketCapUsd: 2450000000000
 *                   totalVolume24hUsd: 85000000000
 *                   gainers: 28
 *                   losers: 22
 *                   totalAssets: 50
 *                   btcDominance: 52.3
 *                   timestamp: 1705920000000
 *                 trending:
 *                   tokens:
 *                     - id: bitcoin
 *                       symbol: BTC
 *                       name: Bitcoin
 *                       rank: 1
 *                       priceUsd: 89626.45
 *                       changePercent24Hr: -2.53
 *                       marketCapUsd: 1780000000000
 *                     - id: ethereum
 *                       symbol: ETH
 *                       name: Ethereum
 *                       rank: 2
 *                       priceUsd: 3037.89
 *                       changePercent24Hr: -3.74
 *                       marketCapUsd: 366000000000
 *                 earning:
 *                   opportunities:
 *                     - chain: stargaze
 *                       chainName: Stargaze
 *                       symbol: STARS
 *                       apr: 26.01
 *                       type: native_staking
 *                     - chain: juno
 *                       chainName: Juno Network
 *                       symbol: JUNO
 *                       apr: 22.96
 *                       type: native_staking
 *                 gainers:
 *                   - id: some-token
 *                     symbol: TOKEN
 *                     name: Some Token
 *                     priceUsd: 0.15
 *                     changePercent24Hr: 45.67
 *                 losers:
 *                   - id: another-token
 *                     symbol: ATOKEN
 *                     name: Another Token
 *                     priceUsd: 1.23
 *                     changePercent24Hr: -25.34
 *                 memeCoins:
 *                   tokens:
 *                     - id: meme-coin
 *                       symbol: MEME
 *                       name: Meme Coin
 *                       priceUsd: 0.0001
 *                       changePercent24Hr: 123.45
 *                 timestamp: "2024-01-15T10:30:00.000Z"
 */
router.get('/home', marketController.getHomeScreenData);

/**
 * @swagger
 * /market/overview:
 *   get:
 *     summary: Get market overview statistics
 *     tags: [Market]
 *     description: |
 *       Returns global cryptocurrency market statistics
 *       
 *       **Includes:**
 *       - Total market capitalization
 *       - 24h trading volume
 *       - Number of gainers vs losers
 *       - Bitcoin dominance
 *     responses:
 *       200:
 *         description: Market overview
 */
router.get('/overview', marketController.getMarketOverview);

/**
 * @swagger
 * /market/trending:
 *   get:
 *     summary: Get trending tokens
 *     tags: [Market]
 *     description: |
 *       Returns tokens with highest 24h trading volume and price movement
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of tokens to return
 *     responses:
 *       200:
 *         description: Trending tokens
 */
router.get(
  '/trending',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  marketController.getTrendingTokens
);

/**
 * @swagger
 * /market/top:
 *   get:
 *     summary: Get top tokens by market cap
 *     tags: [Market]
 *     description: Returns top cryptocurrencies ranked by market capitalization
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 200
 *         description: Number of tokens to return
 *     responses:
 *       200:
 *         description: Top tokens
 */
router.get(
  '/top',
  [
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    validate
  ],
  marketController.getTopTokens
);

/**
 * @swagger
 * /market/meme-coins:
 *   get:
 *     summary: Get meme coins / high volatility tokens
 *     tags: [Market]
 *     description: |
 *       Returns tokens with significant 24h price changes (>10%)
 *       
 *       **Use Cases:**
 *       - Alpha token discovery
 *       - High volatility trading opportunities
 *       - Meme coin tracking
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of tokens to return
 *     responses:
 *       200:
 *         description: High volatility tokens
 */
router.get(
  '/meme-coins',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  marketController.getMemeCoins
);

/**
 * @swagger
 * /market/gainers-losers:
 *   get:
 *     summary: Get top gainers and losers
 *     tags: [Market]
 *     description: Returns tokens with highest gains and losses in 24h
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of gainers/losers each
 *     responses:
 *       200:
 *         description: Gainers and losers
 */
router.get(
  '/gainers-losers',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    validate
  ],
  marketController.getGainersAndLosers
);

/**
 * @swagger
 * /market/token/{tokenId}:
 *   get:
 *     summary: Get token details
 *     tags: [Market]
 *     description: Returns detailed information for a specific token
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: Token identifier (lowercase)
 *         examples:
 *           bitcoin:
 *             value: bitcoin
 *           ethereum:
 *             value: ethereum
 *           binance-coin:
 *             value: binance-coin
 *     responses:
 *       200:
 *         description: Token details
 */
router.get(
  '/token/:tokenId',
  [
    param('tokenId').notEmpty().withMessage('Token ID is required'),
    validate
  ],
  marketController.getTokenDetails
);

/**
 * @swagger
 * /market/token/{tokenId}/history:
 *   get:
 *     summary: Get token price history
 *     tags: [Market]
 *     description: Returns historical price data for charting
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: Token identifier
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [m1, m5, m15, m30, h1, h2, h6, h12, d1]
 *           default: d1
 *         description: Time interval
 *       - in: query
 *         name: start
 *         schema:
 *           type: integer
 *         description: Start timestamp (milliseconds)
 *       - in: query
 *         name: end
 *         schema:
 *           type: integer
 *         description: End timestamp (milliseconds)
 *     responses:
 *       200:
 *         description: Price history
 */
router.get(
  '/token/:tokenId/history',
  [
    param('tokenId').notEmpty().withMessage('Token ID is required'),
    query('interval').optional().isIn(['m1', 'm5', 'm15', 'm30', 'h1', 'h2', 'h6', 'h12', 'd1']),
    query('start').optional().isInt(),
    query('end').optional().isInt(),
    validate
  ],
  marketController.getTokenHistory
);

/**
 * @swagger
 * /market/search:
 *   get:
 *     summary: Search tokens
 *     tags: [Market]
 *     description: Search for tokens by symbol or name
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Max results
 *     responses:
 *       200:
 *         description: Search results
 */
router.get(
  '/search',
  [
    query('q').notEmpty().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  marketController.searchTokens
);

/**
 * @swagger
 * /market/pairs/{tokenAddress}:
 *   get:
 *     summary: Get token DEX pairs
 *     tags: [Market]
 *     description: |
 *       Returns trading pairs from decentralized exchanges
 *       
 *       **Data Source:** DexScreener (free)
 *     parameters:
 *       - in: path
 *         name: tokenAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Token contract address
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *           default: bsc
 *         description: Blockchain network
 *     responses:
 *       200:
 *         description: DEX pairs
 */
router.get(
  '/pairs/:tokenAddress',
  [
    param('tokenAddress').notEmpty().withMessage('Token address is required'),
    query('chain').optional().isString(),
    validate
  ],
  marketController.getTokenPairs
);



/**
 * @swagger
 * /market/token/{tokenId}/chart:
 *   get:
 *     summary: Get token chart data
 *     tags: [Market]
 *     description: Returns price history for charting
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *         description: Token identifier (e.g., bitcoin, ethereum)
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1H, 1D, 7D, 1W, 30D, 1M, 1Y, ALL]
 *           default: 1D
 *         description: Time period
 *     responses:
 *       200:
 *         description: Chart data
 */
router.get(
  '/token/:tokenId/chart',
  [
    param('tokenId').notEmpty().withMessage('Token ID is required'),
    query('period').optional().isIn(['1H', '1D', '7D', '1W', '30D', '1M', '1Y', 'ALL']),
    validate
  ],
  marketController.getTokenChart
);




/**
 * @swagger
 * /market/earning:
 *   get:
 *     summary: Get all earning opportunities
 *     tags: [Market]
 *     description: |
 *       Returns all available staking and yield farming opportunities
 *       
 *       **Supported Chains:**
 *       - Cosmos (native staking)
 *       - Juno (native staking)
 *       - Stargaze (native staking)
 *       - Ethereum (Lido liquid staking)
 *       - Polygon (native staking)
 *       
 *       **Data Sources:**
 *       - Cosmos RPC (free)
 *       - Juno RPC (free)
 *       - Stargaze RPC (free)
 *     responses:
 *       200:
 *         description: Earning opportunities
 */
router.get('/earning', marketController.getAllEarningOpportunities);

/**
 * @swagger
 * /market/earning/top:
 *   get:
 *     summary: Get top earning opportunities
 *     tags: [Market]
 *     description: Returns earning opportunities sorted by APR (highest first)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of opportunities to return
 *     responses:
 *       200:
 *         description: Top earning opportunities
 */
router.get(
  '/earning/top',
  [
    query('limit').optional().isInt({ min: 1, max: 20 }),
    validate
  ],
  marketController.getTopEarning
);

/**
 * @swagger
 * /market/earning/{chain}:
 *   get:
 *     summary: Get earning opportunities for specific chain
 *     tags: [Market]
 *     description: Returns staking details for a specific blockchain
 *     parameters:
 *       - in: path
 *         name: chain
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cosmos, juno, stargaze]
 *         description: Blockchain identifier
 *     responses:
 *       200:
 *         description: Chain earning data
 */
router.get(
  '/earning/:chain',
  [
    param('chain').notEmpty().withMessage('Chain is required'),
    validate
  ],
  marketController.getEarningByChain
);

/**
 * @swagger
 * /market/refresh-cache:
 *   post:
 *     summary: Refresh market data cache
 *     tags: [Market]
 *     description: Clears cached market data to force fresh data on next request
 *     responses:
 *       200:
 *         description: Cache cleared
 */
router.post('/refresh-cache', marketController.refreshCache);

module.exports = router;


