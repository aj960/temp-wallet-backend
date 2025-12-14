const express = require('express');
const router = express.Router();
const { estimateGas, sendTransaction, getTxDetails, sendTokenTransaction, sendTokenWithAutoGas } = require('../controller/tx.controller');

/**
 * @swagger
 * tags:
 *   name: QuickNode Transactions
 *   description: Transaction handling, estimation, and lookup
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     GasEstimateRequest:
 *       type: object
 *       required:
 *         - from
 *         - to
 *         - value
 *       properties:
 *         from:
 *           type: string
 *           example: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *         to:
 *           type: string
 *           example: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *         value:
 *           type: number
 *           example: 0.1
 *     SendTransactionRequest:
 *       type: object
 *       required:
 *         - privateKey
 *         - to
 *         - amount
 *       properties:
 *         privateKey:
 *           type: string
 *           example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *         to:
 *           type: string
 *           example: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *         amount:
 *           type: number
 *           example: 0.1
 *     SendTokenRequest:
 *       type: object
 *       required:
 *         - privateKey
 *         - to
 *         - amount
 *         - tokenAddress
 *       properties:
 *         privateKey:
 *           type: string
 *           example: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *         to:
 *           type: string
 *           example: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *         amount:
 *           type: number
 *           example: 100
 *         tokenAddress:
 *           type: string
 *           example: "0x55d398326f99059fF775485246999027B3197955"
 *         decimals:
 *           type: number
 *           example: 18
 */

/**
 * @swagger
 * /quicknode/tx/estimate-gas:
 *   post:
 *     summary: Estimate gas required for a transaction
 *     tags: [QuickNode Transactions]
 *     description: |
 *       Calculates the estimated gas units needed to execute a transaction.
 *       
 *       **What is Gas Estimation?**
 *       - Predicts computational cost before sending transaction
 *       - Helps prevent "out of gas" errors
 *       - Allows calculation of transaction fees (gas * gasPrice)
 *       
 *       **Use Cases:**
 *       - Check if wallet has enough balance for gas
 *       - Display estimated transaction cost to users
 *       - Optimize transaction parameters
 *       
 *       **Note:** Actual gas used may differ slightly from estimate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GasEstimateRequest'
 *           examples:
 *             simpleTransfer:
 *               summary: Simple BNB/ETH Transfer
 *               value:
 *                 from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 value: 0.1
 *             largeTransfer:
 *               summary: Large Amount Transfer
 *               value:
 *                 from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 value: 10.5
 *             smallTransfer:
 *               summary: Small Amount Transfer
 *               value:
 *                 from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 value: 0.001
 *     responses:
 *       200:
 *         description: Gas estimate returned successfully
 *         content:
 *           application/json:
 *             examples:
 *               standardTransfer:
 *                 summary: Standard Transfer (21000 gas)
 *                 value:
 *                   success: true
 *                   data:
 *                     estimatedGas: "21000"
 *               contractInteraction:
 *                 summary: Contract Interaction (Higher Gas)
 *                 value:
 *                   success: true
 *                   data:
 *                     estimatedGas: "65000"
 *       400:
 *         description: Missing required transaction fields
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   error: Missing required transaction fields
 *               invalidAddress:
 *                 summary: Invalid Address Format
 *                 value:
 *                   success: false
 *                   error: Invalid 'to' address format
 *       500:
 *         description: Gas estimation failed
 *         content:
 *           application/json:
 *             examples:
 *               insufficientBalance:
 *                 summary: Insufficient Balance
 *                 value:
 *                   success: false
 *                   error: Gas estimation failed
 *                   details:
 *                     message: Insufficient funds for transaction
 *               rpcError:
 *                 summary: RPC Error
 *                 value:
 *                   success: false
 *                   error: Gas estimation failed
 *                   details:
 *                     message: RPC call failed
 */
router.post('/estimate-gas', estimateGas);

/**
 * @swagger
 * /quicknode/tx/send:
 *   post:
 *     summary: Send a transaction using private key
 *     tags: [QuickNode Transactions]
 *     description: |
 *       Sends native cryptocurrency (BNB/ETH) from one address to another.
 *       
 *       **⚠️ SECURITY WARNING:**
 *       - Never expose private keys in production
 *       - Use secure key management solutions
 *       - Consider hardware wallets for large amounts
 *       - This endpoint is for backend/server use only
 *       
 *       **Transaction Flow:**
 *       1. Creates transaction with current gas price
 *       2. Signs transaction with private key
 *       3. Broadcasts to blockchain network
 *       4. Returns transaction hash for tracking
 *       
 *       **Use Cases:**
 *       - Automated payments/payouts
 *       - Hot wallet operations
 *       - Exchange withdrawals
 *       - Treasury management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendTransactionRequest'
 *           examples:
 *             sendBNB:
 *               summary: Send 0.1 BNB
 *               value:
 *                 privateKey: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 0.1
 *             sendLargeAmount:
 *               summary: Send 5 BNB
 *               value:
 *                 privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 5
 *             sendSmallAmount:
 *               summary: Send 0.001 BNB
 *               value:
 *                 privateKey: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 0.001
 *     responses:
 *       200:
 *         description: Transaction sent successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 txHash: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7"
 *       400:
 *         description: Missing required fields or validation error
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   error: Missing required fields
 *               invalidPrivateKey:
 *                 summary: Invalid Private Key
 *                 value:
 *                   success: false
 *                   error: Invalid private key format
 *               invalidAddress:
 *                 summary: Invalid Recipient Address
 *                 value:
 *                   success: false
 *                   error: Invalid recipient address
 *       500:
 *         description: Transaction failed
 *         content:
 *           application/json:
 *             examples:
 *               insufficientFunds:
 *                 summary: Insufficient Funds
 *                 value:
 *                   success: false
 *                   error: Transaction failed
 *                   details:
 *                     message: Insufficient funds for transfer and gas
 *               nonceTooLow:
 *                 summary: Nonce Too Low
 *                 value:
 *                   success: false
 *                   error: Transaction failed
 *                   details:
 *                     message: Nonce too low - transaction already processed
 *               networkError:
 *                 summary: Network Error
 *                 value:
 *                   success: false
 *                   error: Transaction failed
 *                   details:
 *                     message: Network connection failed
 */
router.post('/send', sendTransaction);

/**
 * @swagger
 * /quicknode/tx/{hash}:
 *   get:
 *     summary: Fetch transaction details by hash
 *     tags: [QuickNode Transactions]
 *     description: |
 *       Retrieves complete information about a transaction using its hash.
 *       
 *       **Transaction Information Includes:**
 *       - Status (pending/confirmed/failed)
 *       - Block number and confirmations
 *       - From/To addresses
 *       - Value transferred
 *       - Gas used and gas price
 *       - Transaction fee
 *       - Input data (for contract calls)
 *       
 *       **Use Cases:**
 *       - Verify transaction completion
 *       - Check transaction status
 *       - Audit transaction history
 *       - Debug failed transactions
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{64}$'
 *         description: Transaction hash (66 characters including 0x prefix)
 *         examples:
 *           successfulTx:
 *             value: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7"
 *             summary: Successful Transaction
 *           pendingTx:
 *             value: "0x7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b"
 *             summary: Pending Transaction
 *           failedTx:
 *             value: "0x5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b5a4f"
 *             summary: Failed Transaction
 *     responses:
 *       200:
 *         description: Transaction details fetched successfully
 *         content:
 *           application/json:
 *             examples:
 *               confirmedTransaction:
 *                 summary: Confirmed Transaction
 *                 value:
 *                   success: true
 *                   data:
 *                     hash: "0x9e8d7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7"
 *                     from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                     value: "100000000000000000"
 *                     gasPrice: "5000000000"
 *                     gas: "21000"
 *                     blockNumber: 25123456
 *                     blockHash: "0x8f5e4c7d3b2a1e9f6d8c5a4b3e2f1d0c9b8a7e6f5d4c3b2a1e0f9d8c7b6a5e4f"
 *                     transactionIndex: 12
 *                     confirmations: 15
 *                     status: 1
 *               pendingTransaction:
 *                 summary: Pending Transaction
 *                 value:
 *                   success: true
 *                   data:
 *                     hash: "0x7c6b5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b"
 *                     from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                     value: "50000000000000000"
 *                     gasPrice: "5000000000"
 *                     gas: "21000"
 *                     blockNumber: null
 *                     blockHash: null
 *                     confirmations: 0
 *                     status: null
 *               failedTransaction:
 *                 summary: Failed Transaction
 *                 value:
 *                   success: true
 *                   data:
 *                     hash: "0x5a4f3e2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b5a4f"
 *                     from: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                     value: "200000000000000000"
 *                     gasPrice: "5000000000"
 *                     gas: "21000"
 *                     blockNumber: 25123450
 *                     blockHash: "0x7d6c5b4a3e2f1d0c9b8a7e6f5d4c3b2a1e0f9d8c7b6a5e4f3d2c1b0a9e8d7c6b"
 *                     transactionIndex: 8
 *                     confirmations: 21
 *                     status: 0
 *       400:
 *         description: Invalid transaction hash
 *         content:
 *           application/json:
 *             examples:
 *               missingHash:
 *                 summary: Missing Transaction Hash
 *                 value:
 *                   success: false
 *                   error: Transaction hash required
 *               invalidFormat:
 *                 summary: Invalid Hash Format
 *                 value:
 *                   success: false
 *                   error: Invalid transaction hash format
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Transaction not found
 *       500:
 *         description: Failed to fetch transaction details
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Failed to fetch transaction details
 *               details:
 *                 message: RPC error
 */
router.get('/:hash', getTxDetails);

/**
 * @swagger
 * /quicknode/tx/send-token:
 *   post:
 *     summary: Send an ERC20/BEP20 token (e.g. USDT)
 *     tags: [QuickNode Transactions]
 *     description: |
 *       Transfers ERC20/BEP20 tokens from one address to another.
 *       
 *       **⚠️ IMPORTANT:**
 *       - Requires sufficient native token (BNB/ETH) for gas fees
 *       - Token decimals vary by token (USDT BSC: 18, USDT ETH: 6)
 *       - Always verify token contract address
 *       
 *       **Common Token Decimals:**
 *       - USDT (BSC): 18 decimals
 *       - USDT (ETH): 6 decimals
 *       - USDC (ETH): 6 decimals
 *       - DAI (ETH): 18 decimals
 *       - BUSD (BSC): 18 decimals
 *       - CAKE (BSC): 18 decimals
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendTokenRequest'
 *           examples:
 *             sendUSDT_BSC:
 *               summary: Send 100 USDT (BSC)
 *               value:
 *                 privateKey: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 100
 *                 tokenAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                 decimals: 18
 *             sendBUSD:
 *               summary: Send 50 BUSD (BSC)
 *               value:
 *                 privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 50
 *                 tokenAddress: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
 *                 decimals: 18
 *             sendCAKE:
 *               summary: Send 25 CAKE (BSC)
 *               value:
 *                 privateKey: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 25
 *                 tokenAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
 *                 decimals: 18
 *             sendUSDT_ETH:
 *               summary: Send 100 USDT (Ethereum - 6 decimals)
 *               value:
 *                 privateKey: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 100
 *                 tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
 *                 decimals: 6
 *     responses:
 *       200:
 *         description: Token transfer transaction hash
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 txHash: "0x8d7c6b5a4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c"
 *       400:
 *         description: Invalid input or missing fields
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   error: Missing required fields
 *               invalidToken:
 *                 summary: Invalid Token Address
 *                 value:
 *                   success: false
 *                   error: Invalid token contract address
 *               invalidAmount:
 *                 summary: Invalid Amount
 *                 value:
 *                   success: false
 *                   error: Amount must be greater than 0
 *       500:
 *         description: Token transaction failed
 *         content:
 *           application/json:
 *             examples:
 *               insufficientTokens:
 *                 summary: Insufficient Token Balance
 *                 value:
 *                   success: false
 *                   error: Token transaction failed
 *                   details:
 *                     message: Insufficient token balance
 *               insufficientGas:
 *                 summary: Insufficient Gas (BNB/ETH)
 *                 value:
 *                   success: false
 *                   error: Token transaction failed
 *                   details:
 *                     message: Insufficient funds for gas
 *               contractError:
 *                 summary: Contract Execution Failed
 *                 value:
 *                   success: false
 *                   error: Token transaction failed
 *                   details:
 *                     message: Contract execution reverted
 */
router.post('/send-token', sendTokenTransaction);

/**
 * @swagger
 * /quicknode/tx/send-token-auto:
 *   post:
 *     summary: Send token and auto swap USDT → BNB if gas insufficient
 *     tags: [QuickNode Transactions]
 *     description: |
 *       Intelligent token transfer that automatically swaps USDT to BNB for gas if needed.
 *       
 *       **How It Works:**
 *       1. Checks current BNB balance
 *       2. Estimates gas needed for token transfer
 *       3. If BNB insufficient: Automatically swaps USDT → BNB using 0x Protocol
 *       4. Executes token transfer
 *       
 *       **Advantages:**
 *       - No manual gas management
 *       - Prevents failed transactions due to insufficient gas
 *       - Seamless user experience
 *       
 *       **Requirements:**
 *       - Must have USDT balance for auto-swap
 *       - 0x Protocol integration must be configured
 *       - Recommended USDT reserve: 0.5-1 USDT minimum
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendTokenRequest'
 *           examples:
 *             autoGasUSDT:
 *               summary: Send USDT with Auto Gas Conversion
 *               value:
 *                 privateKey: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 100
 *                 tokenAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                 decimals: 18
 *             autoGasBUSD:
 *               summary: Send BUSD with Auto Gas Management
 *               value:
 *                 privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *                 to: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                 amount: 50
 *                 tokenAddress: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
 *                 decimals: 18
 *     responses:
 *       200:
 *         description: Token transfer transaction hash (may include auto-swap details)
 *         content:
 *           application/json:
 *             examples:
 *               withAutoSwap:
 *                 summary: Transaction with Auto Gas Swap
 *                 value:
 *                   success: true
 *                   data:
 *                     txHash: "0x7c6b5a4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b"
 *                     autoSwapPerformed: true
 *                     swapAmount: "0.5 USDT → 0.002 BNB"
 *               withoutSwap:
 *                 summary: Transaction without Auto Swap (Sufficient Gas)
 *                 value:
 *                   success: true
 *                   data:
 *                     txHash: "0x6b5a4e3f2d1c0b9a8e7f6d5c4b3a2e1f0d9c8b7a6e5f4d3c2b1a0f9e8d7c6b5a"
 *                     autoSwapPerformed: false
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Missing required fields
 *       500:
 *         description: Transaction or swap failed
 *         content:
 *           application/json:
 *             examples:
 *               swapFailed:
 *                 summary: Auto Swap Failed
 *                 value:
 *                   success: false
 *                   error: Token transaction failed
 *                   details:
 *                     message: Insufficient USDT for gas swap
 *               txFailed:
 *                 summary: Transaction Failed After Swap
 *                 value:
 *                   success: false
 *                   error: Token transaction failed
 *                   details:
 *                     message: Transaction execution failed
 */
router.post('/send-token-auto', sendTokenWithAutoGas);

module.exports = router;




