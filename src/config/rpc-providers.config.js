/**
 * RPC Provider Configuration with Multi-Tier Failover Strategy
 * 
 * Migration: QuickNode → PublicNode by Allnodes
 * 
 * PublicNode Benefits:
 * - 100% FREE (no API keys required)
 * - Privacy-first (no IP tracking)
 * - 99.99% uptime (Tier 3.5+ data centers)
 * - 1M requests/day per IP (~10K active users)
 * - 103 blockchains supported
 * - Enterprise-grade infrastructure
 * 
 * Failover Strategy:
 * Tier 1: PublicNode (Primary - Free, No API Key)
 * Tier 2: Ankr Public Nodes (Backup)
 * Tier 3: Chain-Specific Public RPCs (Emergency)
 */

const { ethers } = require('ethers');

/**
 * PublicNode RPC Endpoints (Primary Tier)
 * NO API KEYS REQUIRED - Always free, always accessible
 */
const PUBLICNODE_RPCS = {
  // Layer 1 Networks
  ethereum: 'https://ethereum-rpc.publicnode.com',
  bsc: 'https://bsc-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  avalanche: 'https://avalanche-c-chain-rpc.publicnode.com',
  
  // Layer 2 Networks
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
  optimism: 'https://optimism-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  
  // Other EVM Chains
  fantom: 'https://fantom-rpc.publicnode.com',
  gnosis: 'https://gnosis-rpc.publicnode.com',
  
  // Note: For WebSocket connections, replace https:// with wss://
  // Example: wss://ethereum-rpc.publicnode.com
};

/**
 * Ankr Public RPC Endpoints (Backup Tier)
 * Free tier with rate limits
 */
const ANKR_RPCS = {
  ethereum: 'https://rpc.ankr.com/eth',
  bsc: 'https://rpc.ankr.com/bsc',
  polygon: 'https://rpc.ankr.com/polygon',
  arbitrum: 'https://rpc.ankr.com/arbitrum',
  optimism: 'https://rpc.ankr.com/optimism',
  avalanche: 'https://rpc.ankr.com/avalanche',
  fantom: 'https://rpc.ankr.com/fantom',
  base: 'https://rpc.ankr.com/base',
};

/**
 * Chain-Specific Public RPCs (Emergency Tier)
 * Official or community-run nodes
 */
const FALLBACK_RPCS = {
  ethereum: 'https://eth.llamarpc.com',
  bsc: 'https://bsc-dataseed1.binance.org',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  fantom: 'https://rpc.ftm.tools',
  base: 'https://mainnet.base.org',
};

/**
 * Rate Limit Information
 * PublicNode: 1M requests/day per IP (soft limit)
 * Ankr: 500 requests/second (free tier)
 */
const RATE_LIMITS = {
  publicnode: {
    requestsPerDay: 1000000,
    requestsPerSecond: null, // No hard limit
    note: 'Soft limit - adequate for ~10,000 active users'
  },
  ankr: {
    requestsPerDay: null,
    requestsPerSecond: 500,
    note: 'Free tier rate limits'
  }
};

/**
 * Get prioritized RPC URLs for a chain
 * @param {string} chainId - Chain identifier (ethereum, bsc, polygon, etc.)
 * @returns {string[]} Array of RPC URLs in priority order
 */
function getRPCUrls(chainId) {
  const normalizedChainId = chainId.toLowerCase();
  
  const urls = [
    PUBLICNODE_RPCS[normalizedChainId],  // Tier 1: PublicNode
    ANKR_RPCS[normalizedChainId],        // Tier 2: Ankr
    FALLBACK_RPCS[normalizedChainId]     // Tier 3: Fallback
  ].filter(Boolean); // Remove undefined values

  if (urls.length === 0) {
    throw new Error(`No RPC URLs configured for chain: ${chainId}`);
  }

  return urls;
}

/**
 * Create an ethers.js provider with automatic failover
 * @param {string} chainId - Chain identifier
 * @param {number} timeout - Connection timeout in ms (default: 10000)
 * @returns {Promise<ethers.providers.JsonRpcProvider>} Connected provider
 */
async function getProviderWithFailover(chainId, timeout = 10000) {
  const rpcUrls = getRPCUrls(chainId);
  
  for (let i = 0; i < rpcUrls.length; i++) {
    const url = rpcUrls[i];
    const tier = i === 0 ? 'PublicNode' : i === 1 ? 'Ankr' : 'Fallback';
    
    try {
      //console.log(`🔗 Connecting to ${chainId} via ${tier}: ${url}`);
      
      const provider = new ethers.providers.JsonRpcProvider(url);
      
      // Health check with timeout
      const blockNumberPromise = provider.getBlockNumber();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), timeout)
      );
      
      await Promise.race([blockNumberPromise, timeoutPromise]);
      
      //console.log(`✅ Connected to ${chainId} via ${tier}`);
      return provider;
      
    } catch (error) {
      console.warn(`⚠️ ${tier} failed for ${chainId}: ${error.message}`);
      
      // If this was the last provider, throw error
      if (i === rpcUrls.length - 1) {
        throw new Error(`All RPC providers failed for ${chainId}. Last error: ${error.message}`);
      }
      
      // Otherwise, continue to next provider
      //console.log(`🔄 Trying next provider for ${chainId}...`);
    }
  }
}

/**
 * Create a static provider (no failover, uses PublicNode only)
 * Useful for simple operations where failover isn't critical
 * @param {string} chainId - Chain identifier
 * @returns {ethers.providers.JsonRpcProvider} Provider instance
 */
function getStaticProvider(chainId) {
  const url = PUBLICNODE_RPCS[chainId.toLowerCase()];
  
  if (!url) {
    // Fallback to Ankr if PublicNode doesn't support the chain
    const ankrUrl = ANKR_RPCS[chainId.toLowerCase()];
    if (!ankrUrl) {
      throw new Error(`Chain ${chainId} not supported by PublicNode or Ankr`);
    }
    //console.log(`ℹ️ ${chainId} not available on PublicNode, using Ankr`);
    return new ethers.providers.JsonRpcProvider(ankrUrl);
  }
  
  return new ethers.providers.JsonRpcProvider(url);
}

/**
 * Get WebSocket URL for real-time events (if needed)
 * @param {string} chainId - Chain identifier
 * @returns {string} WebSocket URL
 */
function getWebSocketUrl(chainId) {
  const httpUrl = PUBLICNODE_RPCS[chainId.toLowerCase()];
  
  if (!httpUrl) {
    throw new Error(`WebSocket not available for ${chainId} on PublicNode`);
  }
  
  // Convert HTTPS to WSS
  return httpUrl.replace('https://', 'wss://');
}

/**
 * Check if a chain is supported by PublicNode
 * @param {string} chainId - Chain identifier
 * @returns {boolean} True if supported
 */
function isPublicNodeSupported(chainId) {
  return PUBLICNODE_RPCS.hasOwnProperty(chainId.toLowerCase());
}

/**
 * Get all supported chains
 * @returns {string[]} Array of supported chain IDs
 */
function getSupportedChains() {
  return Object.keys(PUBLICNODE_RPCS);
}

module.exports = {
  // Provider Creation
  getProviderWithFailover,
  getStaticProvider,
  
  // RPC URL Management
  getRPCUrls,
  getWebSocketUrl,
  
  // Configuration Access
  PUBLICNODE_RPCS,
  ANKR_RPCS,
  FALLBACK_RPCS,
  RATE_LIMITS,
  
  // Utility Functions
  isPublicNodeSupported,
  getSupportedChains
};



