const express = require('express');
const router = express.Router();
const controller = require('../controllers/StaticNetworkProviderController');

/**
 * @swagger
 * tags:
 *   name: StaticNetwork
 *   description: Static network and token information provider
 */

/**
 * @swagger
 * /wallet/staticNetwork/token/{symbol}:
 *   get:
 *     summary: Search for a token by symbol (case-insensitive)
 *     tags: [StaticNetwork]
 *     description: |
 *       Searches for a specific token by its symbol across all supported networks.
 *       Returns token information including contract address, decimals, and logo path.
 *       
 *       **Use Cases:**
 *       - Lookup token contract address by symbol
 *       - Get token metadata for transactions
 *       - Display token information in UI
 *       - Validate token existence
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Token symbol to search (e.g., USDT, BUSD, CAKE) - case insensitive
 *         examples:
 *           usdt:
 *             value: USDT
 *             summary: Search for USDT
 *           busd:
 *             value: busd
 *             summary: Search for BUSD (lowercase)
 *           cake:
 *             value: CaKe
 *             summary: Search for CAKE (mixed case)
 *           dai:
 *             value: DAI
 *             summary: Search for DAI
 *     responses:
 *       200:
 *         description: Token found - returns token info JSON and logo path
 *         content:
 *           application/json:
 *             examples:
 *               usdtFound:
 *                 summary: USDT Token Found
 *                 value:
 *                   success: true
 *                   data:
 *                     info:
 *                       name: Tether USD
 *                       symbol: USDT
 *                       decimals: 18
 *                       contractAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                       network: bsc
 *                       type: BEP20
 *                     logoPath: /wallet/staticNetwork/images/network-images/usdt-bsc
 *               cakeFound:
 *                 summary: CAKE Token Found
 *                 value:
 *                   success: true
 *                   data:
 *                     info:
 *                       name: PancakeSwap Token
 *                       symbol: CAKE
 *                       decimals: 18
 *                       contractAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
 *                       network: bsc
 *                       type: BEP20
 *                     logoPath: /wallet/staticNetwork/images/network-images/cake-bsc
 *       404:
 *         description: Token not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: 'Token with symbol "UNKNOWN" not found'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Internal server error
 */
router.get('/token/:symbol', controller.findTokenBySymbol);

/**
 * @swagger
 * /wallet/staticNetwork/search:
 *   get:
 *     summary: Search tokens by symbol substring (case-insensitive)
 *     tags: [StaticNetwork]
 *     description: |
 *       Performs a fuzzy search for tokens matching a substring.
 *       Returns multiple results if multiple tokens match.
 *       
 *       **Search Features:**
 *       - Case-insensitive matching
 *       - Partial match support
 *       - Configurable result limit
 *       - Sorted by relevance
 *       
 *       **Use Cases:**
 *       - Autocomplete for token selection
 *       - Browse available tokens
 *       - Find similar tokens
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Substring to search for
 *         examples:
 *           searchUS:
 *             value: us
 *             summary: Search tokens containing "us"
 *           searchStable:
 *             value: usd
 *             summary: Search USD stablecoins
 *           searchCake:
 *             value: ca
 *             summary: Search tokens starting with "ca"
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of results to return
 *         examples:
 *           limit10:
 *             value: 10
 *             summary: Return top 10 results
 *           limit25:
 *             value: 25
 *             summary: Return top 25 results
 *     responses:
 *       200:
 *         description: Search results returned (may be empty array)
 *         content:
 *           application/json:
 *             examples:
 *               multipleResults:
 *                 summary: Multiple Tokens Found
 *                 value:
 *                   success: true
 *                   data:
 *                     - info:
 *                         name: Tether USD
 *                         symbol: USDT
 *                         decimals: 18
 *                         contractAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                         network: bsc
 *                       logoPath: /wallet/staticNetwork/images/network-images/usdt-bsc
 *                     - info:
 *                         name: USD Coin
 *                         symbol: USDC
 *                         decimals: 18
 *                         contractAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
 *                         network: bsc
 *                       logoPath: /wallet/staticNetwork/images/network-images/usdc-bsc
 *                     - info:
 *                         name: Binance USD
 *                         symbol: BUSD
 *                         decimals: 18
 *                         contractAddress: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
 *                         network: bsc
 *                       logoPath: /wallet/staticNetwork/images/network-images/busd-bsc
 *               noResults:
 *                 summary: No Tokens Found
 *                 value:
 *                   success: true
 *                   data: []
 *       400:
 *         description: Missing or invalid query parameter
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Query parameter 'q' is required
 */
router.get('/search', controller.searchTokens);

/**
 * @swagger
 * /wallet/staticNetwork/list:
 *   get:
 *     summary: Get list of all blockchain networks (native coins)
 *     tags: [StaticNetwork]
 *     description: |
 *       Returns a complete list of all supported blockchain networks.
 *       Includes native coin information for each network.
 *       
 *       **Network Information Includes:**
 *       - Network name and chain ID
 *       - Native coin symbol
 *       - Network type (EVM, UTXO, etc.)
 *       - RPC endpoints
 *       - Block explorer URLs
 *       
 *       **Use Cases:**
 *       - Display available networks in UI
 *       - Network selection dropdowns
 *       - Multi-chain wallet initialization
 *     responses:
 *       200:
 *         description: Network list returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: ethereum
 *                   name: Ethereum
 *                   symbol: ETH
 *                   chainId: 1
 *                   type: EVM
 *                   decimals: 18
 *                   rpcUrl: https://eth.llamarpc.com
 *                   explorerUrl: https://etherscan.io
 *                 - id: bsc
 *                   name: BNB Smart Chain
 *                   symbol: BNB
 *                   chainId: 56
 *                   type: EVM
 *                   decimals: 18
 *                   rpcUrl: https://bsc-dataseed.binance.org
 *                   explorerUrl: https://bscscan.com
 *                 - id: polygon
 *                   name: Polygon
 *                   symbol: MATIC
 *                   chainId: 137
 *                   type: EVM
 *                   decimals: 18
 *                   rpcUrl: https://polygon-rpc.com
 *                   explorerUrl: https://polygonscan.com
 *                 - id: bitcoin
 *                   name: Bitcoin
 *                   symbol: BTC
 *                   chainId: null
 *                   type: UTXO
 *                   decimals: 8
 *                   rpcUrl: null
 *                   explorerUrl: https://blockchain.com
 *                 - id: solana
 *                   name: Solana
 *                   symbol: SOL
 *                   chainId: null
 *                   type: SOLANA
 *                   decimals: 9
 *                   rpcUrl: https://api.mainnet-beta.solana.com
 *                   explorerUrl: https://explorer.solana.com
 *       500:
 *         description: Failed to load network list
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Failed to load network list
 */
router.get('/list', controller.getNetworkList);

/**
 * @swagger
 * /wallet/staticNetwork/list/search:
 *   get:
 *     summary: Search in network list (name, symbol, type, chain)
 *     tags: [StaticNetwork]
 *     description: |
 *       Searches across network names, symbols, types, and chain IDs.
 *       Useful for filtering and finding specific networks.
 *       
 *       **Searchable Fields:**
 *       - Network name (e.g., "Ethereum", "Polygon")
 *       - Symbol (e.g., "ETH", "BNB")
 *       - Type (e.g., "EVM", "UTXO")
 *       - Chain ID
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Search substring (case-insensitive) - returns all if empty
 *         examples:
 *           searchEVM:
 *             value: EVM
 *             summary: Find all EVM chains
 *           searchBNB:
 *             value: BN
 *             summary: Search for BNB-related chains
 *           searchChain56:
 *             value: "56"
 *             summary: Find chain ID 56 (BSC)
 *           searchAll:
 *             value: ""
 *             summary: Return all networks
 *     responses:
 *       200:
 *         description: Filtered network list
 *         content:
 *           application/json:
 *             examples:
 *               evmChains:
 *                 summary: EVM Networks Only
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: ethereum
 *                       name: Ethereum
 *                       symbol: ETH
 *                       chainId: 1
 *                       type: EVM
 *                     - id: bsc
 *                       name: BNB Smart Chain
 *                       symbol: BNB
 *                       chainId: 56
 *                       type: EVM
 *                     - id: polygon
 *                       name: Polygon
 *                       symbol: MATIC
 *                       chainId: 137
 *                       type: EVM
 *               specificChain:
 *                 summary: Specific Chain Search
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: bsc
 *                       name: BNB Smart Chain
 *                       symbol: BNB
 *                       chainId: 56
 *                       type: EVM
 */
router.get('/list/search', controller.searchNetworkList);

/**
 * @swagger
 * /wallet/staticNetwork/token/list/{coinName}:
 *   get:
 *     summary: Get token list for a specific blockchain network
 *     tags: [StaticNetwork]
 *     description: |
 *       Returns all tokens available on a specific blockchain network.
 *       
 *       **Supported Networks:**
 *       - ethereum - Ethereum mainnet tokens
 *       - bsc - BSC (BNB Smart Chain) tokens
 *       - polygon - Polygon/Matic tokens
 *       - avalanche - Avalanche C-Chain tokens
 *       - arbitrum - Arbitrum tokens
 *       - optimism - Optimism tokens
 *     parameters:
 *       - in: path
 *         name: coinName
 *         required: true
 *         schema:
 *           type: string
 *         description: Blockchain network identifier (lowercase)
 *         examples:
 *           bsc:
 *             value: bsc
 *             summary: BSC Tokens
 *           ethereum:
 *             value: ethereum
 *             summary: Ethereum Tokens
 *           polygon:
 *             value: polygon
 *             summary: Polygon Tokens
 *     responses:
 *       200:
 *         description: Token list for the specified blockchain
 *         content:
 *           application/json:
 *             examples:
 *               bscTokens:
 *                 summary: BSC Token List
 *                 value:
 *                   success: true
 *                   data:
 *                     network: bsc
 *                     nativeToken:
 *                       name: BNB
 *                       symbol: BNB
 *                       decimals: 18
 *                     tokens:
 *                       - name: Tether USD
 *                         symbol: USDT
 *                         decimals: 18
 *                         contractAddress: "0x55d398326f99059fF775485246999027B3197955"
 *                         type: BEP20
 *                       - name: USD Coin
 *                         symbol: USDC
 *                         decimals: 18
 *                         contractAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
 *                         type: BEP20
 *                       - name: Binance USD
 *                         symbol: BUSD
 *                         decimals: 18
 *                         contractAddress: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
 *                         type: BEP20
 *                       - name: PancakeSwap Token
 *                         symbol: CAKE
 *                         decimals: 18
 *                         contractAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
 *                         type: BEP20
 *               ethereumTokens:
 *                 summary: Ethereum Token List
 *                 value:
 *                   success: true
 *                   data:
 *                     network: ethereum
 *                     nativeToken:
 *                       name: Ethereum
 *                       symbol: ETH
 *                       decimals: 18
 *                     tokens:
 *                       - name: Tether USD
 *                         symbol: USDT
 *                         decimals: 6
 *                         contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
 *                         type: ERC20
 *                       - name: USD Coin
 *                         symbol: USDC
 *                         decimals: 6
 *                         contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
 *                         type: ERC20
 *                       - name: Dai Stablecoin
 *                         symbol: DAI
 *                         decimals: 18
 *                         contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
 *                         type: ERC20
 *       404:
 *         description: Chain not found or invalid
 *         content:
 *           application/json:
 *             examples:
 *               chainNotFound:
 *                 summary: Invalid Network
 *                 value:
 *                   success: false
 *                   error: Chain 'unknown' not found
 *               noTokens:
 *                 summary: No Tokens Available
 *                 value:
 *                   success: true
 *                   data:
 *                     network: bitcoin
 *                     message: No tokens available for UTXO chains
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Failed to load token list
 */
router.get('/token/list/:coinName', controller.getNetworkTokenList);

/**
 * @swagger
 * /wallet/staticNetwork/{networkId}/info:
 *   get:
 *     summary: Get network info JSON
 *     tags: [StaticNetwork]
 *     description: |
 *       Returns detailed configuration information for a specific network.
 *       Includes RPC endpoints, chain ID, and network parameters.
 *     parameters:
 *       - in: path
 *         name: networkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Network identifier or contract address
 *         examples:
 *           ethereum:
 *             value: ethereum
 *             summary: Ethereum Info
 *           bsc:
 *             value: bsc
 *             summary: BSC Info
 *           polygon:
 *             value: polygon
 *             summary: Polygon Info
 *     responses:
 *       200:
 *         description: Network info JSON
 *         content:
 *           application/json:
 *             examples:
 *               ethereumInfo:
 *                 summary: Ethereum Network Info
 *                 value:
 *                   success: true
 *                   data:
 *                     id: ethereum
 *                     name: Ethereum
 *                     symbol: ETH
 *                     decimals: 18
 *                     chainId: 1
 *                     rpcUrl: https://eth.llamarpc.com
 *                     explorerUrl: https://etherscan.io
 *                     type: EVM
 *                     nativeCurrency:
 *                       name: Ether
 *                       symbol: ETH
 *                       decimals: 18
 *               bscInfo:
 *                 summary: BSC Network Info
 *                 value:
 *                   success: true
 *                   data:
 *                     id: bsc
 *                     name: BNB Smart Chain
 *                     symbol: BNB
 *                     decimals: 18
 *                     chainId: 56
 *                     rpcUrl: https://bsc-dataseed.binance.org
 *                     explorerUrl: https://bscscan.com
 *                     type: EVM
 *                     nativeCurrency:
 *                       name: BNB
 *                       symbol: BNB
 *                       decimals: 18
 *       404:
 *         description: Network not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Network not found
 */
router.get('/:networkId/info', controller.getNetworkInfo);

/**
 * @swagger
 * /wallet/staticNetwork/{networkId}/logo:
 *   get:
 *     summary: Get network logo image
 *     tags: [StaticNetwork]
 *     description: |
 *       Returns the logo image file for a specific blockchain network.
 *       Image is returned as a file (PNG/SVG).
 *     parameters:
 *       - in: path
 *         name: networkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Network identifier
 *         examples:
 *           ethereum:
 *             value: ethereum
 *             summary: Ethereum Logo
 *           bitcoin:
 *             value: bitcoin
 *             summary: Bitcoin Logo
 *           solana:
 *             value: solana
 *             summary: Solana Logo
 *     responses:
 *       200:
 *         description: Logo image file
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/svg+xml:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Logo not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Logo not found for network
 */
router.get('/:networkId/logo', controller.getNetworkLogo);

module.exports = router;



