/**
 * Network Information Routes
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Network information and blockchain status via PublicNode (FREE)
 * - Gas price queries using PublicNode RPC
 * - Latest block info via PublicNode
 */

const express = require('express');
const router = express.Router();
const {
  getNetworkInfo,
  getGasPrice,
  getLatestBlockInfo
} = require('../controller/network.controller'); // ✅ Updated import

/**
 * @swagger
 * tags:
 *   name: BSC Network
 *   description: Network information and blockchain status via PublicNode (FREE)
 */

/**
 * @swagger
 * /bsc/network/info:
 *   get:
 *     summary: Get current network information via PublicNode
 *     tags: [BSC Network]
 *     description: |
 *       Returns network metadata including chain ID and RPC provider info.
 *       
 *       **✅ NOW USING PUBLICNODE:**
 *       - Free RPC access (no API keys)
 *       - 1M requests/day per IP
 *       - Automatic failover to Ankr
 *       - 99.99% uptime SLA
 *     responses:
 *       200:
 *         description: Network info retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 name: bnb
 *                 chainId: 56
 *                 rpcProvider: PublicNode
 *                 rateLimit: 1M requests/day per IP
 *       500:
 *         description: Failed to fetch network info
 */
router.get('/info', getNetworkInfo);

/**
 * @swagger
 * /bsc/network/gas-price:
 *   get:
 *     summary: Get current gas price via PublicNode
 *     tags: [BSC Network]
 *     description: |
 *       Returns current gas price in Wei and Gwei using PublicNode free RPC.
 *       
 *       **Use Cases:**
 *       - Estimate transaction costs
 *       - Display gas prices to users
 *       - Optimize transaction timing
 *       
 *       **RPC Provider:** PublicNode (free, no API keys)
 *     responses:
 *       200:
 *         description: Gas price retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 chainId: bsc
 *                 gasPriceWei: "5000000000"
 *                 gasPriceGwei: 5.0
 *                 rpcProvider: PublicNode
 *       500:
 *         description: Failed to fetch gas price
 */
router.get('/gas-price', getGasPrice);

/**
 * @swagger
 * /bsc/network/latest-block:
 *   get:
 *     summary: Get latest block details via PublicNode
 *     tags: [BSC Network]
 *     description: |
 *       Returns information about the most recent block using PublicNode free RPC.
 *       
 *       **Block Information:**
 *       - Block number
 *       - Timestamp
 *       - Miner/validator address
 *       - Transaction count
 *       
 *       **RPC Provider:** PublicNode by Allnodes (free)
 *     responses:
 *       200:
 *         description: Latest block info retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 chainId: bsc
 *                 blockNumber: 25123456
 *                 timestamp: "2024-01-15T10:30:00.000Z"
 *                 miner: "0x1234567890abcdef1234567890abcdef12345678"
 *                 txCount: 145
 *                 rpcProvider: PublicNode
 *       500:
 *         description: Failed to fetch latest block info
 */
router.get('/latest-block', getLatestBlockInfo);

module.exports = router;


