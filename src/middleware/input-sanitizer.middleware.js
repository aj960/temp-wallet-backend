const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const auditLogger = require("../security/audit-logger.service");

/**
 * Sanitize all user inputs to prevent XSS and injection attacks
 */
exports.sanitizeInputs = (req, res, next) => {
  try {
    // Apply XSS cleaning
    xss()(req, res, () => {
      // Apply NoSQL injection protection
      mongoSanitize()(req, res, () => {
        // Additional custom sanitization
        sanitizeRequestData(req);
        next();
      });
    });
  } catch (error) {
    auditLogger.logError(error, { middleware: "sanitizeInputs" });
    return res.status(400).json({
      success: false,
      error: "Invalid input data format",
    });
  }
};

/**
 * Custom sanitization for specific fields
 */
function sanitizeRequestData(req) {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip null or undefined
    if (value === null || value === undefined) {
      sanitized[key] = value;
      continue;
    }

    // Sanitize nested objects
    if (typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
      continue;
    }

    // Sanitize arrays
    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "object"
          ? sanitizeObject(item)
          : sanitizeString(String(item))
      );
      continue;
    }

    // Sanitize strings
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
      continue;
    }

    // Keep other types as-is (numbers, booleans)
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Sanitize string values
 */
function sanitizeString(str) {
  if (typeof str !== "string") return str;

  // Remove null bytes
  str = str.replace(/\0/g, "");

  // Trim whitespace
  str = str.trim();

  // Remove potentially dangerous patterns
  str = str.replace(/[<>]/g, ""); // Remove < and >
  str = str.replace(/javascript:/gi, ""); // Remove javascript: protocol
  str = str.replace(/on\w+\s*=/gi, ""); // Remove event handlers

  return str;
}

/**
 * Prevent parameter pollution
 */
exports.preventParamPollution = (req, res, next) => {
  // Check for duplicate parameters in query string
  const queryKeys = Object.keys(req.query);
  const duplicates = queryKeys.filter(
    (key, index) => queryKeys.indexOf(key) !== index
  );

  if (duplicates.length > 0) {
    auditLogger.logSecurityAlert({
      alert: "PARAMETER_POLLUTION_DETECTED",
      details: {
        duplicates,
        query: req.query,
      },
      ip: req.ip,
    });

    return res.status(400).json({
      success: false,
      error: "Invalid query parameters detected",
    });
  }

  next();
};

/**
 * Validate content type for POST/PUT requests
 */
exports.validateContentType = (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    console.log("req.body", req.body);
    const contentType = req.get("Content-Type");

    if (!contentType || !contentType.includes("application/json")) {
      auditLogger.logSecurityAlert({
        alert: "INVALID_CONTENT_TYPE",
        details: {
          method: req.method,
          contentType,
          endpoint: req.originalUrl,
        },
        ip: req.ip,
      });

      return res.status(415).json({
        success: false,
        error: "Content-Type must be application/json",
      });
    }
  }

  next();
};

/**
 * Limit request body size
 */
exports.limitBodySize = (maxSize = "10mb") => {
  return (req, res, next) => {
    const contentLength = req.get("Content-Length");

    if (contentLength && parseInt(contentLength) > parseSize(maxSize)) {
      auditLogger.logSecurityAlert({
        alert: "OVERSIZED_REQUEST",
        details: {
          contentLength,
          maxSize,
          endpoint: req.originalUrl,
        },
        ip: req.ip,
      });

      return res.status(413).json({
        success: false,
        error: "Request body too large",
      });
    }

    next();
  };
};

/**
 * Parse size string to bytes
 */
function parseSize(size) {
  if (typeof size === "number") return size;

  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  return value * (units[unit] || 0);
}
