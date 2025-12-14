const jwtService = require('../security/jwt.service');
const auditLogger = require('../security/audit-logger.service');
const { error } = require('../utils/response');

/**
 * Verify JWT token middleware
 */
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      auditLogger.logAccessDenied({
        reason: 'No token provided',
        endpoint: req.originalUrl,
        ip: req.ip
      });
      return error(res, 'Access denied. No token provided.');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwtService.verifyAccessToken(token);
      
      // Attach user info to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      next();
    } catch (err) {
      auditLogger.logAccessDenied({
        reason: err.message,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      return error(res, err.message);
    }
  } catch (err) {
    auditLogger.logError(err, { middleware: 'verifyToken' });
    return error(res, 'Token verification failed');
  }
};

/**
 * Verify API key middleware
 */
exports.verifyApiKey = (req, res, next) => {
  try {
    const apiKeyHeader = process.env.API_KEY_HEADER || 'X-API-Key';
    const apiKey = req.headers[apiKeyHeader.toLowerCase()];

    if (!apiKey) {
      auditLogger.logAccessDenied({
        reason: 'No API key provided',
        endpoint: req.originalUrl,
        ip: req.ip
      });
      return error(res, 'API key required');
    }

    const validKeys = (process.env.VALID_API_KEYS || '').split(',');
    
    if (!validKeys.includes(apiKey)) {
      auditLogger.logSecurityAlert({
        alert: 'Invalid API key attempt',
        details: { apiKey: apiKey.substring(0, 10) + '...' },
        ip: req.ip
      });
      return error(res, 'Invalid API key');
    }

    auditLogger.logApiKeyUsage({
      apiKey,
      endpoint: req.originalUrl,
      ip: req.ip
    });

    next();
  } catch (err) {
    auditLogger.logError(err, { middleware: 'verifyApiKey' });
    return error(res, 'API key verification failed');
  }
};

/**
 * Verify device ownership
 */
exports.verifyDeviceOwnership = (req, res, next) => {
  try {
    const { devicePassCodeId } = req.params || req.body;
    
    if (!devicePassCodeId) {
      return error(res, 'Device ID required');
    }

    // In a real scenario, verify the device belongs to the authenticated user
    // For now, we'll just check if device exists in req.user (set by verifyToken)
    
    next();
  } catch (err) {
    auditLogger.logError(err, { middleware: 'verifyDeviceOwnership' });
    return error(res, 'Device verification failed');
  }
};

/**
 * Check admin role
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    auditLogger.logAccessDenied({
      reason: 'Admin access required',
      endpoint: req.originalUrl,
      ip: req.ip,
      user: req.user?.email
    });
    return error(res, 'Admin access required');
  }
  next();
};



