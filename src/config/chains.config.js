require("dotenv").config();

/**
 * Comprehensive Multi-Chain Configuration
 * Supports all major blockchain networks like Trust Wallet
 *
 * ✅ MIGRATED TO PUBLICNODE by Allnodes
 * - Primary RPC: PublicNode (free, no API keys, 99.99% uptime)
 * - Backup RPC: Ankr public nodes
 * - Emergency: Chain-specific public RPCs
 *
 * PublicNode Rate Limits: 1M requests/day per IP (~10K active users)
 */

const CHAIN_TYPES = {
  EVM: "EVM", // Ethereum Virtual Machine compatible
  UTXO: "UTXO", // Bitcoin-like chains
  SOLANA: "SOLANA", // Solana
  RIPPLE: "RIPPLE", // XRP Ledger
  COSMOS: "COSMOS", // Cosmos SDK chains
  SUBSTRATE: "SUBSTRATE", // Polkadot/Substrate
  TRON: "TRON", // Tron
};

const CHAINS = {
  // ==========================================
  // ETHEREUM & EVM CHAINS
  // ==========================================
  ETHEREUM: {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    type: CHAIN_TYPES.EVM,
    chainId: 1,
    networkId: 1,
    decimals: 18,
    // ✅ PublicNode PRIMARY + Ankr BACKUP + Emergency fallback
    rpcUrls: [
      "https://ethereum-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/eth", // Ankr (Tier 2)
      "https://eth.llamarpc.com", // Fallback (Tier 3)
      "https://eth-mainnet.public.blastapi.io", // Emergency
    ],
    explorerUrl: "https://etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.2,
    icon: "ethereum.png",
    color: "#627EEA",
    enabled: true,
  },

  BSC: {
    id: "bsc",
    name: "BNB Smart Chain",
    symbol: "BNB",
    type: CHAIN_TYPES.EVM,
    chainId: 56,
    networkId: 56,
    decimals: 18,
    // ✅ PublicNode PRIMARY + Multiple backups
    rpcUrls: [
      "https://bsc-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/bsc", // Ankr (Tier 2)
      "https://bsc-dataseed1.binance.org", // Official Binance
      "https://bsc-dataseed2.binance.org", // Binance backup
      "https://bsc-dataseed3.binance.org", // Binance backup 2
    ],
    explorerUrl: "https://bscscan.com",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.1,
    icon: "bsc.png",
    color: "#F0B90B",
    enabled: true,
  },

  POLYGON: {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    type: CHAIN_TYPES.EVM,
    chainId: 137,
    networkId: 137,
    decimals: 18,
    // ✅ PublicNode PRIMARY
    rpcUrls: [
      "https://polygon-bor-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/polygon", // Ankr (Tier 2)
      "https://polygon-rpc.com", // Official
      "https://rpc-mainnet.matic.network", // Backup
      "https://polygon-mainnet.public.blastapi.io", // Emergency
    ],
    explorerUrl: "https://polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.2,
    icon: "polygon.png",
    color: "#8247E5",
    enabled: true,
  },

  ARBITRUM: {
    id: "arbitrum",
    name: "Arbitrum One",
    symbol: "ETH",
    type: CHAIN_TYPES.EVM,
    chainId: 42161,
    networkId: 42161,
    decimals: 18,
    // ✅ PublicNode PRIMARY
    rpcUrls: [
      "https://arbitrum-one-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/arbitrum", // Ankr (Tier 2)
      "https://arb1.arbitrum.io/rpc", // Official
      "https://arbitrum-one.public.blastapi.io", // Emergency
    ],
    explorerUrl: "https://arbiscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.1,
    icon: "arbitrum.png",
    color: "#28A0F0",
    enabled: true,
  },

  OPTIMISM: {
    id: "optimism",
    name: "Optimism",
    symbol: "ETH",
    type: CHAIN_TYPES.EVM,
    chainId: 10,
    networkId: 10,
    decimals: 18,
    // ✅ PublicNode PRIMARY
    rpcUrls: [
      "https://optimism-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/optimism", // Ankr (Tier 2)
      "https://mainnet.optimism.io", // Official
      "https://optimism-mainnet.public.blastapi.io", // Emergency
    ],
    explorerUrl: "https://optimistic.etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.1,
    icon: "optimism.png",
    color: "#FF0420",
    enabled: true,
  },

  AVALANCHE: {
    id: "avalanchec",
    name: "Avalanche C-Chain",
    symbol: "AVAX",
    type: CHAIN_TYPES.EVM,
    chainId: 43114,
    networkId: 43114,
    decimals: 18,
    // ✅ PublicNode PRIMARY
    rpcUrls: [
      "https://avalanche-c-chain-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/avalanche", // Ankr (Tier 2)
      "https://api.avax.network/ext/bc/C/rpc", // Official
      "https://avalanche-c-chain.publicnode.com", // Backup
    ],
    explorerUrl: "https://snowtrace.io",
    nativeCurrency: {
      name: "Avalanche",
      symbol: "AVAX",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.2,
    icon: "avalanchec.png",
    color: "#E84142",
    enabled: true,
  },

  FANTOM: {
    id: "fantom",
    name: "Fantom",
    symbol: "FTM",
    type: CHAIN_TYPES.EVM,
    chainId: 250,
    networkId: 250,
    decimals: 18,
    // ✅ PublicNode PRIMARY
    rpcUrls: [
      "https://fantom-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/fantom", // Ankr (Tier 2)
      "https://rpc.ftm.tools", // Official
      "https://fantom-mainnet.public.blastapi.io", // Emergency
    ],
    explorerUrl: "https://ftmscan.com",
    nativeCurrency: {
      name: "Fantom",
      symbol: "FTM",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.1,
    icon: "fantom.png",
    color: "#1969FF",
    enabled: true,
  },

  BASE: {
    id: "base",
    name: "Base",
    symbol: "ETH",
    type: CHAIN_TYPES.EVM,
    chainId: 8453,
    networkId: 8453,
    decimals: 18,
    // ✅ PublicNode PRIMARY
    rpcUrls: [
      "https://base-rpc.publicnode.com", // PublicNode (Tier 1)
      "https://rpc.ankr.com/base", // Ankr (Tier 2)
      "https://mainnet.base.org", // Official (Coinbase)
      "https://base-mainnet.public.blastapi.io", // Emergency
    ],
    explorerUrl: "https://basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    slip44: 60,
    derivationPath: "m/44'/60'/0'/0/0",
    supportsERC20: true,
    supportsERC721: true,
    supportsERC1155: true,
    gasEstimationMultiplier: 1.1,
    icon: "base.png",
    color: "#0052FF",
    enabled: true,
  },

  // ==========================================
  // BITCOIN & UTXO CHAINS
  // ==========================================
  BITCOIN: {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    type: CHAIN_TYPES.UTXO,
    decimals: 8,
    // Bitcoin uses explorer APIs, not RPC nodes
    rpcUrls: [
      "https://blockstream.info/api",
      "https://blockchain.info/api",
      "https://mempool.space/api",
    ],
    explorerUrl: "https://blockstream.info",
    nativeCurrency: {
      name: "Bitcoin",
      symbol: "BTC",
      decimals: 8,
    },
    slip44: 0,
    derivationPath: "m/44'/0'/0'/0/0",
    derivationPaths: {
      legacy: "m/44'/0'/0'/0/0",
      segwit: "m/49'/0'/0'/0/0",
      nativeSegwit: "m/84'/0'/0'/0/0",
    },
    addressFormats: ["P2PKH", "P2SH", "P2WPKH", "P2TR"],
    minFeeRate: 1,
    icon: "bitcoin.png",
    color: "#F7931A",
    enabled: true,
  },

  LITECOIN: {
    id: "litecoin",
    name: "Litecoin",
    symbol: "LTC",
    type: CHAIN_TYPES.UTXO,
    decimals: 8,
    rpcUrls: [
      "https://litecoin.nownodes.io",
      "https://api.blockcypher.com/v1/ltc/main",
    ],
    explorerUrl: "https://blockchair.com/litecoin",
    nativeCurrency: {
      name: "Litecoin",
      symbol: "LTC",
      decimals: 8,
    },
    slip44: 2,
    derivationPath: "m/44'/2'/0'/0/0",
    derivationPaths: {
      legacy: "m/44'/2'/0'/0/0",
      segwit: "m/49'/2'/0'/0/0",
      nativeSegwit: "m/84'/2'/0'/0/0",
    },
    icon: "litecoin.png",
    color: "#345D9D",
    enabled: true,
  },

  DOGECOIN: {
    id: "dogecoin",
    name: "Dogecoin",
    symbol: "DOGE",
    type: CHAIN_TYPES.UTXO,
    decimals: 8,
    rpcUrls: ["https://dogecoin.nownodes.io"],
    explorerUrl: "https://dogechain.info",
    nativeCurrency: {
      name: "Dogecoin",
      symbol: "DOGE",
      decimals: 8,
    },
    slip44: 3,
    derivationPath: "m/44'/3'/0'/0/0",
    icon: "dogecoin.png",
    color: "#C2A633",
    enabled: true,
  },

  // ==========================================
  // SOLANA (PublicNode doesn't support Solana)
  // ==========================================
  SOLANA: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    type: CHAIN_TYPES.SOLANA,
    decimals: 9,
    // PublicNode doesn't support Solana - using public Solana RPCs
    rpcUrls: [
      "https://api.mainnet-beta.solana.com",
      "https://solana-api.projectserum.com",
      "https://rpc.ankr.com/solana",
    ],
    explorerUrl: "https://explorer.solana.com",
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
    slip44: 501,
    derivationPath: "m/44'/501'/0'/0'",
    supportsSPLTokens: true,
    icon: "solana.png",
    color: "#00D18C",
    enabled: true,
  },

  // ==========================================
  // XRP LEDGER
  // ==========================================
  RIPPLE: {
    id: "ripple",
    name: "XRP Ledger",
    symbol: "XRP",
    type: CHAIN_TYPES.RIPPLE,
    decimals: 6,
    rpcUrls: [
      "https://s1.ripple.com:51234",
      "https://xrplcluster.com",
      "wss://s1.ripple.com",
    ],
    explorerUrl: "https://livenet.xrpl.org",
    nativeCurrency: {
      name: "XRP",
      symbol: "XRP",
      decimals: 6,
    },
    slip44: 144,
    derivationPath: "m/44'/144'/0'/0/0",
    minAccountReserve: 10,
    icon: "ripple.png",
    color: "#23292F",
    enabled: true,
  },

  // ==========================================
  // COSMOS ECOSYSTEM
  // ==========================================
  COSMOS: {
    id: "cosmos",
    name: "Cosmos Hub",
    symbol: "ATOM",
    type: CHAIN_TYPES.COSMOS,
    decimals: 6,
    rpcUrls: [
      "https://cosmos-rpc.polkachu.com",
      "https://rpc-cosmoshub.blockapsis.com",
    ],
    explorerUrl: "https://www.mintscan.io/cosmos",
    nativeCurrency: {
      name: "Cosmos",
      symbol: "ATOM",
      decimals: 6,
    },
    slip44: 118,
    derivationPath: "m/44'/118'/0'/0/0",
    addressPrefix: "cosmos",
    icon: "cosmos.png",
    color: "#2E3148",
    enabled: true,
  },

  // ==========================================
  // TRON
  // ==========================================
  TRON: {
    id: "tron",
    name: "Tron",
    symbol: "TRX",
    type: CHAIN_TYPES.TRON,
    decimals: 6,
    rpcUrls: ["https://api.trongrid.io", "https://api.tronstack.io"],
    explorerUrl: "https://tronscan.org",
    nativeCurrency: {
      name: "Tronix",
      symbol: "TRX",
      decimals: 6,
    },
    slip44: 195,
    derivationPath: "m/44'/195'/0'/0/0",
    supportsTRC20: true,
    icon: "tron.png",
    color: "#EB0029",
    enabled: true,
  },
};

// Export chain configurations
module.exports = {
  CHAINS,
  CHAIN_TYPES,

  // Helper functions
  getChainById: (id) => {
    return Object.values(CHAINS).find((chain) => chain.id === id);
  },

  getChainBySymbol: (symbol) => {
    return Object.values(CHAINS).find(
      (chain) => chain.symbol.toUpperCase() === symbol.toUpperCase()
    );
  },

  getEVMChains: () => {
    return Object.values(CHAINS).filter(
      (chain) => chain.type === CHAIN_TYPES.EVM
    );
  },

  getUTXOChains: () => {
    return Object.values(CHAINS).filter(
      (chain) => chain.type === CHAIN_TYPES.UTXO
    );
  },

  getEnabledChains: () => {
    return Object.values(CHAINS).filter((chain) => chain.enabled);
  },

  getAllChains: () => {
    return Object.values(CHAINS);
  },
};
