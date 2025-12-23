const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { bech32 } = require('bech32');
const { Client: XrpClient, Wallet: XrpWallet } = require('xrpl');
const { CHAINS, CHAIN_TYPES } = require('../../config/chains.config');
const { getProviderWithFailover } = require('../../config/rpc-providers.config'); // ✅ NEW
const encryptionService = require('../../security/encryption.service');
const auditLogger = require('../../security/audit-logger.service');
const axios = require('axios');

// âœ… FIX: Correct imports for bip32, bs58, and tronweb
const BIP32Factory = require('bip32').default;
const ecc = require('tiny-secp256k1');
const bip32 = BIP32Factory(ecc);
const bs58 = require('bs58');

/**
 * Multi-Chain Wallet Service
 * ✅ OPTIMIZED: Parallel wallet generation + PublicNode RPC integration
 * ✅ MIGRATED: Now uses PublicNode for all EVM chains (free, no API keys)
 */
class MultiChainService {
  
  constructor() {
    this.providers = new Map();
    this.solanaConnections = new Map();
    this.xrpClients = new Map();
  }

  // ==========================================
  // WALLET GENERATION - OPTIMIZED
  // ==========================================

  /**
   * Generate wallet for all chains from a single mnemonic
   * âœ… OPTIMIZED: Processes chains in parallel instead of sequentially
   */
  async generateMultiChainWallet(mnemonic) {
    const startTime = Date.now();
    
    try {
      if (!ethers.utils.isValidMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      const enabledChains = Object.entries(CHAINS).filter(([_, config]) => config.enabled);
      
      //console.log(`ðŸš€ Generating wallets for ${enabledChains.length} chains in parallel...`);

      // âœ… PARALLEL PROCESSING - All chains generated at once
      const walletPromises = enabledChains.map(async ([chainKey, chainConfig]) => {
        const chainStart = Date.now();
        
        try {
          let walletData;

          switch (chainConfig.type) {
            case CHAIN_TYPES.EVM:
              walletData = await this.generateEVMWallet(mnemonic, chainConfig);
              break;

            case CHAIN_TYPES.UTXO:
              walletData = await this.generateUTXOWallet(mnemonic, chainConfig);
              break;

            case CHAIN_TYPES.SOLANA:
              walletData = await this.generateSolanaWallet(mnemonic, chainConfig);
              break;

            case CHAIN_TYPES.RIPPLE:
              walletData = await this.generateRippleWallet(mnemonic, chainConfig);
              break;

            case CHAIN_TYPES.COSMOS:
              walletData = await this.generateCosmosWallet(mnemonic, chainConfig);
              break;

            case 'TRON':
              walletData = await this.generateTronWallet(mnemonic, chainConfig);
              break;

            default:
              console.warn(`Unsupported chain type: ${chainConfig.type}`);
              return null;
          }

          const chainTime = Date.now() - chainStart;
          //console.log(`âœ… ${chainKey}: ${chainTime}ms`);

          return [chainKey, {
            ...walletData,
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            symbol: chainConfig.symbol,
            decimals: chainConfig.decimals,
            type: chainConfig.type
          }];

        } catch (error) {
          const chainTime = Date.now() - chainStart;
          console.error(`âŒ ${chainKey} failed after ${chainTime}ms:`, error.message);
          auditLogger.logError(error, { chain: chainKey, service: 'generateMultiChainWallet' });
          return null;
        }
      });

      // Wait for all chains to complete
      const results = await Promise.all(walletPromises);

      // Filter out failed chains and convert to object
      const wallets = Object.fromEntries(
        results.filter(result => result !== null)
      );

      const totalTime = Date.now() - startTime;
      //console.log(`âœ… Generated ${Object.keys(wallets).length} wallets in ${totalTime}ms (avg: ${Math.round(totalTime / enabledChains.length)}ms per chain)`);

      return wallets;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`âŒ Wallet generation failed after ${totalTime}ms:`, error.message);
      auditLogger.logError(error, { service: 'generateMultiChainWallet' });
      throw error;
    }
  }

  /**
   * Generate EVM wallet (Ethereum, BSC, Polygon, etc.)
   */
  async generateEVMWallet(mnemonic, chainConfig) {
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const wallet = hdNode.derivePath(chainConfig.derivationPath);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      derivationPath: chainConfig.derivationPath
    };
  }

  /**
   * Generate Bitcoin/UTXO wallet
   * âœ… FIXED: Now uses bip32 correctly
   */
  async generateUTXOWallet(mnemonic, chainConfig) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed); // âœ… Fixed import

    const addresses = {};

    if (chainConfig.derivationPaths) {
      for (const [format, path] of Object.entries(chainConfig.derivationPaths)) {
        const child = root.derivePath(path);
        let address;

        if (format === 'legacy') {
          const { address: addr } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.bitcoin
          });
          address = addr;
        } else if (format === 'segwit') {
          const { address: addr } = bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({
              pubkey: child.publicKey,
              network: bitcoin.networks.bitcoin
            }),
            network: bitcoin.networks.bitcoin
          });
          address = addr;
        } else if (format === 'nativeSegwit') {
          const { address: addr } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.bitcoin
          });
          address = addr;
        }

        addresses[format] = {
          address,
          privateKey: child.toWIF(),
          publicKey: child.publicKey.toString('hex'),
          derivationPath: path
        };
      }
    }

    return addresses.nativeSegwit || addresses.segwit || addresses.legacy || {};
  }

  /**
   * Generate Solana wallet
   */
  async generateSolanaWallet(mnemonic, chainConfig) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const derivedSeed = seed.slice(0, 32);

    const keypair = Keypair.fromSeed(derivedSeed);

    return {
      address: keypair.publicKey.toString(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      publicKey: keypair.publicKey.toString(),
      derivationPath: chainConfig.derivationPath || 'm/44\'/501\'/0\'/0\''
    };
  }

  /**
   * Generate XRP wallet
   * âœ… FIXED: bs58 import corrected
   */
  async generateRippleWallet(mnemonic, chainConfig) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const derivedSeed = seed.slice(0, 16);
    
    const crypto = require('crypto');
    
    const seedBytes = Buffer.concat([
      Buffer.from([0x21]),
      derivedSeed,
      Buffer.alloc(1)
    ]);
    
    const checksum = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(seedBytes.slice(0, -1)).digest())
      .digest()
      .slice(0, 4);
    
    seedBytes[seedBytes.length - 1] = checksum[0];
    const xrpSeed = bs58.encode(seedBytes); // âœ… Fixed import

    const wallet = XrpWallet.fromSeed(xrpSeed);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      derivationPath: chainConfig.derivationPath
    };
  }

  /**
   * Generate Cosmos wallet
   */
  async generateCosmosWallet(mnemonic, chainConfig) {
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const wallet = hdNode.derivePath(chainConfig.derivationPath);
    
    const crypto = require('crypto');
    
    const publicKeyHash = crypto.createHash('sha256')
      .update(Buffer.from(wallet.publicKey.slice(2), 'hex'))
      .digest();
    
    const ripemd160 = crypto.createHash('ripemd160')
      .update(publicKeyHash)
      .digest();
    
    const words = bech32.toWords(ripemd160);
    const address = bech32.encode(chainConfig.addressPrefix || 'cosmos', words);

    return {
      address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      derivationPath: chainConfig.derivationPath
    };
  }

  /**
   * Generate Tron wallet
   * âœ… FIXED: TronWeb import corrected
   */
  async generateTronWallet(mnemonic, chainConfig) {
    try {
      const TronWeb = require('tronweb');
      // Handle both default export and named export
      const TronWebClass = TronWeb.default || TronWeb;
      
      const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
      const wallet = hdNode.derivePath(chainConfig.derivationPath);
      
      const tronWeb = new TronWebClass({
        fullHost: chainConfig.rpcUrls[0] || 'https://api.trongrid.io'
      });

      const privateKeyHex = wallet.privateKey.slice(2);
      const address = tronWeb.address.fromPrivateKey(privateKeyHex);

      return {
        address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        derivationPath: chainConfig.derivationPath
      };
    } catch (error) {
      console.error('TronWeb error:', error.message);
      throw new Error(`TronWeb initialization failed: ${error.message}`);
    }
  }

  // ==========================================
  // BALANCE FETCHING
  // ==========================================

  async getBalance(chainId, address) {
    try {
      const chainConfig = CHAINS[chainId.toUpperCase()];
      if (!chainConfig) {
        throw new Error(`Chain ${chainId} not supported`);
      }

      let balance;

      switch (chainConfig.type) {
        case CHAIN_TYPES.EVM:
          balance = await this.getEVMBalance(chainConfig, address);
          break;

        case CHAIN_TYPES.UTXO:
          balance = await this.getUTXOBalance(chainConfig, address);
          break;

        case CHAIN_TYPES.SOLANA:
          balance = await this.getSolanaBalance(chainConfig, address);
          break;

        case CHAIN_TYPES.RIPPLE:
          balance = await this.getXRPBalance(chainConfig, address);
          break;

        case CHAIN_TYPES.COSMOS:
          balance = await this.getCosmosBalance(chainConfig, address);
          break;

        case 'TRON':
          balance = await this.getTronBalance(chainConfig, address);
          break;

        default:
          throw new Error(`Balance fetching not implemented for ${chainConfig.type}`);
      }

      return {
        chain: chainConfig.id,
        symbol: chainConfig.symbol,
        balance: balance.toString(),
        decimals: chainConfig.decimals,
        address
      };

    } catch (error) {
      auditLogger.logError(error, { service: 'getBalance', chainId, address });
      throw error;
    }
  }

  async getEVMBalance(chainConfig, address) {
    const provider = await this.getEVMProvider(chainConfig); // ✅ Now uses PublicNode
    const balance = await provider.getBalance(address);
    return ethers.utils.formatUnits(balance, chainConfig.decimals);
  }

  async getUTXOBalance(chainConfig, address) {
    try {
      // Check if it's Bitcoin (can be 'bitcoin', 'BTC', or 'BITCOIN')
      const isBitcoin = chainConfig.id === 'bitcoin' || 
                       chainConfig.id === 'BTC' || 
                       chainConfig.id === 'BITCOIN' ||
                       chainConfig.symbol === 'BTC';
      
      if (isBitcoin) {
        // Try Blockstream API first (primary)
        try {
          const response = await axios.get(
            `https://blockstream.info/api/address/${address}`,
            { timeout: 10000 }
          );
          
          if (response.data && response.data.chain_stats) {
            const satoshis = response.data.chain_stats.funded_txo_sum - 
                            response.data.chain_stats.spent_txo_sum;
            return (satoshis / 100000000).toFixed(8);
          }
        } catch (blockstreamError) {
          // Fallback to BlockCypher API
          try {
            const response = await axios.get(
              `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`,
              { timeout: 10000 }
            );
            
            if (response.data && response.data.balance !== undefined) {
              return (response.data.balance / 100000000).toFixed(8);
            }
          } catch (blockcypherError) {
            // Fallback to Blockchain.info API
            try {
              const response = await axios.get(
                `https://blockchain.info/q/addressbalance/${address}`,
                { timeout: 10000 }
              );
              
              if (response.data !== undefined && !isNaN(response.data)) {
                return (parseInt(response.data) / 100000000).toFixed(8);
              }
            } catch (blockchainError) {
              console.warn(`All Bitcoin balance APIs failed for address ${address}`);
            }
          }
        }
        
        // If all APIs fail, return 0 (address might be new/unused)
        return '0';
      }

      // For other UTXO chains (Litecoin, Dogecoin, etc.)
      try {
        const response = await axios.get(
          `https://api.blockcypher.com/v1/${chainConfig.id}/main/addrs/${address}/balance`,
          { timeout: 10000 }
        );
        
        if (response.data && response.data.balance !== undefined) {
          return (response.data.balance / 100000000).toFixed(8);
        }
      } catch (error) {
        console.warn(`Error fetching ${chainConfig.id} balance from BlockCypher:`, error.message);
      }
      
      // Return 0 if API fails (address might be new/unused)
      return '0';
    } catch (error) {
      console.error(`Error fetching UTXO balance for ${chainConfig.id}:`, error.message);
      // Return 0 instead of throwing error (address might be new/unused)
      return '0';
    }
  }

  async getSolanaBalance(chainConfig, address) {
    const connection = this.getSolanaConnection(chainConfig);
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return (balance / LAMPORTS_PER_SOL).toFixed(9);
  }

  async getXRPBalance(chainConfig, address) {
    try {
      const client = await this.getXRPClient(chainConfig);
      
      if (!client.isConnected()) {
        await client.connect();
      }

      const response = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      const drops = response.result.account_data.Balance;
      return (parseInt(drops) / 1000000).toFixed(6);
    } catch (error) {
      if (error.data?.error === 'actNotFound') {
        return '0';
      }
      throw error;
    }
  }

  async getCosmosBalance(chainConfig, address) {
    try {
      const response = await axios.get(
        `${chainConfig.rpcUrls[0]}/cosmos/bank/v1beta1/balances/${address}`
      );
      
      const balance = response.data.balances.find(
        b => b.denom === 'uatom'
      );
      
      return balance ? (parseInt(balance.amount) / 1000000).toFixed(6) : '0';
    } catch (error) {
      console.error('Error fetching Cosmos balance:', error.message);
      return '0';
    }
  }

  async getTronBalance(chainConfig, address) {
    try {
      const TronWeb = require('tronweb');
      // Handle both default export and named export
      const TronWebClass = TronWeb.default || TronWeb;
      
      const tronWeb = new TronWebClass({
        fullHost: chainConfig.rpcUrls[0] || 'https://api.trongrid.io'
      });

      const balance = await tronWeb.trx.getBalance(address);
      return (balance / 1000000).toFixed(6);
    } catch (error) {
      console.error('Error fetching Tron balance:', error.message);
      return '0';
    }
  }

  /**
   * Get ERC20/TRC20 token balance for EVM chains and Tron
   * @param {string} chainId - Chain identifier (ETHEREUM, BSC, TRON, etc.)
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - Token contract address
   * @returns {Promise<Object>} Token balance info
   */
  async getTokenBalance(chainId, address, tokenAddress) {
    try {
      const chainConfig = CHAINS[chainId.toUpperCase()];
      if (!chainConfig) {
        throw new Error(`Chain ${chainId} not supported`);
      }

      // Handle Tron TRC20 tokens
      if (chainConfig.type === 'TRON') {
        return await this.getTRC20TokenBalance(chainConfig, address, tokenAddress);
      }

      // Handle EVM ERC20 tokens
      if (chainConfig.type !== CHAIN_TYPES.EVM) {
        throw new Error(`Token balance only supported for EVM chains and Tron`);
      }

      const provider = await this.getEVMProvider(chainConfig);
      
      // ERC20 ABI for balanceOf and decimals
      const ERC20_ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      const [rawBalance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.decimals(),
        tokenContract.symbol().catch(() => 'UNKNOWN')
      ]);

      const balance = ethers.utils.formatUnits(rawBalance, decimals);

      return {
        chain: chainConfig.id,
        symbol: symbol,
        balance: balance.toString(),
        decimals: decimals,
        address,
        tokenAddress,
        isToken: true
      };
    } catch (error) {
      auditLogger.logError(error, { service: 'getTokenBalance', chainId, address, tokenAddress });
      throw error;
    }
  }

  /**
   * Get TRC20 token balance for Tron
   * @param {Object} chainConfig - Chain configuration
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - TRC20 token contract address
   * @returns {Promise<Object>} Token balance info
   */
  async getTRC20TokenBalance(chainConfig, address, tokenAddress) {
    try {
      const TronWeb = require('tronweb');
      // Handle both default export and named export
      const TronWebClass = TronWeb.default || TronWeb;
      
      const tronWeb = new TronWebClass({
        fullHost: chainConfig.rpcUrls[0] || 'https://api.trongrid.io'
      });

      // Get contract instance
      const contract = await tronWeb.contract().at(tokenAddress);
      
      // Get balance, decimals, and symbol
      const balance = await contract.balanceOf(address).call();
      const decimals = await contract.decimals().call().catch(() => 6); // Default to 6 for USDT
      const symbol = await contract.symbol().call().catch(() => 'UNKNOWN');

      // Convert balance from smallest unit to token units
      const balanceBN = TronWebClass.toBigNumber(balance);
      const decimalsBN = TronWebClass.toBigNumber(10).pow(decimals);
      const balanceFormatted = balanceBN.dividedBy(decimalsBN).toFixed(decimals);

      return {
        chain: chainConfig.id,
        symbol: symbol,
        balance: balanceFormatted,
        decimals: decimals,
        address,
        tokenAddress,
        isToken: true
      };
    } catch (error) {
      console.error('Error fetching TRC20 token balance:', error.message);
      throw new Error(`Failed to fetch TRC20 token balance: ${error.message}`);
    }
  }

  // ==========================================
  // PROVIDER MANAGEMENT - ✅ PUBLICNODE INTEGRATION
  // ==========================================

  /**
   * Get EVM provider with automatic failover
   * ✅ Now uses PublicNode as primary, Ankr as backup
   */
  async getEVMProvider(chainConfig) {
    const key = chainConfig.id;
    
    // Return cached provider if available
    if (this.providers.has(key)) {
      return this.providers.get(key);
    }

    try {
      // Use the new RPC provider config with automatic failover
      const provider = await getProviderWithFailover(chainConfig.id);
      this.providers.set(key, provider);
      return provider;
    } catch (error) {
      // Fallback to manual provider creation using rpcUrls from chainConfig
      console.warn(`Provider failover helper failed, trying manual creation...`);
      
      for (const rpcUrl of chainConfig.rpcUrls) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          await provider.getBlockNumber(); // Health check
          this.providers.set(key, provider);
          //console.log(`✅ Connected to ${chainConfig.name} via ${rpcUrl}`);
          return provider;
        } catch (err) {
          console.warn(`Failed to connect to ${rpcUrl}, trying next...`);
        }
      }
      
      throw new Error(`Failed to connect to any RPC for ${chainConfig.name}`);
    }
  }

  getSolanaConnection(chainConfig) {
    const key = chainConfig.id;
    
    if (!this.solanaConnections.has(key)) {
      const connection = new Connection(chainConfig.rpcUrls[0], 'confirmed');
      this.solanaConnections.set(key, connection);
    }

    return this.solanaConnections.get(key);
  }

  async getXRPClient(chainConfig) {
    const key = chainConfig.id;
    
    if (!this.xrpClients.has(key)) {
      const client = new XrpClient(chainConfig.rpcUrls[0]);
      this.xrpClients.set(key, client);
    }

    return this.xrpClients.get(key);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  validateAddress(chainId, address) {
    const chainConfig = CHAINS[chainId.toUpperCase()];
    if (!chainConfig) return false;

    try {
      switch (chainConfig.type) {
        case CHAIN_TYPES.EVM:
          return ethers.utils.isAddress(address);

        case CHAIN_TYPES.UTXO:
          return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
                 /^bc1[a-z0-9]{39,59}$/.test(address);

        case CHAIN_TYPES.SOLANA:
          try {
            new PublicKey(address);
            return true;
          } catch {
            return false;
          }

        case CHAIN_TYPES.RIPPLE:
          return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);

        case CHAIN_TYPES.COSMOS:
          return address.startsWith(chainConfig.addressPrefix);

        case 'TRON':
          return /^T[a-zA-Z0-9]{33}$/.test(address);

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  getSupportedChains() {
    return Object.entries(CHAINS)
      .filter(([_, config]) => config.enabled)
      .map(([key, config]) => ({
        id: config.id,
        name: config.name,
        symbol: config.symbol,
        type: config.type,
        decimals: config.decimals,
        icon: config.icon,
        color: config.color
      }));
  }
}

module.exports = new MultiChainService();



