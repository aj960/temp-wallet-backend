const express = require('express');
const router = express.Router();
const { swapUSDTtoBNB } = require('../controller/zeroX.controller');

/**
 * @swagger
 * tags:
 *   name: 0x Swap
 *   description: 0x Protocol swap endpoints (for BEP20/USDT to BNB)
 */

/**
 * @swagger
 * /0x/swap/usdt-bnb:
 *   post:
 *     summary: Swap USDT (BEP20) to BNB using 0x API
 *     tags: [0x Swap]
 *     description: Converts a specified amount of USDT (BEP20) to BNB using 0x aggregator under the hood.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               privateKey:
 *                 type: string
 *                 description: Private key of the wallet initiating the swap
 *               amountUSDT:
 *                 type: number
 *                 description: Amount of USDT to convert (e.g., 10 for 10 USDT)
 *     responses:
 *       200:
 *         description: Swap executed successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */

router.post('/swap/usdt-bnb', swapUSDTtoBNB);

module.exports = router;
