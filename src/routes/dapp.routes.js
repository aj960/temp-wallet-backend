const express = require('express');
const router = express.Router();
const dappController = require('../controllers/dapp.controller');
const { validate } = require('../middleware/validation.middleware');
const { body, query, param } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: DApps
 *   description: Decentralized Application discovery and management
 */

/**
 * @swagger
 * /dapps/categories:
 *   get:
 *     summary: Get all DApp categories
 *     tags: [DApps]
 *     description: |
 *       Returns all available DApp categories with DApp count for each.
 *       
 *       **Categories Include:**
 *       - DEX (Decentralized Exchanges)
 *       - Lending & Borrowing
 *       - Yield Farming
 *       - NFT Marketplaces
 *       - Games
 *       - Social Networks
 *       - Bridges
 *       - Launchpads
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: dex
 *                   name: DEX
 *                   description: Decentralized Exchanges
 *                   iconUrl: null
 *                   dappCount: 8
 *                 - id: lending
 *                   name: Lend
 *                   description: Lending & Borrowing Protocols
 *                   iconUrl: null
 *                   dappCount: 5
 *                 - id: nft
 *                   name: NFT
 *                   description: NFT Marketplaces
 *                   iconUrl: null
 *                   dappCount: 3
 */
router.get('/categories', dappController.getCategories);

/**
 * @swagger
 * /dapps/featured:
 *   get:
 *     summary: Get featured DApps
 *     tags: [DApps]
 *     description: Returns hand-picked featured DApps with highest ratings and user counts
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *         description: Maximum number of DApps to return
 *     responses:
 *       200:
 *         description: Featured DApps list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 dapps:
 *                   - id: uniswap
 *                     name: Uniswap
 *                     description: Leading decentralized exchange protocol on Ethereum
 *                     category: dex
 *                     url: https://app.uniswap.org
 *                     iconUrl: null
 *                     bannerUrl: null
 *                     chains:
 *                       - ETHEREUM
 *                       - POLYGON
 *                       - ARBITRUM
 *                     featured: true
 *                     verified: true
 *                     rating: 4.8
 *                     userCount: 3500000
 */
router.get(
  '/featured',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    validate
  ],
  dappController.getFeaturedDApps
);

/**
 * @swagger
 * /dapps/latest:
 *   get:
 *     summary: Get latest DApps
 *     tags: [DApps]
 *     description: Returns most recently added DApps
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of DApps to return
 *     responses:
 *       200:
 *         description: Latest DApps
 */
router.get(
  '/latest',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validate
  ],
  dappController.getLatestDApps
);

/**
 * @swagger
 * /dapps/category/{categoryId}:
 *   get:
 *     summary: Get DApps by category
 *     tags: [DApps]
 *     description: Returns all DApps in a specific category with pagination
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID (e.g., dex, lending, nft)
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
 *     responses:
 *       200:
 *         description: DApps in category
 */
router.get(
  '/category/:categoryId',
  [
    param('categoryId').notEmpty().withMessage('Category ID is required'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  dappController.getDAppsByCategory
);

/**
 * @swagger
 * /dapps/chain/{chainId}:
 *   get:
 *     summary: Get DApps by blockchain
 *     tags: [DApps]
 *     description: Returns all DApps supporting a specific blockchain
 *     parameters:
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chain identifier (e.g., ETHEREUM, BSC, POLYGON)
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
 *     responses:
 *       200:
 *         description: DApps supporting the chain
 */
router.get(
  '/chain/:chainId',
  [
    param('chainId').notEmpty().withMessage('Chain ID is required'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  dappController.getDAppsByChain
);

/**
 * @swagger
 * /dapps/search:
 *   post:
 *     summary: Search DApps
 *     tags: [DApps]
 *     description: |
 *       Search DApps by name or description with optional filters
 *       
 *       **Search Features:**
 *       - Text search in name and description
 *       - Filter by category
 *       - Filter by supported chains
 *       - Pagination support
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *               category:
 *                 type: string
 *                 description: Filter by category ID
 *               chains:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Filter by blockchain support
 *               page:
 *                 type: integer
 *                 default: 1
 *               pageSize:
 *                 type: integer
 *                 default: 20
 *           examples:
 *             basicSearch:
 *               summary: Basic Search
 *               value:
 *                 query: swap
 *             categoryFilter:
 *               summary: Search with Category Filter
 *               value:
 *                 query: exchange
 *                 category: dex
 *             chainFilter:
 *               summary: Search with Chain Filter
 *               value:
 *                 query: farming
 *                 chains:
 *                   - ETHEREUM
 *                   - POLYGON
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Invalid search query
 */
router.post(
  '/search',
  [
    body('query').notEmpty().withMessage('Search query is required'),
    body('category').optional().isString(),
    body('chains').optional().isArray(),
    body('page').optional().isInt({ min: 1 }),
    body('pageSize').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  dappController.searchDApps
);

/**
 * @swagger
 * /dapps/{dappId}:
 *   get:
 *     summary: Get DApp details
 *     tags: [DApps]
 *     description: |
 *       Returns detailed information about a specific DApp including stats and reviews
 *       
 *       **Response Includes:**
 *       - Full DApp information
 *       - Usage statistics
 *       - Recent user reviews
 *       - Supported chains
 *     parameters:
 *       - in: path
 *         name: dappId
 *         required: true
 *         schema:
 *           type: string
 *         description: DApp ID
 *     responses:
 *       200:
 *         description: DApp details
 *       404:
 *         description: DApp not found
 */
router.get(
  '/:dappId',
  [
    param('dappId').notEmpty().withMessage('DApp ID is required'),
    validate
  ],
  dappController.getDAppDetails
);

/**
 * @swagger
 * /dapps:
 *   get:
 *     summary: Get all DApps
 *     tags: [DApps]
 *     description: Returns all DApps with optional filtering by featured status
 *     parameters:
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
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *     responses:
 *       200:
 *         description: List of DApps
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('featured').optional().isBoolean(),
    validate
  ],
  dappController.getAllDApps
);

module.exports = router;

