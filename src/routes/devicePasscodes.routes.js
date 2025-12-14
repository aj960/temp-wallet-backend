const express = require('express');
const router = express.Router();
const devicePasscodesController = require('../controllers/devicePasscodes.controller');
const { validate } = require('../middleware/validation.middleware');
const { validateDevicePasscode, validateIdParam } = require('../utils/validators');
const rateLimiter = require('../security/rate-limiter.service');

/**
 * @swagger
 * tags:
 *   name: DevicePassCodes
 *   description: Secure device passcode management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DevicePasscode:
 *       type: object
 *       required:
 *         - name
 *         - passcode
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           pattern: '^[a-zA-Z0-9-_]+$'
 *           description: Unique device identifier (alphanumeric, hyphens, underscores only)
 *           example: MyPixel7Pro
 *         passcode:
 *           type: string
 *           minLength: 4
 *           maxLength: 20
 *           description: Secure passcode for device authentication
 *           example: "SecurePass123!"
 *     DevicePasscodeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: Device passcode created successfully
 *             serverPasscodeId:
 *               type: string
 *               example: 58e634c7e4f7704f6dfd9018e5bd7726
 *             deviceName:
 *               type: string
 *               example: MyPixel7Pro
 *     ValidationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             valid:
 *               type: boolean
 *               example: true
 *             message:
 *               type: string
 *               example: Passcode valid
 *             serverPasscodeId:
 *               type: string
 *               example: 58e634c7e4f7704f6dfd9018e5bd7726
 *     DeviceList:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: 58e634c7e4f7704f6dfd9018e5bd7726
 *               name:
 *                 type: string
 *                 example: MyPixel7Pro
 *               is_biometric_enabled:
 *                 type: integer
 *                 example: 1
 *               is_old:
 *                 type: integer
 *                 example: 0
 *               created_at:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-15T10:30:00Z
 */

/**
 * @swagger
 * /device-passcodes:
 *   post:
 *     summary: Create device passcode (Rate limited)
 *     tags: [DevicePassCodes]
 *     description: |
 *       Creates a new device passcode for authentication. 
 *       - Rate limited to 10 requests per 15 minutes
 *       - Automatically marks old passcodes as obsolete
 *       - Returns server-generated passcode ID for future operations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DevicePasscode'
 *           examples:
 *             smartphone:
 *               summary: Smartphone Device
 *               value:
 *                 name: MyiPhone14Pro
 *                 passcode: "SecurePass2024!"
 *             tablet:
 *               summary: Tablet Device
 *               value:
 *                 name: iPadAir_2024
 *                 passcode: "TabletPin9876"
 *             desktop:
 *               summary: Desktop Computer
 *               value:
 *                 name: MacBookPro-M3
 *                 passcode: "DesktopAuth#456"
 *     responses:
 *       201:
 *         description: Device passcode created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DevicePasscodeResponse'
 *             example:
 *               success: true
 *               data:
 *                 message: Device passcode created successfully
 *                 serverPasscodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *                 deviceName: MyiPhone14Pro
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Device name contains invalid characters
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Too many passcode attempts. Please try again later.
 *               retryAfter: 900
 */
router.post(
  '/',
  rateLimiter.devicePasscodeLimiter,
  validateDevicePasscode,
  validate,
  devicePasscodesController.createDevicePassCode
);

/**
 * @swagger
 * /device-passcodes/validate:
 *   post:
 *     summary: Validate device passcode (Rate limited - 10 attempts per 15 min)
 *     tags: [DevicePassCodes]
 *     description: |
 *       Validates a device passcode for authentication.
 *       - Strictly rate limited to prevent brute force attacks
 *       - Returns passcode ID only on successful validation
 *       - Use for device login/authentication flows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - passcode
 *             properties:
 *               name:
 *                 type: string
 *                 example: MyiPhone14Pro
 *               passcode:
 *                 type: string
 *                 example: "SecurePass2024!"
 *           examples:
 *             validPasscode:
 *               summary: Valid Passcode
 *               value:
 *                 name: MyiPhone14Pro
 *                 passcode: "SecurePass2024!"
 *             invalidPasscode:
 *               summary: Invalid Passcode (for testing)
 *               value:
 *                 name: MyiPhone14Pro
 *                 passcode: "WrongPassword123"
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResponse'
 *             examples:
 *               success:
 *                 summary: Valid Passcode
 *                 value:
 *                   success: true
 *                   data:
 *                     valid: true
 *                     message: Passcode valid
 *                     serverPasscodeId: 58e634c7e4f7704f6dfd9018e5bd7726
 *               failure:
 *                 summary: Invalid Passcode
 *                 value:
 *                   success: true
 *                   data:
 *                     valid: false
 *                     message: Invalid passcode
 *                     serverPasscodeId: null
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Device name and passcode are required
 *       429:
 *         description: Too many attempts
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Too many passcode attempts. Please try again later.
 *               retryAfter: 900
 */
router.post(
  '/validate',
  rateLimiter.devicePasscodeLimiter,
  validateDevicePasscode,
  validate,
  devicePasscodesController.validateDevicePassCode
);

/**
 * @swagger
 * /device-passcodes:
 *   get:
 *     summary: List all device passcodes
 *     tags: [DevicePassCodes]
 *     description: Returns all registered device passcodes with metadata (passcode hashes not included)
 *     responses:
 *       200:
 *         description: List of device passcodes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceList'
 *             example:
 *               success: true
 *               data:
 *                 - id: 58e634c7e4f7704f6dfd9018e5bd7726
 *                   name: MyiPhone14Pro
 *                   is_biometric_enabled: 1
 *                   is_old: 0
 *                   created_at: 2024-01-15T10:30:00Z
 *                 - id: a7b3c8d9e2f4g5h6i7j8k9l0m1n2o3p4
 *                   name: iPadAir_2024
 *                   is_biometric_enabled: 0
 *                   is_old: 0
 *                   created_at: 2024-01-20T14:45:00Z
 *                 - id: q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0
 *                   name: MacBookPro-M3
 *                   is_biometric_enabled: 1
 *                   is_old: 1
 *                   created_at: 2023-12-01T08:15:00Z
 */
router.get('/', devicePasscodesController.listDevicePassCodes);

/**
 * @swagger
 * /device-passcodes/{id}:
 *   get:
 *     summary: Get device passcode by ID
 *     tags: [DevicePassCodes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 32
 *           maxLength: 64
 *         description: Device passcode ID (32-64 character hex string)
 *         example: 58e634c7e4f7704f6dfd9018e5bd7726
 *     responses:
 *       200:
 *         description: Device passcode details
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 58e634c7e4f7704f6dfd9018e5bd7726
 *                 name: MyiPhone14Pro
 *                 is_biometric_enabled: 1
 *                 is_old: 0
 *                 created_at: 2024-01-15T10:30:00Z
 *       404:
 *         description: Device passcode not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Device passcode record not found
 */
router.get(
  '/:id',
  validateIdParam,
  validate,
  devicePasscodesController.getDevicePassCodeById
);

/**
 * @swagger
 * /device-passcodes/{id}:
 *   put:
 *     summary: Update device passcode
 *     tags: [DevicePassCodes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 58e634c7e4f7704f6dfd9018e5bd7726
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: MyiPhone15Pro
 *               passcode:
 *                 type: string
 *                 example: "NewSecurePass2024!"
 *               isBiometricEnabled:
 *                 type: boolean
 *                 example: true
 *           examples:
 *             updateName:
 *               summary: Update Device Name Only
 *               value:
 *                 name: MyiPhone15ProMax
 *             updatePasscode:
 *               summary: Update Passcode Only
 *               value:
 *                 passcode: "NewStrongerPass456!"
 *             enableBiometric:
 *               summary: Enable Biometric Authentication
 *               value:
 *                 isBiometricEnabled: true
 *             updateAll:
 *               summary: Update All Fields
 *               value:
 *                 name: MyNewDevice2024
 *                 passcode: "UltraSecure789#"
 *                 isBiometricEnabled: true
 *     responses:
 *       200:
 *         description: Updated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Device passcode updated successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: No fields provided for update
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Device passcode not found or no changes made
 */
router.put(
  '/:id',
  validateIdParam,
  validate,
  devicePasscodesController.updateDevicePassCode
);

/**
 * @swagger
 * /device-passcodes/{id}:
 *   delete:
 *     summary: Delete device passcode
 *     tags: [DevicePassCodes]
 *     description: Permanently removes a device passcode. This action cannot be undone.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 58e634c7e4f7704f6dfd9018e5bd7726
 *     responses:
 *       200:
 *         description: Deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Device passcode deleted successfully
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Device passcode not found
 */
router.delete(
  '/:id',
  validateIdParam,
  validate,
  devicePasscodesController.deleteDevicePassCode
);

/**
 * @swagger
 * /device-passcodes/biometric/{name}:
 *   put:
 *     summary: Update biometric status
 *     tags: [DevicePassCodes]
 *     description: Enable or disable biometric authentication (Face ID, Fingerprint, etc.) for a device
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Device name
 *         example: MyiPhone14Pro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isBiometricEnabled
 *             properties:
 *               isBiometricEnabled:
 *                 type: boolean
 *                 description: Enable (true) or disable (false) biometric authentication
 *           examples:
 *             enable:
 *               summary: Enable Biometric
 *               value:
 *                 isBiometricEnabled: true
 *             disable:
 *               summary: Disable Biometric
 *               value:
 *                 isBiometricEnabled: false
 *     responses:
 *       200:
 *         description: Biometric status updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 message: Biometric status updated successfully
 *                 deviceName: MyiPhone14Pro
 *                 isBiometricEnabled: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: isBiometricEnabled is required
 *       404:
 *         description: Device not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: Active device passcode record not found
 */
router.put(
  '/biometric/:name',
  devicePasscodesController.updateBiometricStatus
);

module.exports = router;



