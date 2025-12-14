const express = require('express');
const router = express.Router();
const controller = require('../controllers/StaticNetworkProviderController');


/**
 * @swagger
 * /wallet/staticNetwork/token/{symbol}:
 *   get:
 *     summary: Search for a token by symbol (case-insensitive)
 *     tags: [StaticNetwork]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Token symbol to search (e.g., crUSDT)
 *     responses:
 *       200:
 *         description: Returns token info JSON and logo path if found
 *       404:
 *         description: Token not found
 */
router.get('/token/:symbol', controller.findTokenBySymbol);


/**
 * @swagger
 * /wallet/staticNetwork/search:
 *   get:
 *     summary: Search tokens by symbol substring (case-insensitive)
 *     tags: [StaticNetwork]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Substring to search for (e.g., "us")
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Max results to return (default 50)
 *     responses:
 *       200:
 *         description: Returns list of matched tokens with info and logo path
 */
router.get('/search', controller.searchTokens);


/**
 * @swagger
 * /wallet/staticNetwork/list:
 *   get:
 *     summary: Get list of all blockchain networks (native coins)
 *     tags: [StaticNetwork]
 *     responses:
 *       200:
 *         description: Returns network list
 */
router.get('/list', controller.getNetworkList);


/**
 * @swagger
 * /wallet/staticNetwork/list/search:
 *   get:
 *     summary: Search in network list (name, symbol, type, chain)
 *     tags: [StaticNetwork]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search substring (e.g., "BN")
 *     responses:
 *       200:
 *         description: Returns filtered network list
 */
router.get('/list/search', controller.searchNetworkList);


/**
 * @swagger
 * /wallet/staticNetwork/token/list/{coinName}:
 *   get:
 *     summary: Get token list for a specific blockchain network
 *     tags: [StaticNetwork]
 *     parameters:
 *       - in: path
 *         name: coinName
 *         required: true
 *         schema:
 *           type: string
 *         description: Blockchain network name (e.g., cfxevm, bsc, ethereum)
 *     responses:
 *       200:
 *         description: Returns list of tokens for the selected blockchain
 *       404:
 *         description: Chain not found or invalid
 */
router.get('/token/list/:coinName', controller.getNetworkTokenList);




/**
 * @swagger
 * /wallet/staticNetwork/{networkId}/info:
 *   get:
 *     summary: Get network info JSON
 *     tags: [StaticNetwork]
 *     parameters:
 *       - in: path
 *         name: networkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Network ID (e.g., 0x55d...)
 *     responses:
 *       200:
 *         description: Returns network info JSON
 *       404:
 *         description: Network not found
 */
router.get('/:networkId/info', controller.getNetworkInfo);


/**
 * @swagger
 * /wallet/staticNetwork/{networkId}/logo:
 *   get:
 *     summary: Get network logo image
 *     tags: [StaticNetwork]
 *     parameters:
 *       - in: path
 *         name: networkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Network ID (e.g., 0x55d...)
 *     responses:
 *       200:
 *         description: Returns logo image
 *       404:
 *         description: Logo not found
 */
router.get('/:networkId/logo', controller.getNetworkLogo);


module.exports = router;
