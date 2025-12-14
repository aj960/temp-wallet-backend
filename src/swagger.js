const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const os = require('os');

/**
 * Get server URLs dynamically based on environment
 */
const getServerUrls = () => {
  const servers = [];
  
  // Get the actual server IP/hostname
  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = process.env.PORT || 8083;
  
  // Production VPS server (Priority #1)
  if (process.env.VPS_IP || process.env.PUBLIC_IP) {
    const publicIp = process.env.VPS_IP || process.env.PUBLIC_IP;
    servers.push({
      url: `http://${publicIp}:${PORT}`,
      description: 'Production VPS Server'
    });
  }
  
  // Auto-detect VPS IP from network interfaces
  const networkInterfaces = os.networkInterfaces();
  const publicIps = [];
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        publicIps.push(iface.address);
      }
    }
  }
  
  // Add detected public IPs
  publicIps.forEach(ip => {
    servers.push({
      url: `http://${ip}:${PORT}`,
      description: `VPS Server (${ip})`
    });
  });
  
  // Replit environment
  if (process.env.REPLIT_DOMAINS) {
    const replitDomain = process.env.REPLIT_DOMAINS.split(',')[0];
    servers.push({
      url: `https://${replitDomain}`,
      description: 'Replit Production Server'
    });
  }
  
  // Local development (only if no production servers found)
  if (servers.length === 0 || process.env.NODE_ENV === 'development') {
    servers.push({
      url: `http://localhost:${PORT}`,
      description: 'Local Development Server'
    });
  }
  
  return servers;
};

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TwwWin Wallet API',
      version: '2.0.0',
      description: 'Production-grade multi-blockchain wallet backend supporting 15+ chains',
      contact: {
        name: 'API Support',
        email: 'support@twwwin.com'
      }
    },
    servers: getServerUrls(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token from /admin/login'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for authentication'
        }
      }
    },
    tags: [
      {
        name: 'MultiChain',
        description: 'Multi-blockchain wallet operations (BTC, ETH, SOL, XRP, etc.)'
      },
      {
        name: 'Wallet',
        description: 'Legacy wallet operations'
      },
      {
        name: 'DevicePassCodes',
        description: 'Secure device authentication'
      },
      {
        name: 'Admins',
        description: 'Admin management (Protected)'
      },
      {
        name: 'Monitoring',
        description: 'Balance monitoring and alerts'
      },
      {
        name: 'QuickNode',
        description: 'Blockchain node integration'
      },
      {
        name: 'QuickNode Wallet',
        description: 'Wallet generation and recovery'
      },
      {
        name: 'QuickNode Transactions',
        description: 'Transaction handling'
      },
      {
        name: 'QuickNode Balance',
        description: 'Balance checking'
      },
      {
        name: 'QuickNode Network',
        description: 'Network information'
      },
      {
        name: 'QuickNode Chain',
        description: 'Blockchain data'
      },
      {
        name: 'QuickNode Price',
        description: 'Token prices'
      },
      {
        name: 'QuickNode Health',
        description: 'Service health'
      },
      {
        name: 'QuickNode Validation',
        description: 'Address validation'
      },
      {
        name: '0x',
        description: 'Token swap operations'
      },
      {
        name: 'StaticNetwork',
        description: 'Network metadata'
      },
      {
        name: 'StaticNetworkImages',
        description: 'Network and token images'
      },
      {
        name: 'WalletNetwork',
        description: 'Blockchain network management'
      },
      {
        name: 'Health',
        description: 'System health and monitoring'
      }
    ]
  },
  apis: [
    // Use path.join to ensure correct paths
    path.join(__dirname, './routes/**/*.js'),
    path.join(__dirname, './wallet/routes/**/*.js'),
    path.join(__dirname, './integration/api/quicknode/**/*.js'),
    path.join(__dirname, './integration/api/0x/**/*.js'),
    
    // Also check parent directory structure
    path.join(__dirname, '../routes/**/*.js'),
    path.join(__dirname, '../wallet/routes/**/*.js'),
    path.join(__dirname, '../integration/api/quicknode/**/*.js'),
    path.join(__dirname, '../integration/api/0x/**/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

// Log the spec for debugging
//console.log('📚 Swagger spec generated');
//console.log('🔍 Looking for API docs in:', options.apis);
//console.log('📊 Number of paths found:', Object.keys(swaggerSpec.paths || {}).length);
//console.log('🌐 Server URLs configured:', swaggerSpec.servers);

// If no paths found, log warning
if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
  console.warn('⚠️  WARNING: No API endpoints found in Swagger documentation!');
  console.warn('💡 Make sure your route files contain JSDoc comments with @swagger or @openapi tags');
}

const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { 
      background-color: #1a1a1a; 
      height: 60px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      position: relative;
    }
    .swagger-ui .topbar a { display: none !important; }

    .swagger-ui .topbar:before {
      content: 'TwwWin Wallet API';
      color: white;
      font-size: 22px;
      font-weight: bold;
      position: absolute;
      left: 20px;
    }
    
    .swagger-ui .info .title {
      font-size: 32px;
      color: #1a1a1a;
    }
    
    .swagger-ui .scheme-container {
      background: #f7f7f7;
      padding: 15px;
      border-radius: 4px;
    }
    
    /* Highlight the server selector */
    .swagger-ui .servers {
      background: #fff3cd;
      border: 2px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    
    .swagger-ui .servers-title {
      font-weight: bold;
      color: #856404;
    }
  `,
  customSiteTitle: 'TwwWin Wallet API Docs',
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    // Show the "Servers" dropdown prominently
    defaultModelsExpandDepth: -1,
    displayOperationId: false,
    displayRequestDuration: true
  }
};

module.exports = { swaggerUi, swaggerSpec, swaggerOptions };

