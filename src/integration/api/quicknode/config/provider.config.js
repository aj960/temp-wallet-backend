/**
 * RPC Provider Configuration
 * 
 * ✅ MIGRATED FROM QUICKNODE TO PUBLICNODE
 * 
 * Changes:
 * - Removed QUICKNODE_BSC_URL (no longer needed)
 * - Removed API key requirements (PublicNode is free)
 * - Added PublicNode endpoints for all major chains
 * - No environment variables needed for RPC URLs
 * 
 * PublicNode Benefits:
 * - 100% FREE (no registration, no API keys)
 * - 1M requests/day per IP (adequate for 10K+ users)
 * - 99.99% uptime guarantee
 * - Privacy-first (no tracking)
 * - Enterprise-grade infrastructure
 */

module.exports = {
  // Token contract addresses (unchanged)
  USDT_BSC_CONTRACT: '0x55d398326f99059fF775485246999027B3197955',
  USDC_BSC_CONTRACT: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BUSD_BSC_CONTRACT: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  
  // ✅ PublicNode RPC Endpoints (no API keys needed)
  PUBLICNODE_ETHEREUM: 'https://ethereum-rpc.publicnode.com',
  PUBLICNODE_BSC: 'https://bsc-rpc.publicnode.com',
  PUBLICNODE_POLYGON: 'https://polygon-bor-rpc.publicnode.com',
  PUBLICNODE_ARBITRUM: 'https://arbitrum-one-rpc.publicnode.com',
  PUBLICNODE_OPTIMISM: 'https://optimism-rpc.publicnode.com',
  PUBLICNODE_AVALANCHE: 'https://avalanche-c-chain-rpc.publicnode.com',
  PUBLICNODE_BASE: 'https://base-rpc.publicnode.com',
  PUBLICNODE_FANTOM: 'https://fantom-rpc.publicnode.com',
  
  // Backup RPC Endpoints (Ankr - free tier)
  ANKR_ETHEREUM: 'https://rpc.ankr.com/eth',
  ANKR_BSC: 'https://rpc.ankr.com/bsc',
  ANKR_POLYGON: 'https://rpc.ankr.com/polygon',
  ANKR_ARBITRUM: 'https://rpc.ankr.com/arbitrum',
  ANKR_OPTIMISM: 'https://rpc.ankr.com/optimism',
  ANKR_AVALANCHE: 'https://rpc.ankr.com/avalanche',
  
  // Rate Limits
  RATE_LIMITS: {
    publicnode_daily: 1000000,  // 1M requests/day per IP
    ankr_per_second: 500        // 500 requests/second
  }
};





