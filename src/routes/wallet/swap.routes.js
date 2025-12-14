const swapRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Swap
 *   description: Token swap operations via DEX aggregators
 */

/**
 * @swagger
 * /swap/quote:
 *   post:
 *     summary: Get swap quote from multiple DEXs
 *     tags: [Swap]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainId
 *               - sellToken
 *               - buyToken
 *               - sellAmount
 *             properties:
 *               chainId:
 *                 type: string
 *               sellToken:
 *                 type: string
 *               buyToken:
 *                 type: string
 *               sellAmount:
 *                 type: string
 *               slippagePercentage:
 *                 type: number
 *                 default: 0.5
 *               takerAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Swap quote with best routing
 */
swapRouter.post('/quote', swapController.getQuote.bind(swapController));

/**
 * @swagger
 * /swap/execute:
 *   post:
 *     summary: Execute token swap
 *     tags: [Swap]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - chainId
 *               - quote
 *               - devicePasscodeId
 *             properties:
 *               walletId:
 *                 type: string
 *               chainId:
 *                 type: string
 *               quote:
 *                 type: object
 *               devicePasscodeId:
 *                 type: string
 *               customGasPrice:
 *                 type: string
 *               customGasLimit:
 *                 type: string
 *     responses:
 *       200:
 *         description: Swap executed
 */
swapRouter.post('/execute', swapController.executeSwap.bind(swapController));

/**
 * @swagger
 * /swap/price:
 *   get:
 *     summary: Get current swap price
 *     tags: [Swap]
 *     parameters:
 *       - in: query
 *         name: chainId
 *         required: true
 *       - in: query
 *         name: sellToken
 *         required: true
 *       - in: query
 *         name: buyToken
 *         required: true
 *       - in: query
 *         name: sellAmount
 *         required: true
 *     responses:
 *       200:
 *         description: Current swap price
 */
swapRouter.get('/price', swapController.getPrice.bind(swapController));

/**
 * @swagger
 * /swap/tokens/{chainId}:
 *   get:
 *     summary: Get supported tokens for chain
 *     tags: [Swap]
 *     parameters:
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of supported tokens
 */
swapRouter.get('/tokens/:chainId', swapController.getSupportedTokens.bind(swapController));

module.exports = {
  walletRouter,
  transactionRouter,
  swapRouter
};




