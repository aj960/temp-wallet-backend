const transactionRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Send, receive, and track transactions
 */

/**
 * @swagger
 * /transaction/send/native:
 *   post:
 *     summary: Send native cryptocurrency (ETH, BNB, MATIC, etc.)
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *               - toAddress
 *               - amount
 *               - devicePasscodeId
 *             properties:
 *               walletId:
 *                 type: string
 *               chainId:
 *                 type: string
 *               toAddress:
 *                 type: string
 *               amount:
 *                 type: string
 *               gasPrice:
 *                 type: string
 *               gasLimit:
 *                 type: string
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction sent
 */
transactionRouter.post('/send/native', transactionController.sendNative.bind(transactionController));

/**
 * @swagger
 * /transaction/send/token:
 *   post:
 *     summary: Send ERC-20/BEP-20 tokens
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *               - tokenAddress
 *               - toAddress
 *               - amount
 *               - devicePasscodeId
 *             properties:
 *               walletId:
 *                 type: string
 *               chainId:
 *                 type: string
 *               tokenAddress:
 *                 type: string
 *               toAddress:
 *                 type: string
 *               amount:
 *                 type: string
 *               decimals:
 *                 type: number
 *               devicePasscodeId:
 *                 type: string
 *               gasPrice:
 *                 type: string
 *               gasLimit:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token transfer sent
 */
transactionRouter.post('/send/token', transactionController.sendToken.bind(transactionController));

/**
 * @swagger
 * /transaction/estimate-gas:
 *   post:
 *     summary: Estimate gas for transaction
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainId
 *               - fromAddress
 *               - toAddress
 *               - amount
 *             properties:
 *               chainId:
 *                 type: string
 *               fromAddress:
 *                 type: string
 *               toAddress:
 *                 type: string
 *               amount:
 *                 type: string
 *               tokenAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gas estimation
 */
transactionRouter.post('/estimate-gas', transactionController.estimateGas.bind(transactionController));

/**
 * @swagger
 * /transaction/history/{walletId}:
 *   get:
 *     summary: Get transaction history
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: txType
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Transaction history
 */
transactionRouter.get('/history/:walletId', transactionController.getTransactionHistory.bind(transactionController));

/**
 * @swagger
 * /transaction/details/{txHash}:
 *   get:
 *     summary: Get transaction details
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction details
 */
transactionRouter.get('/details/:txHash', transactionController.getTransactionDetails.bind(transactionController));



