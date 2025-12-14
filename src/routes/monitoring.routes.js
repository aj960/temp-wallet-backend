const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoring.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: Balance monitoring and notification system
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MonitoringConfig:
 *       type: object
 *       properties:
 *         intervalMs:
 *           type: integer
 *           default: 300000
 *           description: Monitoring interval in milliseconds (default 5 minutes)
 *           example: 300000
 *     ThresholdConfig:
 *       type: object
 *       required:
 *         - walletId
 *         - chain
 *         - minBalance
 *       properties:
 *         walletId:
 *           type: string
 *           description: Wallet ID to monitor
 *           example: c9d8e7f6a5b4c3d2e1f0a9b8
 *         chain:
 *           type: string
 *           description: Blockchain network
 *           example: ETHEREUM
 *         minBalance:
 *           type: string
 *           description: Minimum balance threshold (alert when below)
 *           example: "0.5"
 *         email:
 *           type: string
 *           format: email
 *           description: Email address for notifications (optional)
 *           example: admin@twwwin.com
 *         webhookUrl:
 *           type: string
 *           format: uri
 *           description: Webhook URL for notifications (optional)
 *           example: https://api.example.com/webhooks/balance-alert
 */

/**
 * @swagger
 * /monitoring/start:
 *   post:
 *     summary: Start global balance monitoring
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Starts automated balance monitoring for all wallets with configured thresholds.
 *       
 *       **Features:**
 *       - Continuous balance checking at specified intervals
 *       - Low balance alerts via email/webhook
 *       - Significant balance change detection (>10%)
 *       - Automatic threshold breach notifications
 *       
 *       **Default Interval:** 5 minutes (300000ms)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MonitoringConfig'
 *           examples:
 *             default:
 *               summary: Default Interval (5 minutes)
 *               value:
 *                 intervalMs: 300000
 *             frequent:
 *               summary: Frequent Monitoring (1 minute)
 *               value:
 *                 intervalMs: 60000
 *             hourly:
 *               summary: Hourly Monitoring
 *               value:
 *                 intervalMs: 3600000
 *     responses:
 *       200:
 *         description: Monitoring started
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Balance monitoring started
 *                 interval: 300000
 *                 timestamp: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied. Admin privileges required.
 */
router.post(
  '/start',
  verifyToken,
  requireAdmin,
  monitoringController.startMonitoring
);

/**
 * @swagger
 * /monitoring/stop:
 *   post:
 *     summary: Stop global balance monitoring
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Stops all automated balance monitoring.
 *       
 *       **Note:** Existing thresholds remain configured and can be reactivated.
 *     responses:
 *       200:
 *         description: Monitoring stopped
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Balance monitoring stopped
 *                 timestamp: "2024-01-15T10:35:00.000Z"
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/stop',
  verifyToken,
  requireAdmin,
  monitoringController.stopMonitoring
);

/**
 * @swagger
 * /monitoring/threshold:
 *   post:
 *     summary: Set balance threshold alert
 *     tags: [Monitoring]
 *     description: |
 *       Configures low balance alerts for a specific wallet and blockchain.
 *       
 *       **Alert Types:**
 *       - Email notification (if email provided)
 *       - Webhook POST request (if webhookUrl provided)
 *       - System log entry (always)
 *       
 *       **When Triggered:**
 *       - Balance drops below minBalance
 *       - Checked at monitoring intervals
 *       
 *       **Use Cases:**
 *       - Prevent transaction failures due to insufficient gas
 *       - Monitor cold wallet balances
 *       - Alert on unexpected withdrawals
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ThresholdConfig'
 *           examples:
 *             emailOnly:
 *               summary: Email Notification Only
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: ETHEREUM
 *                 minBalance: "0.5"
 *                 email: admin@twwwin.com
 *             webhookOnly:
 *               summary: Webhook Notification Only
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: BITCOIN
 *                 minBalance: "0.01"
 *                 webhookUrl: https://api.example.com/webhooks/low-balance
 *             both:
 *               summary: Email + Webhook Notifications
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: SOLANA
 *                 minBalance: "10.0"
 *                 email: admin@twwwin.com
 *                 webhookUrl: https://api.example.com/webhooks/balance-alert
 *             multipleChains:
 *               summary: Monitor Multiple Chains
 *               description: Set thresholds for different blockchains
 *               value:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: POLYGON
 *                 minBalance: "50.0"
 *                 email: admin@twwwin.com
 *     responses:
 *       200:
 *         description: Threshold set
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: ETHEREUM
 *                 minBalance: "0.5"
 *                 email: admin@twwwin.com
 *                 webhookUrl: null
 *                 enabled: true
 *                 createdAt: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   error: walletId, chain, and minBalance are required
 *               invalidEmail:
 *                 summary: Invalid Email Format
 *                 value:
 *                   success: false
 *                   error: Invalid email
 *               invalidWebhook:
 *                 summary: Invalid Webhook URL
 *                 value:
 *                   success: false
 *                   error: Invalid webhook URL
 */
router.post(
  '/threshold',
  [
    body('walletId').notEmpty().withMessage('walletId is required'),
    body('chain').notEmpty().withMessage('chain is required'),
    body('minBalance').notEmpty().withMessage('minBalance is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('webhookUrl').optional().isURL().withMessage('Invalid webhook URL'),
    validate
  ],
  monitoringController.setThreshold
);

/**
 * @swagger
 * /monitoring/threshold/{walletId}:
 *   get:
 *     summary: Get all thresholds for wallet
 *     tags: [Monitoring]
 *     description: Returns all configured balance thresholds for a specific wallet across all blockchains
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Thresholds retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 count: 3
 *                 thresholds:
 *                   - walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     chain: ETHEREUM
 *                     minBalance: "0.5"
 *                     email: admin@twwwin.com
 *                     webhookUrl: null
 *                     enabled: true
 *                     createdAt: "2024-01-15T10:30:00.000Z"
 *                   - walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     chain: BITCOIN
 *                     minBalance: "0.01"
 *                     email: admin@twwwin.com
 *                     webhookUrl: https://api.example.com/webhooks/btc-alert
 *                     enabled: true
 *                     createdAt: "2024-01-15T10:35:00.000Z"
 *                   - walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     chain: SOLANA
 *                     minBalance: "10.0"
 *                     email: null
 *                     webhookUrl: https://api.example.com/webhooks/sol-alert
 *                     enabled: true
 *                     createdAt: "2024-01-15T10:40:00.000Z"
 */
router.get(
  '/threshold/:walletId',
  [
    param('walletId').notEmpty().withMessage('walletId is required'),
    validate
  ],
  monitoringController.getThresholds
);

/**
 * @swagger
 * /monitoring/threshold/{walletId}/{chain}:
 *   delete:
 *     summary: Remove threshold
 *     tags: [Monitoring]
 *     description: |
 *       Removes a balance threshold for a specific wallet and blockchain.
 *       
 *       **Note:** This stops monitoring for this wallet/chain combination but doesn't affect other thresholds.
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *       - in: path
 *         name: chain
 *         required: true
 *         schema:
 *           type: string
 *         description: Blockchain identifier
 *         examples:
 *           ethereum:
 *             value: ETHEREUM
 *             summary: Remove Ethereum Threshold
 *           bitcoin:
 *             value: BITCOIN
 *             summary: Remove Bitcoin Threshold
 *     responses:
 *       200:
 *         description: Threshold removed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Threshold removed successfully
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 chain: ETHEREUM
 *       404:
 *         description: Threshold not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Threshold not found
 */
router.delete(
  '/threshold/:walletId/:chain',
  monitoringController.removeThreshold
);

/**
 * @swagger
 * /monitoring/status:
 *   get:
 *     summary: Get monitoring status
 *     tags: [Monitoring]
 *     description: |
 *       Returns the current state of the monitoring system.
 *       
 *       **Status Information:**
 *       - Whether monitoring is active
 *       - Number of active thresholds
 *       - List of all configured thresholds
 *       - Last check timestamp (if available)
 *     responses:
 *       200:
 *         description: Status retrieved
 *         content:
 *           application/json:
 *             examples:
 *               active:
 *                 summary: Monitoring Active
 *                 value:
 *                   success: true
 *                   data:
 *                     isRunning: true
 *                     activeThresholds: 5
 *                     thresholds:
 *                       - walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                         chain: ETHEREUM
 *                         minBalance: "0.5"
 *                         enabled: true
 *                       - walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                         chain: BITCOIN
 *                         minBalance: "0.01"
 *                         enabled: true
 *                       - walletId: a1b2c3d4e5f6a7b8c9d0e1f2
 *                         chain: SOLANA
 *                         minBalance: "10.0"
 *                         enabled: true
 *                     timestamp: "2024-01-15T10:45:00.000Z"
 *               inactive:
 *                 summary: Monitoring Stopped
 *                 value:
 *                   success: true
 *                   data:
 *                     isRunning: false
 *                     activeThresholds: 0
 *                     thresholds: []
 *                     timestamp: "2024-01-15T10:45:00.000Z"
 */
router.get('/status', monitoringController.getStatus);

/**
 * @swagger
 * /monitoring/check/{walletId}:
 *   post:
 *     summary: Manually check wallet balance
 *     tags: [Monitoring]
 *     description: |
 *       Triggers an immediate balance check for a specific wallet across all its blockchains.
 *       
 *       **Use Cases:**
 *       - Verify balance after transaction
 *       - Test threshold configurations
 *       - On-demand balance verification
 *       
 *       **Note:** This bypasses the scheduled monitoring interval.
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID to check
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Balance checked
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Balance check completed
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 timestamp: "2024-01-15T10:50:00.000Z"
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Wallet not found
 */
router.post(
  '/check/:walletId',
  [
    param('walletId').notEmpty().withMessage('walletId is required'),
    validate
  ],
  monitoringController.checkWalletBalance
);

/**
 * @swagger
 * /monitoring/test-email:
 *   post:
 *     summary: Test email notification
 *     tags: [Monitoring]
 *     description: |
 *       Sends a test email to verify email notification configuration.
 *       
 *       **Prerequisites:**
 *       - SMTP configuration in environment variables
 *       - Valid email credentials
 *       
 *       **Environment Variables Required:**
 *       ```
 *       SMTP_HOST=smtp.gmail.com
 *       SMTP_PORT=587
 *       SMTP_USER=your-email@gmail.com
 *       SMTP_PASSWORD=your-app-password
 *       SMTP_FROM=TrustWallet <your-email@gmail.com>
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to send test notification
 *           examples:
 *             personal:
 *               summary: Personal Email
 *               value:
 *                 email: admin@twwwin.com
 *             work:
 *               summary: Work Email
 *               value:
 *                 email: githukueliud@gmail.com
 *     responses:
 *       200:
 *         description: Test email sent
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Email Sent Successfully
 *                 value:
 *                   success: true
 *                   data:
 *                     message: Test email sent
 *                     result:
 *                       success: true
 *                       messageId: <abc123@smtp.gmail.com>
 *               notConfigured:
 *                 summary: SMTP Not Configured
 *                 value:
 *                   success: true
 *                   data:
 *                     message: Test email sent
 *                     result:
 *                       success: false
 *                       reason: Not configured
 *       400:
 *         description: Invalid email address
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Valid email is required
 */
router.post(
  '/test-email',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    validate
  ],
  monitoringController.testEmail
);




/**
 * @swagger
 * /monitoring/test-email-admin:
 *   post:
 *     summary: Test email delivery to admin
 *     tags: [Monitoring]
 *     description: |
 *       Sends a test email directly to the configured admin email (akilisjack@gmail.com).
 *       Does not require an email parameter - always sends to admin.
 *       
 *       **Use Cases:**
 *       - Verify admin notification system
 *       - Test SMTP configuration
 *       - Confirm email delivery to admin inbox
 *     responses:
 *       200:
 *         description: Test email sent to admin
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Test email triggered
 *                 result:
 *                   success: true
 *                   messageId: <abc123@smtp.gmail.com>
 *                 adminEmail: akilisjack@gmail.com
 *                 timestamp: "2024-01-15T10:30:00.000Z"
 */
router.post('/test-email-admin', monitoringController.testEmailToAdmin);



module.exports = router;



