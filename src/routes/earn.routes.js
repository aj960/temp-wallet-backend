/**
 * Earn Routes
 * All routes for the Earn feature
 * 
 * Location: src/routes/earn.routes.js
 */

const express = require('express');
const router = express.Router();
const earnController = require('../controllers/earn/earn.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Earn
 *   description: Earning opportunities (Staking, Lending, Trust Alpha)
 */

/**
 * @swagger
 * /earn/opportunities:
 *   get:
 *     summary: Get all earning opportunities
 *     tags: [Earn]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [staking, lending, trust-alpha]
 *         description: Filter by opportunity type
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *         description: Filter by blockchain
 *       - in: query
 *         name: minApy
 *         schema:
 *           type: number
 *         description: Minimum APY filter
 *       - in: query
 *         name: asset
 *         schema:
 *           type: string
 *         description: Filter by asset
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of earning opportunities
 */
router.get('/opportunities', earnController.getOpportunities.bind(earnController));

/**
 * @swagger
 * /earn/stablecoins:
 *   get:
 *     summary: Get stablecoin earning options
 *     tags: [Earn]
 *     parameters:
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stablecoin earning opportunities
 */
router.get('/stablecoins', earnController.getStablecoinEarn.bind(earnController));

/**
 * @swagger
 * /earn/staking:
 *   get:
 *     summary: Get native staking options
 *     tags: [Earn]
 *     parameters:
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *       - in: query
 *         name: minApy
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Native staking opportunities
 */
router.get('/staking', earnController.getStakingOptions.bind(earnController));

/**
 * @swagger
 * /earn/trust-alpha:
 *   get:
 *     summary: Get Trust Alpha campaigns
 *     tags: [Earn]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, upcoming, ended, all]
 *           default: active
 *     responses:
 *       200:
 *         description: Trust Alpha campaigns
 */
router.get('/trust-alpha', earnController.getTrustAlphaCampaigns.bind(earnController));

/**
 * @swagger
 * /earn/trust-alpha/{campaignId}:
 *   get:
 *     summary: Get Trust Alpha campaign details
 *     tags: [Earn]
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign details
 */
router.get('/trust-alpha/:campaignId', earnController.getTrustAlphaCampaignDetails.bind(earnController));

/**
 * @swagger
 * /earn/start:
 *   post:
 *     summary: Start earning (stake/lend)
 *     tags: [Earn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - opportunityId
 *               - amount
 *               - asset
 *               - chain
 *               - devicePasscodeId
 *             properties:
 *               walletId:
 *                 type: string
 *               opportunityId:
 *                 type: string
 *               amount:
 *                 type: string
 *               asset:
 *                 type: string
 *               chain:
 *                 type: string
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Position created successfully
 */
router.post('/start', earnController.startEarning.bind(earnController));

/**
 * @swagger
 * /earn/stop:
 *   post:
 *     summary: Stop earning (unstake/withdraw)
 *     tags: [Earn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - positionId
 *               - devicePasscodeId
 *             properties:
 *               positionId:
 *                 type: string
 *               amount:
 *                 type: string
 *                 description: Optional - defaults to full withdrawal
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal initiated
 */
router.post('/stop', earnController.stopEarning.bind(earnController));

/**
 * @swagger
 * /earn/claim-rewards:
 *   post:
 *     summary: Claim rewards without withdrawing principal
 *     tags: [Earn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - positionId
 *               - devicePasscodeId
 *             properties:
 *               positionId:
 *                 type: string
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rewards claimed
 */
router.post('/claim-rewards', earnController.claimRewards.bind(earnController));

/**
 * @swagger
 * /earn/positions/{walletId}:
 *   get:
 *     summary: Get user's earning positions
 *     tags: [Earn]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed, all]
 *           default: active
 *     responses:
 *       200:
 *         description: User's earning positions
 */
router.get('/positions/:walletId', earnController.getUserPositions.bind(earnController));

/**
 * @swagger
 * /earn/position/{positionId}:
 *   get:
 *     summary: Get specific position details
 *     tags: [Earn]
 *     parameters:
 *       - in: path
 *         name: positionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Position details
 */
router.get('/position/:positionId', earnController.getPositionDetails.bind(earnController));

/**
 * @swagger
 * /earn/estimate:
 *   post:
 *     summary: Calculate estimated earnings
 *     tags: [Earn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - opportunityId
 *               - amount
 *               - duration
 *             properties:
 *               opportunityId:
 *                 type: string
 *               amount:
 *                 type: number
 *               duration:
 *                 type: integer
 *                 description: Duration in days
 *     responses:
 *       200:
 *         description: Earnings estimate
 */
router.post('/estimate', earnController.estimateEarnings.bind(earnController));

/**
 * @swagger
 * /earn/trust-alpha/join:
 *   post:
 *     summary: Join Trust Alpha campaign
 *     tags: [Earn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - campaignId
 *               - amount
 *               - devicePasscodeId
 *             properties:
 *               walletId:
 *                 type: string
 *               campaignId:
 *                 type: string
 *               amount:
 *                 type: string
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully joined campaign
 */
router.post('/trust-alpha/join', earnController.joinTrustAlpha.bind(earnController));

/**
 * @swagger
 * /earn/history/{walletId}:
 *   get:
 *     summary: Get earning history for wallet
 *     tags: [Earn]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Earning history
 */
router.get('/history/:walletId', earnController.getEarningHistory.bind(earnController));

/**
 * @swagger
 * /earn/stats/{walletId}:
 *   get:
 *     summary: Get earning statistics for wallet
 *     tags: [Earn]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Earning statistics
 */
router.get('/stats/:walletId', earnController.getEarningStats.bind(earnController));

/**
 * @swagger
 * /earn/supported-assets:
 *   get:
 *     summary: Get supported assets for earning
 *     tags: [Earn]
 *     parameters:
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Supported assets
 */
router.get('/supported-assets', earnController.getSupportedAssets.bind(earnController));

/**
 * @swagger
 * /earn/refresh-rates:
 *   post:
 *     summary: Refresh APY rates (admin/scheduled)
 *     tags: [Earn]
 *     responses:
 *       200:
 *         description: Rates refreshed
 */
router.post('/refresh-rates', earnController.refreshRates.bind(earnController));

module.exports = router;




