const { body, param, query } = require('express-validator');
const { ethers } = require('ethers');

/**
 * Wallet creation validation
 */
exports.validateWalletCreation = [
  body('devicePassCodeId')
    .trim()
    .notEmpty()
    .withMessage('Device passcode ID is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid device passcode ID format'),
  
  body('walletName')
    .trim()
    .notEmpty()
    .withMessage('Wallet name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Wallet name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Wallet name contains invalid characters'),
  
  body('mnemonic')
    .trim()
    .notEmpty()
    .withMessage('Mnemonic is required')
    .custom((value) => {
      if (!ethers.utils.isValidMnemonic(value)) {
        throw new Error('Invalid mnemonic phrase');
      }
      return true;
    }),
  
  body('isSingleCoin')
    .optional()
    .isBoolean()
    .withMessage('isSingleCoin must be a boolean'),
  
  body('isMain')
    .optional()
    .isBoolean()
    .withMessage('isMain must be a boolean')
];

/**
 * Admin registration validation
 */
exports.validateAdminRegistration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@!!%*?&])[A-Za-z\d@!!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),

  body('role')
    .optional()
    .isIn(['superadmin', 'admin', 'viewer'])
    .withMessage('Invalid role')
];

/**
 * Admin login validation
 */
exports.validateAdminLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Device passcode creation validation
 */
exports.validateDevicePasscode = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Device name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Device name contains invalid characters'),

  body('passcode')
    .notEmpty()
    .withMessage('Passcode is required')
    .isLength({ min: 4, max: 20 })
    .withMessage('Passcode must be between 4 and 20 characters')
];

/**
 * Address validation
 */
exports.validateAddress = [
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .custom((value) => {
      if (!ethers.utils.isAddress(value)) {
        throw new Error('Invalid Ethereum address');
      }
      return true;
    })
];

/**
 * Transaction validation
 */
exports.validateTransaction = [
  body('privateKey')
    .trim()
    .notEmpty()
    .withMessage('Private key is required')
    .isLength({ min: 64, max: 66 })
    .withMessage('Invalid private key format'),

  body('to')
    .trim()
    .notEmpty()
    .withMessage('Recipient address is required')
    .custom((value) => {
      if (!ethers.utils.isAddress(value)) {
        throw new Error('Invalid recipient address');
      }
      return true;
    }),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number')
];

/**
 * ID parameter validation (generic)
 */
exports.validateIdParam = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('ID is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid ID format')
];

/**
 * Device passcode ID parameter validation (for /device/:devicePassCodeId routes)
 * ✅ NEW: Validates devicePassCodeId parameter correctly
 */
exports.validateDevicePassCodeIdParam = [
  param('devicePassCodeId')
    .trim()
    .notEmpty()
    .withMessage('Device passcode ID is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid device passcode ID format')
];

/**
 * Wallet ID parameter validation
 */
exports.validateWalletIdParam = [
  param('walletId')
    .trim()
    .notEmpty()
    .withMessage('Wallet ID is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid wallet ID format')
];

/**
 * Search query validation
 */
exports.validateSearchQuery = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];


