/**
 * Complete Wallet Service Layer
 * Trust Wallet-level operations: Create, Import, Send, Receive, Swap, Buy, Sell
 * 
 * Location: src/services/wallet/wallet.service.js
 */

const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const bip32 = require('bip32');
const crypto = require('crypto');
const { getProviderWithFailover } = require('../../config/rpc-providers.config');
const { CHAINS } = require('../../config/chains.config');
// FIX: Import from the index file that exports both repositories
const { walletRepository } = require('../../repositories');

class WalletService {
  /**
   * Generate a new BIP39 mnemonic phrase
   * @param {number} strength - Entropy strength (128=12 words, 256=24 words)
   * @returns {Object} Mnemonic and metadata
   */
  async generateMnemonic(strength = 128) {
    try {
      const mnemonic = bip39.generateMnemonic(strength);
      const wordCount = mnemonic.split(' ').length;
      
      return {
        success: true,
        mnemonic,
        wordCount,
        strength,
        warning: 'Store this mnemonic securely. Never share it with anyone.'
      };
    } catch (error) {
      throw new Error(`Failed to generate mnemonic: ${error.message}`);
    }
  }

  /**
   * Validate a mnemonic phrase
   * @param {string} mnemonic - BIP39 mnemonic
   * @returns {Object} Validation result
   */
  validateMnemonic(mnemonic) {
    const isValid = bip39.validateMnemonic(mnemonic);
    const wordCount = mnemonic.trim().split(/\s+/).length;
    
    return {
      valid: isValid,
      wordCount,
      expectedWordCounts: [12, 15, 18, 21, 24],
      errors: !isValid ? ['Invalid mnemonic phrase'] : []
    };
  }

  /**
   * Create a new multi-chain wallet from mnemonic
   * @param {Object} params - Wallet creation parameters
   * @returns {Object} Created wallet with addresses for all chains
   */
  async createWallet(params) {
    const {
      mnemonic,
      name = 'My Wallet',
      chains = ['ethereum', 'bsc', 'polygon', 'bitcoin'],
      devicePasscodeId,
      isMain = false
    } = params;

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      console.log(mnemonic, "=========>");
      throw new Error('Invalid mnemonic phrase');
    }

    try {
      const walletId = crypto.randomBytes(16).toString('hex');
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const addresses = {};
      const privateKeys = {};

      // Generate addresses for each requested chain
      for (const chainId of chains) {
        const chain = CHAINS[chainId.toUpperCase()];
        if (!chain || !chain.enabled) continue;

        if (chain.type === 'EVM') {
          // EVM chains using ethers.js HDNode
          const hdNode = ethers.utils.HDNode.fromSeed(seed);
          const derivedNode = hdNode.derivePath(chain.derivationPath);
          const wallet = new ethers.Wallet(derivedNode.privateKey);
          
          addresses[chainId] = wallet.address;
          privateKeys[chainId] = derivedNode.privateKey;

        } else if (chain.type === 'UTXO') {
          // Bitcoin-like chains using bip32
          const network = chainId === 'bitcoin' 
            ? bitcoin.networks.bitcoin 
            : chainId === 'litecoin'
            ? bitcoin.networks.litecoin
            : bitcoin.networks.testnet;

          const root = bip32.fromSeed(seed, network);
          const child = root.derivePath(chain.derivationPath);
          const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network 
          });

          addresses[chainId] = address;
          privateKeys[chainId] = child.privateKey.toString('hex');
        }
      }

      // Store wallet in database
      const walletData = {
        id: walletId,
        name,
        devicePasscodeId,
        isMain,
        addresses,
        createdAt: new Date().toISOString()
      };

      await walletRepository.createWallet(walletData, mnemonic, privateKeys);

      return {
        success: true,
        walletId,
        name,
        addresses,
        chains: Object.keys(addresses),
        message: 'Wallet created successfully'
      };

    } catch (error) {
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  /**
   * Import existing wallet from mnemonic
   * @param {Object} params - Import parameters
   * @returns {Object} Imported wallet
   */
  async importWallet(params) {
    const {
      mnemonic,
      name = 'Imported Wallet',
      chains = ['ethereum', 'bsc', 'polygon'],
      devicePasscodeId
    } = params;

    // Validate mnemonic
    const validation = this.validateMnemonic(mnemonic);
    if (!validation.valid) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Check if wallet already exists
    const existingWallet = await walletRepository.findByMnemonic(mnemonic);
    if (existingWallet) {
      throw new Error('Wallet already imported');
    }

    // Create wallet using the same process
    return this.createWallet({
      mnemonic,
      name,
      chains,
      devicePasscodeId,
      isMain: false
    });
  }

  /**
   * Import wallet from private key (single chain)
   * @param {Object} params - Private key import params
   * @returns {Object} Imported wallet
   */
  async importFromPrivateKey(params) {
    const {
      privateKey,
      chainId = 'ethereum',
      name = 'Imported Account',
      devicePasscodeId
    } = params;

    try {
      const chain = CHAINS[chainId.toUpperCase()];
      if (!chain || chain.type !== 'EVM') {
        throw new Error('Only EVM chains supported for private key import');
      }

      // Validate and create wallet from private key
      const wallet = new ethers.Wallet(privateKey);
      const address = wallet.address;
      const walletId = crypto.randomBytes(16).toString('hex');

      // Store wallet
      const walletData = {
        id: walletId,
        name,
        devicePasscodeId,
        isSingleCoin: true,
        addresses: { [chainId]: address },
        createdAt: new Date().toISOString()
      };

      await walletRepository.createSingleChainWallet(walletData, privateKey, chainId);

      return {
        success: true,
        walletId,
        name,
        address,
        chainId,
        message: 'Account imported successfully'
      };

    } catch (error) {
      throw new Error(`Failed to import from private key: ${error.message}`);
    }
  }

  /**
   * Get wallet by ID - NEW METHOD for transaction controller
   * @param {string} walletId - Wallet ID
   * @returns {Object} Wallet data
   */
  async getWalletById(walletId) {
    return walletRepository.findById(walletId);
  }

  /**
   * Get address for specific chain - NEW METHOD for transaction controller
   * @param {string} walletId - Wallet ID
   * @param {string} chainId - Chain identifier
   * @returns {string} Address for the chain
   */
  async getAddressForChain(walletId, chainId) {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet || !wallet.networks) return null;

    const network = wallet.networks.find(n => 
      n.network.toUpperCase() === chainId.toUpperCase()
    );

    return network ? network.address : null;
  }

  /**
   * Get wallet details including all addresses and balances
   * @param {string} walletId - Wallet ID
   * @param {boolean} includeBalances - Fetch current balances
   * @returns {Object} Complete wallet details
   */
  async getWalletDetails(walletId, includeBalances = true) {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const details = {
      id: wallet.id,
      name: wallet.name,
      isMain: wallet.isMain,
      isSingleCoin: wallet.isSingleCoin,
      backupStatus: wallet.backupStatus,
      createdAt: wallet.createdAt,
      networks: wallet.networks || []
    };

    if (includeBalances) {
      details.balances = await this.fetchAllBalances(walletId);
      details.totalValueUSD = await this.calculateTotalValue(details.balances);
    }

    return details;
  }

  /**
   * Fetch balances for all networks in a wallet
   * @param {string} walletId - Wallet ID
   * @returns {Object} Balances by network
   */
  async fetchAllBalances(walletId) {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet || !wallet.networks) {
      return {};
    }

    const balances = {};
    const balancePromises = wallet.networks.map(async (network) => {
      try {
        const chain = CHAINS[network.network.toUpperCase()];
        if (!chain) return null;

        if (chain.type === 'EVM') {
          const provider = await getProviderWithFailover(chain.id);
          const balance = await provider.getBalance(network.address);
          const formatted = parseFloat(ethers.utils.formatEther(balance));

          balances[network.network] = {
            address: network.address,
            balance: formatted,
            symbol: chain.symbol,
            decimals: chain.decimals,
            network: network.network
          };
        }
      } catch (error) {
        console.error(`Failed to fetch balance for ${network.network}:`, error.message);
        balances[network.network] = {
          address: network.address,
          balance: 0,
          error: error.message
        };
      }
    });

    await Promise.all(balancePromises);
    return balances;
  }

  /**
   * Calculate total wallet value in USD
   * @param {Object} balances - Balances object
   * @returns {number} Total value in USD
   */
  async calculateTotalValue(balances) {
    // This would integrate with price feeds in production
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Derive additional addresses for HD wallets
   * @param {string} walletId - Wallet ID
   * @param {string} chainId - Chain identifier
   * @param {number} index - Address index
   * @returns {Object} New address
   */
  async deriveAddress(walletId, chainId, index = 0) {
    const credentials = await walletRepository.getCredentials(walletId);
    if (!credentials || !credentials.mnemonic) {
      throw new Error('Cannot derive address: wallet has no mnemonic');
    }

    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain) {
      throw new Error('Invalid chain');
    }

    const seed = await bip39.mnemonicToSeed(credentials.mnemonic);
    const derivationPath = chain.derivationPath.replace('/0/0', `/${index}/0`);

    if (chain.type === 'EVM') {
      const hdNode = ethers.utils.HDNode.fromSeed(seed);
      const derivedNode = hdNode.derivePath(derivationPath);
      const wallet = new ethers.Wallet(derivedNode.privateKey);

      return {
        address: wallet.address,
        derivationPath,
        index,
        chainId
      };
    }

    throw new Error('Derivation not supported for this chain type');
  }

  /**
   * Export wallet (get mnemonic/private key)
   * @param {string} walletId - Wallet ID
   * @param {string} devicePasscodeId - Device passcode for verification
   * @returns {Object} Export data
   */
  async exportWallet(walletId, devicePasscodeId) {
    const credentials = await walletRepository.verifyAndGetCredentials(
      walletId,
      devicePasscodeId
    );

    if (!credentials) {
      throw new Error('Invalid credentials or unauthorized access');
    }

    return {
      walletId,
      mnemonic: credentials.mnemonic || null,
      privateKeys: credentials.privateKeys || {},
      warning: 'Never share these credentials with anyone'
    };
  }

  /**
   * Delete wallet permanently
   * @param {string} walletId - Wallet ID
   * @param {string} devicePasscodeId - Device passcode for verification
   * @returns {Object} Deletion result
   */
  async deleteWallet(walletId, devicePasscodeId) {
    const wallet = await walletRepository.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Verify device passcode
    if (wallet.devicePasscodeId !== devicePasscodeId) {
      throw new Error('Unauthorized: Invalid device passcode');
    }

    // Delete all related data
    await walletRepository.deleteWallet(walletId);

    return {
      success: true,
      message: 'Wallet deleted permanently',
      walletId
    };
  }

  /**
   * List all wallets for a device
   * @param {string} devicePasscodeId - Device passcode ID
   * @returns {Array} List of wallets
   */
  async listWallets(devicePasscodeId) {
    const wallets = await walletRepository.findByDevice(devicePasscodeId);
    
    return wallets.map(wallet => ({
      id: wallet.id,
      name: wallet.name,
      isMain: wallet.isMain,
      isSingleCoin: wallet.isSingleCoin,
      backupStatus: wallet.backupStatus,
      networksCount: wallet.networks ? wallet.networks.length : 0,
      createdAt: wallet.createdAt
    }));
  }

  /**
   * Set wallet name
   * @param {string} walletId - Wallet ID
   * @param {string} name - New name
   * @returns {Object} Update result
   */
  async setWalletName(walletId, name) {
    await walletRepository.updateWallet(walletId, { name });
    return {
      success: true,
      walletId,
      name,
      message: 'Wallet name updated'
    };
  }

  /**
   * Mark wallet as main wallet
   * @param {string} walletId - Wallet ID
   * @param {string} devicePasscodeId - Device passcode ID
   * @returns {Object} Update result
   */
  async setMainWallet(walletId, devicePasscodeId) {
    // Unset current main wallet
    await walletRepository.unsetMainWallet(devicePasscodeId);
    
    // Set new main wallet
    await walletRepository.updateWallet(walletId, { isMain: true });

    return {
      success: true,
      walletId,
      message: 'Main wallet updated'
    };
  }
}

module.exports = new WalletService();

