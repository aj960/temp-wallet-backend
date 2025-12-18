const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { validateAdminRegistration, validateAdminLogin } = require('../utils/validators');

/**
 * @swagger
 * tags:
 *   name: Admins
 *   description: Admin management API (Protected)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminRegistration:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           example: admin@twwwin.com
 *         password:
 *           type: string
 *           minLength: 8
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])'
 *           description: Must contain uppercase, lowercase, number and special character
 *           example: "SecureAdmin@2024"
 *         role:
 *           type: string
 *           enum: [superadmin, admin, viewer]
 *           default: superadmin
 *           example: superadmin
 *     AdminLogin:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@twwwin.com
 *         password:
 *           type: string
 *           example: "SecureAdmin@2024"
 *     AdminProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: admin@twwwin.com
 *         role:
 *           type: string
 *           example: superadmin
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Enter your JWT token obtained from /admin/login
 */

/**
 * @swagger
 * /admin/register:
 *   post:
 *     summary: Register a new admin (Admin only)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Creates a new admin account. Requires authentication with an existing admin account.
 *       
 *       **Password Requirements:**
 *       - Minimum 8 characters
 *       - At least one uppercase letter
 *       - At least one lowercase letter
 *       - At least one number
 *       - At least one special character (@$!%*?&)
 *       
 *       **Available Roles:**
 *       - `superadmin`: Full system access (default)
 *       - `admin`: Standard administrative access
 *       - `viewer`: Read-only access
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminRegistration'
 *           examples:
 *             superadmin:
 *               summary: Create Superadmin
 *               value:
 *                 name: Alice Johnson
 *                 email: alice@twwwin.com
 *                 password: "SuperSecure@123"
 *                 role: superadmin
 *             admin:
 *               summary: Create Standard Admin
 *               value:
 *                 name: Bob Smith
 *                 email: bob@twwwin.com
 *                 password: "AdminPass@456"
 *                 role: admin
 *             viewer:
 *               summary: Create Viewer Account
 *               value:
 *                 name: Carol White
 *                 email: carol@twwwin.com
 *                 password: "ViewOnly@789"
 *                 role: viewer
 *     responses:
 *       200:
 *         description: Admin registered successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Admin registered successfully
 *                 id: 5
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               weakPassword:
 *                 summary: Weak Password
 *                 value:
 *                   success: false
 *                   error: Password must contain uppercase, lowercase, number and special character
 *               emailExists:
 *                 summary: Duplicate Email
 *                 value:
 *                   success: false
 *                   error: Email already exists
 *               missingFields:
 *                 summary: Missing Required Fields
 *                 value:
 *                   success: false
 *                   error: All fields required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied. No token provided.
 */
router.post(
  '/register',
  verifyToken,
  requireAdmin,
  validateAdminRegistration,
  validate,
  adminController.registerAdmin
);

/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admins]
 *     description: |
 *       Authenticates an admin user and returns JWT tokens.
 *       
 *       **Rate Limiting:** 5 attempts per 15 minutes
 *       
 *       **Returns:**
 *       - `accessToken`: Use for authenticated requests (expires in 7 days)
 *       - `refreshToken`: Use to get new access tokens (expires in 30 days)
 *       
 *       **How to use the token:**
 *       1. Copy the `accessToken` from the response
 *       2. Click "Authorize" button at the top of this page
 *       3. Enter: `Bearer <your-token-here>`
 *       4. Click "Authorize" and close the dialog
 *       5. All protected endpoints will now work
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLogin'
 *           examples:
 *             defaultAdmin:
 *               summary: Default Admin Login
 *               value:
 *                 email: admin@twwwin.com
 *                 password: "SecureAdmin@2024"
 *             testAccount:
 *               summary: Test Account
 *               value:
 *                 email: test@twwwin.com
 *                 password: "TestPass@123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Login successful
 *                 admin:
 *                   id: 1
 *                   name: John Doe
 *                   email: admin@twwwin.com
 *                   role: superadmin
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0d3d3aW4uY29tIiwicm9sZSI6InN1cGVyYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzA1MzI2MDAwLCJleHAiOjE3MDU5MzA4MDAsImlzcyI6InRydXN0d2FsbGV0LWJhY2tlbmQiLCJhdWQiOiJ0cnVzdHdhbGxldC1hcGkifQ.example_signature
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDUzMjYwMDAsImV4cCI6MTcwNzkxODAwMCwiaXNzIjoidHJ1c3R3YWxsZXQtYmFja2VuZCIsImF1ZCI6InRydXN0d2FsbGV0LWFwaSJ9.example_signature
 *                 expiresIn: 7d
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             examples:
 *               invalidCredentials:
 *                 summary: Wrong Email/Password
 *                 value:
 *                   success: false
 *                   error: Invalid credentials
 *               missingFields:
 *                 summary: Missing Fields
 *                 value:
 *                   success: false
 *                   error: Email and password required
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Too many authentication attempts. Account temporarily locked.
 *               retryAfter: 900
 */
router.post(
  '/login',
  validateAdminLogin,
  validate,
  adminController.loginAdmin
);

/**
 * @swagger
 * /admin/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Admins]
 *     description: |
 *       Generates a new access token using a valid refresh token.
 *       Use this when your access token expires (after 7 days).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token obtained from login
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDUzMjYwMDAsImV4cCI6MTcwNzkxODAwMCwiaXNzIjoidHJ1c3R3YWxsZXQtYmFja2VuZCIsImF1ZCI6InRydXN0d2FsbGV0LWFwaSJ9.example_signature
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_token_payload.new_signature
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_refresh_token_payload.new_signature
 *                 expiresIn: 7d
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             examples:
 *               expired:
 *                 summary: Expired Token
 *                 value:
 *                   success: false
 *                   error: Refresh token has expired
 *               invalid:
 *                 summary: Invalid Token
 *                 value:
 *                   success: false
 *                   error: Invalid refresh token
 */
router.post('/refresh', adminController.refreshToken);

/**
 * @swagger
 * /admin/profile:
 *   get:
 *     summary: Get current authenticated admin's profile
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: Returns the profile of the currently authenticated admin (any authenticated user can access their own profile)
 *     responses:
 *       200:
 *         description: Admin profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminProfile'
 *             example:
 *               success: true
 *               data:
 *                 id: 1
 *                 name: John Doe
 *                 email: admin@twwwin.com
 *                 role: superadmin
 *                 created_at: "2024-01-01T00:00:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied. No token provided.
 */
router.get(
  '/profile',
  verifyToken,
  adminController.getMyProfile
);

/**
 * @swagger
 * /admin:
 *   get:
 *     summary: List all admins (Admin only)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: Returns a list of all admin accounts (passwords excluded)
 *     responses:
 *       200:
 *         description: List of admins
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: 1
 *                   name: John Doe
 *                   email: admin@twwwin.com
 *                   role: superadmin
 *                   created_at: "2024-01-01T00:00:00Z"
 *                 - id: 2
 *                   name: Alice Johnson
 *                   email: alice@twwwin.com
 *                   role: admin
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 - id: 3
 *                   name: Bob Smith
 *                   email: bob@twwwin.com
 *                   role: viewer
 *                   created_at: "2024-01-20T14:45:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied. Invalid token.
 */
router.get(
  '/',
  verifyToken,
  requireAdmin,
  adminController.listAdmins
);

/**
 * @swagger
 * /admin/{id}:
 *   get:
 *     summary: Get admin profile (Admin only)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Admin profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AdminProfile'
 *             example:
 *               success: true
 *               data:
 *                 id: 1
 *                 name: John Doe
 *                 email: admin@twwwin.com
 *                 role: superadmin
 *                 created_at: "2024-01-01T00:00:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied
 *       404:
 *         description: Admin not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Admin not found
 */
router.get(
  '/:id',
  verifyToken,
  requireAdmin,
  adminController.getAdminProfile
);

/**
 * @swagger
 * /admin/{id}:
 *   delete:
 *     summary: Delete an admin (Superadmin only)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Permanently deletes an admin account. This action cannot be undone.
 *       **Requires superadmin privileges.**
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Admin ID to delete
 *         example: 3
 *     responses:
 *       200:
 *         description: Admin deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Admin deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Insufficient permissions. Superadmin required.
 *       404:
 *         description: Admin not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Admin not found
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  adminController.deleteAdmin
);

/**
 * @swagger
 * /admin/wallets:
 *   get:
 *     summary: List all wallets (Admin only)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns a list of all wallet accounts in the system with basic user information.
 *       Useful for administrative oversight and support.
 *     responses:
 *       200:
 *         description: List of all wallets
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                   user_id: null
 *                   user_name: null
 *                   user_email: null
 *                   address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                   balance: 0
 *                   network: multi-chain
 *                   created_at: "2024-01-15T10:30:00Z"
 *                 - id: a1b2c3d4e5f6a7b8c9d0e1f2
 *                   user_id: null
 *                   user_name: null
 *                   user_email: null
 *                   address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                   balance: 0
 *                   network: bitcoin
 *                   created_at: "2024-01-20T14:45:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied. Admin privileges required.
 */
router.get(
  '/wallets',
  verifyToken,
  requireAdmin,
  adminController.getAllWallets
);

/**
 * @swagger
 * /admin/wallets/{id}:
 *   get:
 *     summary: Get wallet details by ID (Admin only)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve detailed information about a specific wallet
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Wallet details
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 user_id: null
 *                 user_name: null
 *                 user_email: null
 *                 address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 balance: 0
 *                 network: ethereum
 *                 created_at: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied
 *       404:
 *         description: Wallet not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Wallet not found
 */
router.get(
  '/wallets/:id',
  verifyToken,
  requireAdmin,
  adminController.getWalletById
);

/**
 * @swagger
 * /admin/wallets/{id}/seed:
 *   get:
 *     summary: Get wallet seed phrase (ADMIN ONLY - EXTREMELY SENSITIVE)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **CRITICAL SECURITY ENDPOINT**
 *       
 *       This endpoint retrieves the decrypted seed phrase for a wallet.
 *       
 *       **Security Measures:**
 *       - Requires admin authentication (JWT token)
 *       - All access is logged with admin details
 *       - Seed phrase is decrypted from encrypted storage
 *       
 *       **Use Cases:**
 *       - Wallet recovery assistance
 *       - Emergency backup retrieval
 *       - Administrative wallet management
 *       
 *       **WARNING:**
 *       - Never expose seed phrases to users
 *       - Never send seed phrases over unsecured channels
 *       - Store retrieved seed phrases securely
 *       - This endpoint should only be used in secure environments
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet ID
 *         example: c9d8e7f6a5b4c3d2e1f0a9b8
 *     responses:
 *       200:
 *         description: Seed phrase retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                 walletName: Main Portfolio
 *                 seedPhrase: crane short avocado love outer control dress same myself tiger prevent must
 *                 primaryAddress: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                 devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                 isMain: true
 *                 isSingleCoin: false
 *                 created_at: "2024-01-15T10:30:00.000Z"
 *                 networks:
 *                   - id: net_1a2b3c4d5e6f
 *                     address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     network: ETHEREUM
 *                     created_at: "2024-01-15T10:30:00.000Z"
 *                   - id: net_2b3c4d5e6f7a
 *                     address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                     network: BITCOIN
 *                     created_at: "2024-01-15T10:30:00.000Z"
 *                 warning: "HIGHLY SENSITIVE DATA - Store securely and never share"
 *       401:
 *         description: Unauthorized - Admin authentication required
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Access denied. Admin privileges required.
 *       404:
 *         description: Wallet not found or seed phrase not available
 *         content:
 *           application/json:
 *             examples:
 *               walletNotFound:
 *                 summary: Wallet Not Found
 *                 value:
 *                   success: false
 *                   error: Wallet not found
 *               seedNotFound:
 *                 summary: Seed Phrase Not Found
 *                 value:
 *                   success: false
 *                   error: Seed phrase not found for this wallet
 *       500:
 *         description: Failed to retrieve seed phrase
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Failed to retrieve seed phrase
 */
router.get('/wallets/:id/seed', verifyToken, requireAdmin, adminController.getWalletSeedPhrase);

/**
 * @swagger
 * /admin/wallets/export-all-seeds:
 *   get:
 *     summary: Export ALL wallets with seed phrases (ADMIN ONLY - MAXIMUM SECURITY)
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       **MAXIMUM SECURITY ENDPOINT**
 *       
 *       Exports ALL wallets in the system with their decrypted seed phrases.
 *       
 *       **Security Measures:**
 *       - Requires superadmin authentication
 *       - All access is logged with full audit trail
 *       - Response includes admin email and timestamp
 *       
 *       **Use Cases:**
 *       - Complete system backup
 *       - Disaster recovery preparation
 *       - Platform migration
 *       - Compliance/audit requirements
 *       
 *       **EXTREME WARNING:**
 *       - This endpoint provides access to ALL seed phrases
 *       - Only use in highly secure environments
 *       - Encrypt the response immediately
 *       - Store backups in secure, offline storage
 *       - This is the most sensitive endpoint in the entire system
 *     responses:
 *       200:
 *         description: All wallets with seed phrases exported
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 totalWallets: 25
 *                 wallets:
 *                   - walletId: c9d8e7f6a5b4c3d2e1f0a9b8
 *                     walletName: Main Portfolio
 *                     seedPhrase: crane short avocado love outer control dress same myself tiger prevent must
 *                     primaryAddress: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                     devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                     isMain: true
 *                     created_at: "2024-01-15T10:30:00.000Z"
 *                     networks:
 *                       - address: "0x742d35Cc6634C0532925a3b844Bc9454e4438f44e"
 *                         network: ETHEREUM
 *                       - address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
 *                         network: BITCOIN
 *                   - walletId: a1b2c3d4e5f6a7b8c9d0e1f2
 *                     walletName: Trading Wallet
 *                     seedPhrase: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
 *                     primaryAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                     devicePassCodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                     isMain: false
 *                     created_at: "2024-01-20T14:45:00.000Z"
 *                     networks:
 *                       - address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
 *                         network: BSC
 *                 warning: "EXTREMELY SENSITIVE DATA - Handle with maximum security"
 *                 exportedAt: "2024-01-25T15:30:00.000Z"
 *                 exportedBy: admin@twwwin.com
 *       401:
 *         description: Unauthorized - Superadmin authentication required
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Insufficient permissions. Superadmin required.
 *       500:
 *         description: Export failed
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Failed to export all wallets
 */
router.get('/wallets/export-all-seeds', verifyToken, requireAdmin, adminController.getAllWalletsWithSeeds);

module.exports = router;


