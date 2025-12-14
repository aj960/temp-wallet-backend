const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class AuditLogger {
  constructor() {
    // Create Winston logger with multiple transports
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'trustwallet-backend' },
      transports: [
        // Error log
        new winston.transports.File({
          filename: process.env.ERROR_LOG_PATH || path.join(logsDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        // Audit log (all security events)
        new winston.transports.File({
          filename: process.env.AUDIT_LOG_PATH || path.join(logsDir, 'audit.log'),
          maxsize: 5242880,
          maxFiles: 10
        }),
        // Combined log
        new winston.transports.File({
          filename: process.env.COMBINED_LOG_PATH || path.join(logsDir, 'combined.log'),
          maxsize: 5242880,
          maxFiles: 5
        })
      ]
    });

    // Add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  /**
   * Log security event
   * @param {object} event - Security event details
   */
  logSecurityEvent(event) {
    this.logger.info({
      type: 'SECURITY_EVENT',
      ...event,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log wallet creation
   */
  logWalletCreation(data) {
    this.logger.info({
      type: 'WALLET_CREATED',
      walletId: data.walletId,
      deviceId: data.deviceId,
      address: data.address,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log mnemonic import
   */
  logMnemonicImport(data) {
    this.logger.warn({
      type: 'MNEMONIC_IMPORTED',
      walletId: data.walletId,
      deviceId: data.deviceId,
      address: data.address,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log authentication attempt
   */
  logAuthAttempt(data) {
    this.logger.info({
      type: data.success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
      email: data.email,
      ip: data.ip,
      userAgent: data.userAgent,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log API key usage
   */
  logApiKeyUsage(data) {
    this.logger.info({
      type: 'API_KEY_USED',
      apiKey: data.apiKey.substring(0, 10) + '...',
      endpoint: data.endpoint,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log transaction
   */
  logTransaction(data) {
    this.logger.info({
      type: 'TRANSACTION',
      walletId: data.walletId,
      txHash: data.txHash,
      from: data.from,
      to: data.to,
      amount: data.amount,
      token: data.token,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log critical security alert
   */
  logSecurityAlert(data) {
    this.logger.error({
      type: 'SECURITY_ALERT',
      alert: data.alert,
      details: data.details,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log access denied
   */
  logAccessDenied(data) {
    this.logger.warn({
      type: 'ACCESS_DENIED',
      reason: data.reason,
      endpoint: data.endpoint,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error
   */
  logError(error, context = {}) {
    this.logger.error({
      type: 'ERROR',
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new AuditLogger();





