/**
 * Health Check Routes
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Now checks PublicNode connectivity instead of QuickNode
 * - All health checks verify PublicNode RPC status
 */

const express = require('express');
const router = express.Router();
const { checkHealth } = require('../controller/health.controller'); // ✅ Updated import path

/**
 * @swagger
 * tags:
 *   name: BSC Health
 *   description: Service and provider health monitoring via PublicNode
 */

/**
 * @swagger
 * /bsc/health:
 *   get:
 *     summary: Check PublicNode service and blockchain connectivity
 *     tags: [BSC Health]
 *     description: |
 *       Verifies connection to PublicNode RPC provider and blockchain network.
 *       
 *       **Checks:**
 *       - PublicNode RPC connectivity
 *       - Latest block number
 *       - Network chain ID
 *       - Response time
 *       
 *       **RPC Provider:** PublicNode by Allnodes (free, no API keys)
 *     responses:
 *       200:
 *         description: PublicNode connection healthy
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 status: UP
 *                 message: BSC connection healthy via PublicNode
 *                 network:
 *                   name: bnb
 *                   chainId: 56
 *                   latestBlock: 25123456
 *                 rpcProvider: PublicNode by Allnodes
 *                 apiKeysRequired: false
 *                 rateLimit: 1M requests/day per IP
 *                 timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: PublicNode health check failed
 *               details:
 *                 message: Connection timeout
 */
router.get('/', checkHealth);

module.exports = router;



