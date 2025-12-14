const { validationResult } = require('express-validator');
const { error } = require('../utils/response');
const auditLogger = require('../security/audit-logger.service');

/**
 * Validate request and handle errors
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    auditLogger.logSecurityEvent({
      type: 'VALIDATION_ERROR',
      endpoint: req.originalUrl,
      errors: errors.array(),
      ip: req.ip
    });

    return error(res, 'Validation failed', {
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  
  next();
};




