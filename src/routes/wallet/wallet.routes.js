const walletRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet Management
 *   description: Create, import, manage multi-chain wallets
 */

/**
 * @swagger
 * /wallet/mnemonic/generate:
 *   post:
 *     summary: Generate new BIP39 mnemonic phrase
 *     tags: [Wallet Management]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               strength:
 *                 type: number
 *                 enum: [128, 256]
 *                 default: 128
 *                 description: 128=12 words, 256=24 words
 *     responses:
 *       200:
 *         description: Mnemonic generated successfully
 */
walletRouter.post('/mnemonic/generate', walletController.generateMnemonic.bind(walletController));

/**
 * @swagger
 * /wallet/mnemonic/validate:
 *   post:
 *     summary: Validate mnemonic phrase
 *     tags: [Wallet Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mnemonic
 *             properties:
 *               mnemonic:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation result
 */
walletRouter.post('/mnemonic/validate', walletController.validateMnemonic.bind(walletController));

/**
 * @swagger
 * /wallet/create:
 *   post:
 *     summary: Create new multi-chain wallet
 *     tags: [Wallet Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mnemonic
 *               - devicePasscodeId
 *             properties:
 *               mnemonic:
 *                 type: string
 *               name:
 *                 type: string
 *                 default: "My Wallet"
 *               chains:
 *                 type: array
 *                 items:
 *                   type: string
 *                 default: ["ethereum", "bsc", "polygon"]
 *               devicePasscodeId:
 *                 type: string
 *               isMain:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Wallet created successfully
 */
walletRouter.post('/create', walletController.createWallet.bind(walletController));

/**
 * @swagger
 * /wallet/import:
 *   post:
 *     summary: Import existing wallet from mnemonic
 *     tags: [Wallet Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mnemonic
 *               - devicePasscodeId
 *             properties:
 *               mnemonic:
 *                 type: string
 *               name:
 *                 type: string
 *               chains:
 *                 type: array
 *                 items:
 *                   type: string
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Wallet imported successfully
 */
walletRouter.post('/import', walletController.importWallet.bind(walletController));

/**
 * @swagger
 * /wallet/import/private-key:
 *   post:
 *     summary: Import account from private key
 *     tags: [Wallet Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - privateKey
 *               - devicePasscodeId
 *             properties:
 *               privateKey:
 *                 type: string
 *               chainId:
 *                 type: string
 *                 default: "ethereum"
 *               name:
 *                 type: string
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account imported successfully
 */
walletRouter.post('/import/private-key', walletController.importFromPrivateKey.bind(walletController));

/**
 * @swagger
 * /wallet/list:
 *   get:
 *     summary: List all wallets for device
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: query
 *         name: devicePasscodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of wallets
 */
walletRouter.get('/list', walletController.listWallets.bind(walletController));

/**
 * @swagger
 * /wallet/{walletId}:
 *   get:
 *     summary: Get wallet details and balances
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeBalances
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Wallet details
 */
walletRouter.get('/:walletId', walletController.getWalletDetails.bind(walletController));

/**
 * @swagger
 * /wallet/{walletId}/name:
 *   put:
 *     summary: Update wallet name
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Name updated
 */
walletRouter.put('/:walletId/name', walletController.updateWalletName.bind(walletController));

/**
 * @swagger
 * /wallet/{walletId}/set-main:
 *   post:
 *     summary: Set as main wallet
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - devicePasscodeId
 *             properties:
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Main wallet updated
 */
walletRouter.post('/:walletId/set-main', walletController.setMainWallet.bind(walletController));

/**
 * @swagger
 * /wallet/{walletId}/export:
 *   post:
 *     summary: Export wallet credentials (DANGEROUS)
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - devicePasscodeId
 *             properties:
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet credentials
 */
walletRouter.post('/:walletId/export', walletController.exportWallet.bind(walletController));

/**
 * @swagger
 * /wallet/{walletId}:
 *   delete:
 *     summary: Delete wallet permanently
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - devicePasscodeId
 *             properties:
 *               devicePasscodeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet deleted
 */
walletRouter.delete('/:walletId', walletController.deleteWallet.bind(walletController));

/**
 * @swagger
 * /wallet/{walletId}/derive:
 *   post:
 *     summary: Derive additional address
 *     tags: [Wallet Management]
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chainId
 *             properties:
 *               chainId:
 *                 type: string
 *               index:
 *                 type: number
 *                 default: 0
 *     responses:
 *       200:
 *         description: New address derived
 */
walletRouter.post('/:walletId/derive', walletController.deriveAddress.bind(walletController));

