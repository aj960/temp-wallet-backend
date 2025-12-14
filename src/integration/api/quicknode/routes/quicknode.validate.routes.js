const express = require('express');
const router = express.Router();
const { validateAddress } = require('../controller/validate.controller');

/**
 * @swagger
 * tags:
 *   name: QuickNode Validation
 *   description: Address validation endpoints
 */

/**
 * @swagger
 * /quicknode/validate:
 *   post:
 *     summary: Validate Ethereum/BSC wallet address
 *     tags: [QuickNode Validation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Address validation result
 */


router.post('/', validateAddress);

module.exports = router;
