const express = require('express');
const router = express.Router();
const { getBlock, getTransactionCount } = require('../controller/chain.controller');

/**
 * @swagger
 * tags:
 *   name: QuickNode Chain
 *   description: Chain block and transaction information
 */

/**
 * @swagger
 * /quicknode/chain/block/{number}:
 *   get:
 *     summary: Get block details by block number (latest if not provided)
 *     tags: [QuickNode Chain]
 *     description: |
 *       Retrieves detailed information about a specific blockchain block.
 *       If no block number is provided, returns the latest block.
 *       
 *       **Block Information Includes:**
 *       - Block number and hash
 *       - Timestamp
 *       - Gas used and gas limit
 *       - Transaction count
 *       - Miner/validator address
 *       - Parent block hash
 *       - Difficulty (if applicable)
 *       
 *       **Use Cases:**
 *       - Monitor blockchain progress
 *       - Verify block confirmations
 *       - Analyze block data
 *       - Check transaction inclusion
 *     parameters:
 *       - in: path
 *         name: number
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Block number to fetch (omit or use 'latest' for most recent block)
 *         examples:
 *           latest:
 *             value: latest
 *             summary: Get Latest Block
 *           specificBlock:
 *             value: 25000000
 *             summary: Get Specific Block
 *           recentBlock:
 *             value: 24999999
 *             summary: Get Recent Block
 *     responses:
 *       200:
 *         description: Block details retrieved successfully
 *         content:
 *           application/json:
 *             examples:
 *               latestBlock:
 *                 summary: Latest Block (BSC)
 *                 value:
 *                   success: true
 *                   data:
 *                     number: 25123456
 *                     hash: "0x8f5e4c7d3b2a1e9f6d8c5a4b3e2f1d0c9b8a7e6f5d4c3b2a1e0f9d8c7b6a5e4f"
 *                     timestamp: 1705326000
 *                     parentHash: "0x7e4d3c2b1a0f9e8d7c6b5a4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5d4"
 *                     miner: "0x1234567890abcdef1234567890abcdef12345678"
 *                     gasLimit: "30000000"
 *                     gasUsed: "15234567"
 *                     transactions:
 *                       - "0xabc123..."
 *                       - "0xdef456..."
 *                     transactionsRoot: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8"
 *                     difficulty: "2"
 *                     nonce: "0x0000000000000000"
 *               specificBlock:
 *                 summary: Specific Block Number
 *                 value:
 *                   success: true
 *                   data:
 *                     number: 25000000
 *                     hash: "0x7d6c5b4a3e2f1d0c9b8a7e6f5d4c3b2a1e0f9d8c7b6a5e4f3d2c1b0a9e8d7c6"
 *                     timestamp: 1705220000
 *                     parentHash: "0x6c5b4a3e2f1d0c9b8a7e6f5d4c3b2a1e0f9d8c7b6a5e4f3d2c1b0a9e8d7c6b5"
 *                     miner: "0xabcdef1234567890abcdef1234567890abcdef12"
 *                     gasLimit: "30000000"
 *                     gasUsed: "12456789"
 *                     transactions:
 *                       - "0x123abc..."
 *                       - "0x456def..."
 *                       - "0x789ghi..."
 *                     transactionsRoot: "0x8d7c6b5a4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7"
 *                     difficulty: "2"
 *                     nonce: "0x0000000000000000"
 *               emptyBlock:
 *                 summary: Block with No Transactions
 *                 value:
 *                   success: true
 *                   data:
 *                     number: 25000100
 *                     hash: "0x5a4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b5a4"
 *                     timestamp: 1705220300
 *                     parentHash: "0x4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b5a4e3"
 *                     miner: "0x9876543210fedcba9876543210fedcba98765432"
 *                     gasLimit: "30000000"
 *                     gasUsed: "0"
 *                     transactions: []
 *                     transactionsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
 *                     difficulty: "2"
 *                     nonce: "0x0000000000000000"
 *       400:
 *         description: Invalid block number
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Invalid block number format
 *       404:
 *         description: Block not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Block not found
 *       500:
 *         description: Failed to fetch block
 *         content:
 *           application/json:
 *             examples:
 *               rpcError:
 *                 summary: RPC Connection Error
 *                 value:
 *                   success: false
 *                   error: Failed to fetch block
 *                   details:
 *                     message: Connection to blockchain node failed
 *               networkError:
 *                 summary: Network Timeout
 *                 value:
 *                   success: false
 *                   error: Failed to fetch block
 *                   details:
 *                     message: Request timeout
 */
router.get('/block/:number?', getBlock);

/**
 * @swagger
 * /quicknode/chain/txcount/{address}:
 *   get:
 *     summary: Get total transactions count for an address
 *     tags: [QuickNode Chain]
 *     description: |
 *       Returns the total number of transactions sent from a specific address (nonce count).
 *       
 *       **What is Transaction Count?**
 *       - Also known as "nonce" - a counter for transactions sent from an address
 *       - Starts at 0 for new addresses
 *       - Increments by 1 for each transaction sent
 *       - Used to prevent replay attacks and ensure transaction ordering
 *       
 *       **Use Cases:**
 *       - Determine next nonce for new transactions
 *       - Check if address has sent any transactions
 *       - Verify transaction history activity
 *       - Troubleshoot stuck transactions
 *       
 *       **Note:** This only counts SENT transactions, not received transactions
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Ethereum/BSC wallet address
 *         examples:
 *           activeAddress:
 *             value: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *             summary: Active Wallet Address
 *           newAddress:
 *             value: "0x0000000000000000000000000000000000000001"
 *             summary: New/Unused Address
 *           exchangeAddress:
 *             value: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *             summary: Exchange Hot Wallet
 *     responses:
 *       200:
 *         description: Transaction count retrieved successfully
 *         content:
 *           application/json:
 *             examples:
 *               activeWallet:
 *                 summary: Active Wallet with Transactions
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     count: 1523
 *               newWallet:
 *                 summary: New Wallet (No Transactions)
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x0000000000000000000000000000000000000001"
 *                     count: 0
 *               highActivityWallet:
 *                 summary: High Activity Wallet
 *                 value:
 *                   success: true
 *                   data:
 *                     address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                     count: 45678
 *       400:
 *         description: Invalid or missing address
 *         content:
 *           application/json:
 *             examples:
 *               missingAddress:
 *                 summary: Missing Address
 *                 value:
 *                   success: false
 *                   error: Address required
 *               invalidFormat:
 *                 summary: Invalid Address Format
 *                 value:
 *                   success: false
 *                   error: Invalid Ethereum address format
 *               checksumError:
 *                 summary: Checksum Mismatch
 *                 value:
 *                   success: false
 *                   error: Invalid address checksum
 *       500:
 *         description: Failed to fetch transaction count
 *         content:
 *           application/json:
 *             examples:
 *               rpcError:
 *                 summary: RPC Connection Failed
 *                 value:
 *                   success: false
 *                   error: Failed to fetch transaction count
 *                   details:
 *                     message: Connection to node failed
 *               timeoutError:
 *                 summary: Request Timeout
 *                 value:
 *                   success: false
 *                   error: Failed to fetch transaction count
 *                   details:
 *                     message: Request timed out after 30 seconds
 */
router.get('/txcount/:address', getTransactionCount);

module.exports = router;






