/**
 * TronWeb Utility
 * 
 * Centralized utility for creating TronWeb instances with TronGrid API key configuration
 */

require('dotenv').config();

/**
 * Get TronWeb constructor - handles different export patterns
 */
function getTronWebClass() {
  const TronWebModule = require("tronweb");

  // Try named export first
  if (TronWebModule.TronWeb && typeof TronWebModule.TronWeb === "function") {
    return TronWebModule.TronWeb;
  }

  // Try default.TronWeb
  if (
    TronWebModule.default &&
    TronWebModule.default.TronWeb &&
    typeof TronWebModule.default.TronWeb === "function"
  ) {
    return TronWebModule.default.TronWeb;
  }

  // Try default export
  if (TronWebModule.default && typeof TronWebModule.default === "function") {
    return TronWebModule.default;
  }

  // Try direct export
  if (typeof TronWebModule === "function") {
    return TronWebModule;
  }

  throw new Error(
    "TronWeb constructor not found. Please check tronweb package installation."
  );
}

/**
 * Create TronWeb instance with TronGrid API key configured
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.fullHost - TronGrid API endpoint (default: https://api.trongrid.io)
 * @param {string} options.privateKey - Private key (optional)
 * @param {Object} options.headers - Additional headers (optional)
 * @returns {Object} TronWeb instance
 */
function createTronWeb(options = {}) {
  const TronWebClass = getTronWebClass();
  const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_PRO_API_KEY;
  
  const defaultHeaders = {};
  
  // Add API key header if available
  if (apiKey) {
    // TronGrid uses TRON-PRO-API-KEY header
    defaultHeaders['TRON-PRO-API-KEY'] = apiKey;
  }
  
  // Merge with any provided headers
  const headers = {
    ...defaultHeaders,
    ...(options.headers || {})
  };
  
  const config = {
    fullHost: options.fullHost || 'https://api.trongrid.io',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    ...(options.privateKey ? { privateKey: options.privateKey } : {})
  };
  
  // Remove undefined values
  Object.keys(config).forEach(key => {
    if (config[key] === undefined) {
      delete config[key];
    }
  });
  
  return new TronWebClass(config);
}

/**
 * Get TronGrid API headers for direct HTTP requests
 * 
 * @returns {Object} Headers object with API key
 */
function getTronGridHeaders() {
  const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_PRO_API_KEY;
  const headers = {};
  
  if (apiKey) {
    headers['TRON-PRO-API-KEY'] = apiKey;
  }
  
  return headers;
}

module.exports = {
  getTronWebClass,
  createTronWeb,
  getTronGridHeaders
};

