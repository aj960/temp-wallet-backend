/**
 * RPC Provider Service
 * 
 * ✅ MIGRATED FROM QUICKNODE TO PUBLICNODE
 * 
 * Changes:
 * - Renamed from quicknode.provider.js to rpc.provider.js
 * - Uses PublicNode as primary RPC (no API keys needed)
 * - Implements automatic failover to Ankr backup
 * - Supports multiple chains (not just BSC)
 * - Caches providers for performance
 * 
 * PublicNode: 100% free, no API keys, 1M req/day per IP
 */

const { ethers } = require('ethers');
const { 
  PUBLICNODE_BSC, 
  ANKR_BSC 
} = require('../config/provider.config');

// Provider cache to avoid recreating connections
const providerCache = new Map();

/**
 * Get BSC provider with automatic failover
 * @returns {ethers.providers.JsonRpcProvider} Connected provider
 */
function getBSCProvider() {
  const cacheKey = 'bsc';
  
  // Return cached provider if available
  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey);
  }

  // Try PublicNode first (Tier 1)
  try {
    const provider = new ethers.providers.JsonRpcProvider(PUBLICNODE_BSC);
    providerCache.set(cacheKey, provider);
    //console.log('✅ Connected to BSC via PublicNode');
    return provider;
  } catch (error) {
    console.warn('⚠️ PublicNode BSC failed, trying Ankr backup...');
  }

  // Fallback to Ankr (Tier 2)
  try {
    const provider = new ethers.providers.JsonRpcProvider(ANKR_BSC);
    providerCache.set(cacheKey, provider);
    //console.log('✅ Connected to BSC via Ankr (backup)');
    return provider;
  } catch (error) {
    console.error('❌ All BSC providers failed');
    throw new Error('Failed to connect to BSC network');
  }
}

/**
 * Get provider for any chain with failover
 * @param {string} chainId - Chain identifier (ethereum, bsc, polygon, etc.)
 * @returns {ethers.providers.JsonRpcProvider} Connected provider
 */
function getProvider(chainId) {
  const cacheKey = chainId.toLowerCase();
  
  // Return cached provider if available
  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey);
  }

  // PublicNode RPC URLs
  const PUBLICNODE_URLS = {
    ethereum: 'https://ethereum-rpc.publicnode.com',
    bsc: 'https://bsc-rpc.publicnode.com',
    polygon: 'https://polygon-bor-rpc.publicnode.com',
    arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
    optimism: 'https://optimism-rpc.publicnode.com',
    avalanche: 'https://avalanche-c-chain-rpc.publicnode.com',
    base: 'https://base-rpc.publicnode.com',
    fantom: 'https://fantom-rpc.publicnode.com',
  };

  // Ankr backup URLs
  const ANKR_URLS = {
    ethereum: 'https://rpc.ankr.com/eth',
    bsc: 'https://rpc.ankr.com/bsc',
    polygon: 'https://rpc.ankr.com/polygon',
    arbitrum: 'https://rpc.ankr.com/arbitrum',
    optimism: 'https://rpc.ankr.com/optimism',
    avalanche: 'https://rpc.ankr.com/avalanche',
    fantom: 'https://rpc.ankr.com/fantom',
    base: 'https://rpc.ankr.com/base',
  };

  // Try PublicNode first
  const publicnodeUrl = PUBLICNODE_URLS[cacheKey];
  if (publicnodeUrl) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(publicnodeUrl);
      providerCache.set(cacheKey, provider);
      //console.log(`✅ Connected to ${chainId} via PublicNode`);
      return provider;
    } catch (error) {
      console.warn(`⚠️ PublicNode ${chainId} failed, trying Ankr backup...`);
    }
  }

  // Fallback to Ankr
  const ankrUrl = ANKR_URLS[cacheKey];
  if (ankrUrl) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(ankrUrl);
      providerCache.set(cacheKey, provider);
      //console.log(`✅ Connected to ${chainId} via Ankr (backup)`);
      return provider;
    } catch (error) {
      console.error(`❌ All ${chainId} providers failed`);
      throw new Error(`Failed to connect to ${chainId} network`);
    }
  }

  throw new Error(`Chain ${chainId} not supported`);
}

/**
 * Get provider with async health check and automatic failover
 * @param {string} chainId - Chain identifier
 * @param {number} timeout - Connection timeout in ms
 * @returns {Promise<ethers.providers.JsonRpcProvider>} Connected provider
 */
async function getProviderWithHealthCheck(chainId, timeout = 10000) {
  const publicnodeUrls = {
    ethereum: 'https://ethereum-rpc.publicnode.com',
    bsc: 'https://bsc-rpc.publicnode.com',
    polygon: 'https://polygon-bor-rpc.publicnode.com',
    arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
    optimism: 'https://optimism-rpc.publicnode.com',
    avalanche: 'https://avalanche-c-chain-rpc.publicnode.com',
    base: 'https://base-rpc.publicnode.com',
    fantom: 'https://fantom-rpc.publicnode.com',
  };

  const ankrUrls = {
    ethereum: 'https://rpc.ankr.com/eth',
    bsc: 'https://rpc.ankr.com/bsc',
    polygon: 'https://rpc.ankr.com/polygon',
    arbitrum: 'https://rpc.ankr.com/arbitrum',
    optimism: 'https://rpc.ankr.com/optimism',
    avalanche: 'https://rpc.ankr.com/avalanche',
    fantom: 'https://rpc.ankr.com/fantom',
    base: 'https://rpc.ankr.com/base',
  };

  const normalizedChainId = chainId.toLowerCase();
  const rpcUrls = [
    publicnodeUrls[normalizedChainId],
    ankrUrls[normalizedChainId]
  ].filter(Boolean);

  if (rpcUrls.length === 0) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  // Try each provider with health check
  for (let i = 0; i < rpcUrls.length; i++) {
    const url = rpcUrls[i];
    const tier = i === 0 ? 'PublicNode' : 'Ankr';

    try {
      //console.log(`🔗 Connecting to ${chainId} via ${tier}...`);
      
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
      
      if (i === rpcUrls.length - 1) {
        throw new Error(`All RPC providers failed for ${chainId}`);
      }
    }
  }
}

/**
 * Clear provider cache (useful for reconnection scenarios)
 * @param {string} chainId - Optional chain ID to clear specific cache
 */
function clearCache(chainId = null) {
  if (chainId) {
    providerCache.delete(chainId.toLowerCase());
    //console.log(`🗑️ Cleared provider cache for ${chainId}`);
  } else {
    providerCache.clear();
    //console.log('🗑️ Cleared all provider cache');
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getProvider('bsc') or getBSCProvider() instead
 */
function getQuickNodeProvider() {
  console.warn('⚠️ getQuickNodeProvider() is deprecated. Use getProvider("bsc") instead.');
  return getBSCProvider();
}

module.exports = { 
  getBSCProvider,
  getProvider,
  getProviderWithHealthCheck,
  clearCache,
  
  // Legacy export for backward compatibility
  getQuickNodeProvider
};


