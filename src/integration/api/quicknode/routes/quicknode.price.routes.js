const express = require('express');
const router = express.Router();
const { getTokenPrice } = require('../controller/price.controller');




/**
 * @swagger
 * tags:
 *   name: QuickNode Price
 *   description: Get live token prices using CoinGecko
 */

/**
 * @swagger
 * /quicknode/price/{symbol}:
 *   get:
 *     summary: Get live USD price for a token (e.g., bnb, eth, usdt)
 *     tags: [QuickNode Price]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Price retrieved successfully
 */

router.get('/:symbol', getTokenPrice);

module.exports = router;
