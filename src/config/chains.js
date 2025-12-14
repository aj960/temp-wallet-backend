/**
 * Simplified Chain Configuration
 * 
 * ✅ MIGRATED TO PUBLICNODE by Allnodes
 * - All RPCs now use PublicNode (free, no API keys)
 * - No environment variables needed for RPC URLs
 * - Automatic failover to Ankr backups
 */

module.exports = {
  eth: { 
    name: 'Ethereum', 
    rpc: 'https://ethereum-rpc.publicnode.com'  // PublicNode (no API key needed)
  },
  bsc: { 
    name: 'Binance Smart Chain', 
    rpc: 'https://bsc-rpc.publicnode.com'       // PublicNode (no API key needed)
  },
  polygon: { 
    name: 'Polygon', 
    rpc: 'https://polygon-bor-rpc.publicnode.com' // PublicNode (no API key needed)
  },
};

