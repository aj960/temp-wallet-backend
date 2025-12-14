const helmet = require('helmet');
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');

/**
 * Apply all security headers
 */
exports.applySecurityHeaders = (app) => {
  // Helmet - sets various HTTP headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Data Sanitization against XSS
  app.use(xss());

  // Data Sanitization against NoSQL Injection
  app.use(mongoSanitize());

  // Disable X-Powered-By header
  app.disable('x-powered-by');
};



