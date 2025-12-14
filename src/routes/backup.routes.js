const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup.controller');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');
const rateLimiter = require('../security/rate-limiter.service');

/**
 * @swagger
 * tags:
 *   name: Backup
 *   description: Seed phrase backup and recovery management (Trust Wallet style)
 */

/**
 * @swagger
 * /backup/status/{walletId}:
 *   get:
 *     summary: Check if wallet seed phrase has been backed up
 *     tags: [Backup]
 *     description: |
 *       Checks backup status and displays urgent reminders after first transaction.
 *       
 *       **Trust Wallet Behavior:**
 *       - After first transaction, prompt user to backup immediately
 *       - Show persistent notification until backed up
 *       - Escalate urgency after 7 days
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Backup status
 *         content:
 *           application/json:
 *             examples:
 *               needsBackup:
 *                 summary: Needs Backup (After Transaction)
 *                 value:
 *                   success: true
 *                   data:
 *                     walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     walletName: Main Wallet
 *                     isBackedUp: false
 *                     backupDate: null
 *                     hasTransactions: true
 *                     firstTransactionDate: "2024-01-15T10:30:00Z"
 *                     daysSinceFirstTransaction: 5
 *                     needsBackup: true
 *                     urgency: NORMAL
 *                     message: "IMPORTANT: Backup your seed phrase to prevent loss of funds"
 *               urgent:
 *                 summary: Urgent Backup Needed (7+ days)
 *                 value:
 *                   success: true
 *                   data:
 *                     walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     walletName: Main Wallet
 *                     isBackedUp: false
 *                     hasTransactions: true
 *                     daysSinceFirstTransaction: 10
 *                     needsBackup: true
 *                     urgency: HIGH
 *                     message: "IMPORTANT: Backup your seed phrase to prevent loss of funds"
 *               backedUp:
 *                 summary: Already Backed Up
 *                 value:
 *                   success: true
 *                   data:
 *                     walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     isBackedUp: true
 *                     backupDate: "2024-01-16T14:20:00Z"
 *                     needsBackup: false
 *                     message: "Your wallet is backed up"
 */
router.get(
  '/status/:walletId',
  [
    param('walletId').notEmpty().withMessage('walletId is required'),
    validate
  ],
  backupController.checkBackupStatus
);

/**
 * @swagger
 * /backup/seed-phrase/{walletId}:
 *   post:
 *     summary: Get seed phrase for backup (requires device authentication)
 *     tags: [Backup]
 *     description: |
 *       **SECURITY CRITICAL ENDPOINT**
 *       
 *       Returns decrypted seed phrase for user to write down and backup.
 *       
 *       **Security Requirements:**
 *       - Device passcode verification required
 *       - All access logged
 *       - Rate limited to prevent brute force
 *       
 *       **Trust Wallet Flow:**
 *       1. User initiates backup
 *       2. System verifies device passcode
 *       3. Display 12 words one at a time
 *       4. User writes them down
 *       5. Verification quiz (next step)
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
 *               - devicePassCodeId
 *               - passcode
 *             properties:
 *               devicePassCodeId:
 *                 type: string
 *               passcode:
 *                 type: string
 *           example:
 *             devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *             passcode: "MySecurePin123"
 *     responses:
 *       200:
 *         description: Seed phrase retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 walletName: Main Wallet
 *                 seedPhrase: "crane short avocado love outer control dress same myself tiger prevent must"
 *                 wordCount: 12
 *                 warning: "⚠️ NEVER share your seed phrase with anyone"
 *                 instructions:
 *                   - "Write down these 12 words in order"
 *                   - "Store them in a secure, offline location"
 *                   - "Never take a screenshot or digital photo"
 *                   - "Keep multiple copies in different locations"
 *                   - "Anyone with these words can access your funds"
 *       401:
 *         description: Invalid passcode
 *       404:
 *         description: Wallet not found
 */
router.post(
  '/seed-phrase/:walletId',
  rateLimiter.authLimiter,
  [
    param('walletId').notEmpty(),
    body('devicePassCodeId').notEmpty().withMessage('devicePassCodeId required'),
    body('passcode').notEmpty().withMessage('passcode required'),
    validate
  ],
  backupController.getSeedPhraseForBackup
);

/**
 * @swagger
 * /backup/confirm/{walletId}:
 *   post:
 *     summary: Confirm seed phrase backup (verification quiz)
 *     tags: [Backup]
 *     description: |
 *       **Trust Wallet Style Verification**
 *       
 *       After user writes down seed phrase, verify they wrote it correctly
 *       by asking them to enter specific words (e.g., word #3, #7, #11).
 *       
 *       **Verification Process:**
 *       1. User completes backup
 *       2. System randomly selects 3-4 word positions
 *       3. User enters those specific words
 *       4. System verifies correctness
 *       5. Mark wallet as backed up
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
 *               - verificationWords
 *             properties:
 *               verificationWords:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     position:
 *                       type: integer
 *                       description: Word position (1-12)
 *                     word:
 *                       type: string
 *           examples:
 *             verification:
 *               summary: Verify 3 Words
 *               value:
 *                 verificationWords:
 *                   - position: 3
 *                     word: avocado
 *                   - position: 7
 *                     word: dress
 *                   - position: 11
 *                     word: prevent
 *     responses:
 *       200:
 *         description: Backup confirmed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: "✅ Seed phrase backup confirmed!"
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 backupDate: "2024-01-20T10:30:00Z"
 *                 reminder: "Keep your seed phrase safe. You may need it to recover your wallet."
 *       400:
 *         description: Verification failed
 */
router.post(
  '/confirm/:walletId',
  [
    param('walletId').notEmpty(),
    body('verificationWords').isArray({ min: 3 }).withMessage('At least 3 verification words required'),
    validate
  ],
  backupController.confirmBackup
);

/**
 * @swagger
 * /backup/verify-seed:
 *   post:
 *     summary: Verify seed phrase validity (for imports)
 *     tags: [Backup]
 *     description: |
 *       Validates if a seed phrase is correctly formatted BIP39 mnemonic.
 *       Used when importing existing wallets.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seedPhrase
 *             properties:
 *               seedPhrase:
 *                 type: string
 *           examples:
 *             valid12:
 *               summary: Valid 12-word Phrase
 *               value:
 *                 seedPhrase: "crane short avocado love outer control dress same myself tiger prevent must"
 *             valid24:
 *               summary: Valid 24-word Phrase
 *               value:
 *                 seedPhrase: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
 *             invalid:
 *               summary: Invalid Phrase
 *               value:
 *                 seedPhrase: "invalid words here test"
 *     responses:
 *       200:
 *         description: Validation result
 */
router.post(
  '/verify-seed',
  [
    body('seedPhrase').notEmpty().withMessage('seedPhrase required'),
    validate
  ],
  backupController.verifySeedPhrase
);

/**
 * @swagger
 * /backup/record-transaction:
 *   post:
 *     summary: Record first transaction (triggers backup reminder)
 *     tags: [Backup]
 *     description: |
 *       Called automatically after first successful transaction.
 *       Triggers backup reminder flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *               - txHash
 *             properties:
 *               walletId:
 *                 type: string
 *               txHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction recorded
 */
router.post(
  '/record-transaction',
  [
    body('walletId').notEmpty(),
    body('txHash').notEmpty(),
    validate
  ],
  backupController.recordFirstTransaction
);

/**
 * @swagger
 * /backup/reminders/{devicePassCodeId}:
 *   get:
 *     summary: Get all backup reminders for device
 *     tags: [Backup]
 *     description: |
 *       Returns list of wallets that need backup with urgency levels.
 *       Used to display persistent notifications.
 *     parameters:
 *       - in: path
 *         name: devicePassCodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Backup reminders
 */
router.get(
  '/reminders/:devicePassCodeId',
  [
    param('devicePassCodeId').notEmpty(),
    validate
  ],
  backupController.getBackupReminders
);

module.exports = router;





