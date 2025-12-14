const rateLimit = require('express-rate-limit');
const auditLogger = require('./audit-logger.service');

/**
 * General API rate limiter
 */
exports.apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogger.logSecurityAlert({
      alert: 'RATE_LIMIT_EXCEEDED',
      details: {
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method
      },
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000)
    });
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path === '/health' || req.path === '/';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 */
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later',
  handler: (req, res) => {
    auditLogger.logSecurityAlert({
      alert: 'AUTH_RATE_LIMIT_EXCEEDED',
      details: {
        ip: req.ip,
        endpoint: req.originalUrl,
        email: req.body?.email
      },
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Account temporarily locked.',
      retryAfter: 900 // 15 minutes in seconds
    });
  }
});

/**
 * Strict rate limiter for wallet creation
 */
exports.walletCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 wallets per hour
  message: 'Too many wallet creation attempts',
  handler: (req, res) => {
    auditLogger.logSecurityAlert({
      alert: 'WALLET_CREATION_RATE_LIMIT',
      details: {
        ip: req.ip,
        deviceId: req.body?.devicePassCodeId
      },
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      error: 'Wallet creation limit exceeded. Please try again later.',
      retryAfter: 3600
    });
  }
});

/**
 * Rate limiter for transaction endpoints
 */
exports.transactionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 transactions per 10 minutes
  message: 'Too many transaction attempts',
  handler: (req, res) => {
    auditLogger.logSecurityAlert({
      alert: 'TRANSACTION_RATE_LIMIT',
      details: {
        ip: req.ip,
        endpoint: req.originalUrl
      },
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      error: 'Transaction limit exceeded. Please wait before trying again.',
      retryAfter: 600
    });
  }
});

/**
 * Rate limiter for device passcode operations
 */
exports.devicePasscodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many passcode attempts',
  handler: (req, res) => {
    auditLogger.logSecurityAlert({
      alert: 'DEVICE_PASSCODE_RATE_LIMIT',
      details: {
        ip: req.ip,
        deviceName: req.body?.name
      },
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many passcode attempts. Please try again later.',
      retryAfter: 900
    });
  }
});

/**
 * Create custom rate limiter with specific options
 */
exports.createCustomLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  });
};



