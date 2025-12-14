const helmet = require('helmet');
const hpp = require('hpp');
const cors = require('cors');
const auditLogger = require('./../security/audit-logger.service');

/**
 * Complete security configuration for Express app
 * Supports both HTTP (for development/pre-SSL) and HTTPS (for production with SSL)
 */
class SecurityConfig {
  /**
   * Apply all security configurations
   */
  static configure(app) {
    // 1. Apply security headers
    this.applySecurityHeaders(app);
    
    // 2. Configure CORS
    this.configureCORS(app);
    
    // 3. Apply request protection
    this.applyRequestProtection(app);
    
    // 4. Apply additional security measures
    this.applyAdditionalSecurity(app);
    
    auditLogger.logger.info('Security configuration applied successfully');
  }
  
  /**
   * Apply comprehensive security headers
   */
  static applySecurityHeaders(app) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const useHttps = process.env.USE_HTTPS === 'true';
    
    app.use(helmet({
      // Content Security Policy - RELAXED for Swagger UI and HTTP environments
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          // CRITICAL: 'unsafe-inline' required for Swagger UI to work
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          // ONLY upgrade to HTTPS if explicitly enabled
          ...(useHttps ? { upgradeInsecureRequests: [] } : {})
        }
      },
      
      // Cross-Origin policies - RELAXED when not using HTTPS
      crossOriginEmbedderPolicy: useHttps,
      crossOriginOpenerPolicy: { policy: useHttps ? 'same-origin' : 'unsafe-none' },
      crossOriginResourcePolicy: { policy: useHttps ? 'same-origin' : 'cross-origin' },
      
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      
      // Expect-CT - ONLY with HTTPS
      ...(useHttps ? {
        expectCt: {
          maxAge: 86400,
          enforce: true
        }
      } : {}),
      
      // Frame Options
      frameguard: { action: 'deny' },
      
      // Hide Powered By
      hidePoweredBy: true,
      
      // HSTS - ONLY with HTTPS
      ...(useHttps ? {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      } : {}),
      
      // IE No Open
      ieNoOpen: true,
      
      // No Sniff
      noSniff: true,
      
      // Origin Agent Cluster
      originAgentCluster: true,
      
      // Permitted Cross-Domain Policies
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      
      // Referrer Policy
      referrerPolicy: { policy: 'no-referrer' },
      
      // XSS Filter
      xssFilter: true
    }));
    
    // Additional custom headers
    app.use((req, res, next) => {
      // Remove fingerprinting headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Add custom security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      res.setHeader('X-Download-Options', 'noopen');
      res.setHeader('X-DNS-Prefetch-Control', 'off');
      
      next();
    });
    
    // Log security configuration
    auditLogger.logger.info({
      type: 'SECURITY_HEADERS_CONFIGURED',
      environment: process.env.NODE_ENV || 'development',
      httpsEnabled: useHttps,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Configure CORS with strict settings
   */
  static configureCORS(app) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Get allowed origins from environment
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : [];
    
    // Add default development origins if in development mode
    if (isDevelopment) {
      const devOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ];
      devOrigins.forEach(origin => {
        if (!allowedOrigins.includes(origin)) {
          allowedOrigins.push(origin);
        }
      });
    }
    
    const corsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (Postman, mobile apps, curl)
        if (!origin) {
          return callback(null, true);
        }
        
        // In production with specific allowed origins, check them
        if (!isDevelopment && allowedOrigins.length > 0) {
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error('Not allowed by CORS'));
        }
        
        // Otherwise allow
        return callback(null, true);
      },
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Requested-With',
        'Accept',
        'Origin'
      ],
      exposedHeaders: [
        'X-RateLimit-Limit', 
        'X-RateLimit-Remaining', 
        'X-RateLimit-Reset',
        'X-Request-ID'
      ],
      maxAge: 86400,
      preflightContinue: false
    };
    
    // Apply CORS
    app.use(cors(corsOptions));
    
    // Log CORS configuration on startup
    auditLogger.logger.info({
      type: 'CORS_CONFIGURED',
      environment: process.env.NODE_ENV || 'development',
      allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : 'all',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Apply request protection measures
   */
  static applyRequestProtection(app) {
    // Prevent HTTP Parameter Pollution
    app.use(hpp({
      whitelist: ['limit', 'page', 'sort', 'fields']
    }));
    
    // Trust proxy (for rate limiting behind reverse proxy)
    app.set('trust proxy', 1);
    
    // Disable ETag
    app.set('etag', false);
    
    // Disable X-Powered-By
    app.disable('x-powered-by');
  }
  
  /**
   * Apply additional security measures
   */
  static applyAdditionalSecurity(app) {
    // Log all requests
    app.use((req, res, next) => {
      auditLogger.logger.info({
        type: 'HTTP_REQUEST',
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });
    
    // Prevent response splitting
    app.use((req, res, next) => {
      const originalSetHeader = res.setHeader;
      res.setHeader = function(name, value) {
        if (typeof value === 'string') {
          value = value.replace(/[\r\n]/g, '');
        }
        return originalSetHeader.call(this, name, value);
      };
      next();
    });
    
    // Add request ID for tracing
    app.use((req, res, next) => {
      req.id = require('crypto').randomBytes(16).toString('hex');
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }
  
  /**
   * Apply global error handler
   */
  static applyErrorHandler(app) {
    // 404 handler
    app.use((req, res) => {
      auditLogger.logger.warn({
        type: '404_NOT_FOUND',
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    });
    
    // Global error handler
    app.use((err, req, res, next) => {
      // Log the full error details
      console.error('=== ERROR CAUGHT ===');
      console.error('Error:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      console.error('Request URL:', req.originalUrl);
      console.error('Request method:', req.method);
      console.error('===================');
      
      auditLogger.logError(err, {
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      
      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(err.statusCode || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
      });
    });
  }
}

module.exports = SecurityConfig;




