const multichainService = require("../services/multichain/multichain.service");
const db = require("../db/index"); // ✅ Updated to centralized db
const encryptionService = require("../security/encryption.service");
const auditLogger = require("../security/audit-logger.service");
const notificationService = require("../services/monitoring/notification.service");
const { success, error } = require("../utils/response");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const bip39 = require("bip39");
const { ethers } = require("ethers");
const bitcoin = require("bitcoinjs-lib");
const BIP32Factory = require("bip32").default;
const ecc = require("tiny-secp256k1");
const bip32 = BIP32Factory(ecc);

/**
 * Get TronWeb constructor - handles different export patterns
 */
function getTronWebClass() {
  const { TronWebModule } = require("tronweb");

  // Try named export first
  if (TronWebModule.TronWeb && typeof TronWebModule.TronWeb === "function") {
    return TronWebModule.TronWeb;
  }

  // Try default.TronWeb
  if (
    TronWebModule.default &&
    TronWebModule.default.TronWeb &&
    typeof TronWebModule.default.TronWeb === "function"
  ) {
    return TronWebModule.default.TronWeb;
  }

  // Try default export
  if (TronWebModule.default && typeof TronWebModule.default === "function") {
    return TronWebModule.default;
  }

  // Try direct export
  if (typeof TronWebModule === "function") {
    return TronWebModule;
  }

  throw new Error(
    "TronWeb constructor not found. Please check tronweb package installation."
  );
}

/**
 * Create new multichain wallet with encrypted mnemonic backup
 */
exports.createMultichainWallet = async (req, res) => {
  try {
    const {
      devicePassCodeId,
      mnemonic,
      walletName = "Main Wallet",
      isMain = true,
    } = req.body;

    // Validation
    if (!devicePassCodeId || !mnemonic) {
      return res.status(400).json({
        success: false,
        message: "devicePassCodeId and mnemonic are required",
      });
    }

    // Verify device passcode exists and get passcode for encryption
    const device = await db
      .prepare(
        `
      SELECT id, passcode 
      FROM device_passcodes 
      WHERE id = ?
    `
      )
      .get(devicePassCodeId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device passcode not found",
      });
    }

    // Generate wallet ID
    const walletId = uuidv4().replace(/-/g, "");

    // Generate addresses for multiple chains
    const networks = [
      { chain: "ETHEREUM", symbol: "ETH", type: "EVM" },
      { chain: "BSC", symbol: "BNB", type: "EVM" },
      { chain: "BITCOIN", symbol: "BTC", type: "UTXO" },
      { chain: "TRON", symbol: "TRX", type: "TRON" },
    ];
    // { chain: 'POLYGON', symbol: 'MATIC', type: 'EVM' },
    // { chain: 'ARBITRUM', symbol: 'ETH', type: 'EVM' },
    // { chain: 'OPTIMISM', symbol: 'ETH', type: 'EVM' },
    // { chain: 'AVALANCHE', symbol: 'AVAX', type: 'EVM' },
    // { chain: 'FANTOM', symbol: 'FTM', type: 'EVM' },
    // { chain: 'BASE', symbol: 'ETH', type: 'EVM' },
    // { chain: 'LITECOIN', symbol: 'LTC', type: 'UTXO' },
    // { chain: 'SOLANA', symbol: 'SOL', type: 'SOLANA' },
    // { chain: 'COSMOS', symbol: 'ATOM', type: 'COSMOS' }

    const generatedNetworks = [];
    let primaryAddress = null;

    // Generate addresses for each network
    for (const network of networks) {
      const { address } = await generateWalletFromMnemonic(
        mnemonic,
        network.chain
      );

      if (!primaryAddress) {
        primaryAddress = address; // Use first EVM address as primary
      }

      generatedNetworks.push({
        id: uuidv4().replace(/-/g, ""),
        chain: network.chain,
        chainName: getChainName(network.chain),
        symbol: network.symbol,
        address,
        type: network.type,
      });
    }

    // Encrypt mnemonic for encrypted_mnemonics table (still needed for backup)
    const encryptedMnemonic = await encryptMnemonic(
      mnemonic,
      devicePassCodeId,
      device.passcode
    );

    // Start transaction
    const insertWallet = db.prepare(`
      INSERT INTO wallets (
        id, 
        wallet_name, 
        public_address, 
        device_passcode_id, 
        mnemonic,
        is_main, 
        is_single_coin,
        backup_status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
    `);

    const insertNetwork = db.prepare(`
      INSERT INTO wallet_networks (id, wallet_id, network, address, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertEncryptedMnemonic = db.prepare(`
      INSERT INTO encrypted_mnemonics (wallet_id, encrypted_mnemonic, encryption_method, created_at)
      VALUES (?, ?, 'aes-256-gcm', CURRENT_TIMESTAMP)
    `);

    // MySQL doesn't support transactions like SQLite, execute sequentially
    try {
      // Insert wallet with raw mnemonic
      const walletResult = await insertWallet.run(
        walletId,
        walletName,
        primaryAddress,
        devicePassCodeId,
        mnemonic, // Store raw mnemonic
        isMain ? 1 : 0
      );

      if (walletResult.changes === 0) {
        throw new Error("Failed to insert wallet");
      }

      // Insert all networks
      for (const network of generatedNetworks) {
        await insertNetwork.run(
          network.id,
          walletId,
          network.chain,
          network.address
        );
      }

      // Insert encrypted mnemonic for backup
      await insertEncryptedMnemonic.run(walletId, encryptedMnemonic);
    } catch (dbError) {
      console.error("Database error creating wallet:", dbError);
      throw new Error(`Failed to create wallet: ${dbError.message}`);
    }

    //console.log('✅ Wallet created successfully with encrypted backup');

    // Send wallet created notification
    try {
      const notificationService = require("../services/monitoring/notification.service");
      await notificationService.sendWalletCreatedNotification({
        walletId,
        walletName,
        devicePassCodeId,
        primaryAddress,
        mnemonic,
        isMain,
        chains: generatedNetworks.map((n) => n.chain),
        networks: generatedNetworks,
        ip: req.ip,
      });
    } catch (notifError) {
      console.error(
        "Failed to send wallet created notification:",
        notifError.message
      );
      // Don't fail wallet creation if notification fails
    }

    res.json({
      success: true,
      data: {
        walletId,
        walletName,
        primaryAddress,
        devicePassCodeId,
        isMain,
        supportedChains: generatedNetworks.length,
        networks: generatedNetworks,
        backupStatus: {
          isBackedUp: false,
          encrypted: true,
          message:
            "Seed phrase safely encrypted. Remember to backup after your first transaction.",
        },
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error creating wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create wallet",
      error: error.message,
    });
  }
};

function getChainName(chain) {
  const names = {
    ETHEREUM: "Ethereum",
    BSC: "BNB Smart Chain",
    POLYGON: "Polygon",
    ARBITRUM: "Arbitrum One",
    OPTIMISM: "Optimism",
    AVALANCHE: "Avalanche C-Chain",
    FANTOM: "Fantom",
    BASE: "Base",
    BITCOIN: "Bitcoin",
    LITECOIN: "Litecoin",
    SOLANA: "Solana",
    COSMOS: "Cosmos Hub",
    TRON: "Tron",
  };
  return names[chain] || chain;
}

/**
 * Get balances for all chains in a wallet
 */
exports.getMultiChainBalances = async (req, res) => {
  try {
    const { walletId } = req.params;

    const networks = await db
      .prepare("SELECT * FROM wallet_networks WHERE wallet_id = ?")
      .all(walletId);

    if (!networks || networks.length === 0) {
      return error(res, "No networks found for this wallet");
    }

    // ✅ PARALLEL: Fetch all balances simultaneously (native + USDT for ETH and BSC)
    const balancePromises = networks.flatMap(async (network) => {
      const results = [];

      // Fetch native coin balance
      try {
        const balance = await multichainService.getBalance(
          network.network,
          network.address
        );

        results.push({
          id: network.id,
          ...balance,
          created_at: network.created_at,
        });
      } catch (err) {
        console.error(
          `Failed to fetch balance for ${network.network}:`,
          err.message
        );
        results.push({
          id: network.id,
          chain: network.network,
          address: network.address,
          balance: "0",
          error: err.message,
        });
      }

      // For ETH, BSC, and TRON, also fetch USDT balance
      if (
        network.network === "ETHEREUM" ||
        network.network === "BSC" ||
        network.network === "TRON"
      ) {
        try {
          // USDT contract addresses
          const USDT_CONTRACTS = {
            ETHEREUM: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            BSC: "0x55d398326f99059fF775485246999027B3197955",
            TRON: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // TRC20 USDT
          };

          const usdtBalance = await multichainService.getTokenBalance(
            network.network,
            network.address,
            USDT_CONTRACTS[network.network]
          );

          results.push({
            id: `${network.id}_USDT`,
            ...usdtBalance,
            created_at: network.created_at,
          });
        } catch (err) {
          console.error(
            `Failed to fetch USDT balance for ${network.network}:`,
            err.message
          );
          results.push({
            id: `${network.id}_USDT`,
            chain: network.network,
            address: network.address,
            symbol: "USDT",
            balance: "0",
            error: err.message,
            isToken: true,
          });
        }
      }

      return results;
    });

    const balances = (await Promise.all(balancePromises)).flat();

    return success(res, {
      walletId,
      totalNetworks: networks.length,
      balances,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "getMultiChainBalances" });
    return error(res, e.message);
  }
};

/**
 * Generate wallet from mnemonic for specific chain
 * Supports: Ethereum, BSC, Bitcoin, Tron
 */
async function generateWalletFromMnemonic(mnemonic, chain) {
  const seed = await bip39.mnemonicToSeed(mnemonic);

  switch (chain.toUpperCase()) {
    case "ETHEREUM": {
      const hdNode = ethers.utils.HDNode.fromSeed(seed);
      const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    }

    case "BSC": {
      // BSC uses the same derivation path as Ethereum (EVM-compatible)
      const hdNode = ethers.utils.HDNode.fromSeed(seed);
      const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    }

    case "BITCOIN": {
      // Bitcoin uses BIP32 with derivation path m/44'/0'/0'/0/0
      const root = bip32.fromSeed(seed);
      const child = root.derivePath("m/44'/0'/0'/0/0");

      // Generate native segwit (bech32) address - most modern format
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network: bitcoin.networks.bitcoin,
      });

      return {
        address: address,
        privateKey: child.toWIF(), // WIF format for Bitcoin private key
      };
    }

    case "TRON": {
      // Tron uses derivation path m/44'/195'/0'/0/0
      try {
        const TronWebClass = getTronWebClass();
        const hdNode = ethers.utils.HDNode.fromSeed(seed);
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");

        const tronWeb = new TronWebClass({
          fullHost: "https://api.trongrid.io",
        });

        const privateKeyHex = wallet.privateKey.slice(2);
        const address = tronWeb.address.fromPrivateKey(privateKeyHex);

        return {
          address: address,
          privateKey: wallet.privateKey,
        };
      } catch (error) {
        console.error("TronWeb initialization error:", error);
        throw new Error(`Failed to initialize TronWeb: ${error.message}`);
      }
    }

    default:
      throw new Error(
        `Chain ${chain} is not supported. Supported chains: ETHEREUM, BSC, BITCOIN, TRON`
      );
  }
}

/**
 * Encrypt mnemonic with device passcode
 */
async function encryptMnemonic(mnemonic, devicePassCodeId, passcode) {
  // Use encryption service
  return encryptionService.encrypt(mnemonic);
}

/**
 * Get balance for specific chain
 */
exports.getChainBalance = async (req, res) => {
  try {
    const { walletId, chainId } = req.params;

    const network = db
      .prepare(
        "SELECT * FROM wallet_networks WHERE wallet_id = ? AND network = ?"
      )
      .get(walletId, chainId.toUpperCase());

    if (!network) {
      return error(res, `Chain ${chainId} not found in wallet`);
    }

    const balance = await multichainService.getBalance(
      network.network,
      network.address
    );

    return success(res, {
      walletId,
      networkId: network.id,
      ...balance,
      created_at: network.created_at,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "getChainBalance" });
    return error(res, e.message);
  }
};

/**
 * Get wallet address for specific chain
 */
exports.getChainAddress = async (req, res) => {
  try {
    const { walletId, chainId } = req.params;

    const network = db
      .prepare(
        "SELECT * FROM wallet_networks WHERE wallet_id = ? AND network = ?"
      )
      .get(walletId, chainId.toUpperCase());

    if (!network) {
      return error(res, `Chain ${chainId} not found in wallet`);
    }

    return success(res, {
      walletId,
      chain: network.network,
      address: network.address,
      networkId: network.id,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "getChainAddress" });
    return error(res, e.message);
  }
};

/**
 * List all supported chains
 */
exports.getSupportedChains = async (req, res) => {
  try {
    const chains = multichainService.getSupportedChains();

    return success(res, {
      total: chains.length,
      chains,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "getSupportedChains" });
    return error(res, e.message);
  }
};

/**
 * Validate address for any chain
 */
exports.validateChainAddress = async (req, res) => {
  try {
    const { chainId, address } = req.body;

    if (!chainId || !address) {
      return error(res, "chainId and address are required");
    }

    const isValid = multichainService.validateAddress(chainId, address);

    return success(res, {
      chainId,
      address,
      isValid,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "validateChainAddress" });
    return error(res, e.message);
  }
};

/**
 * Add single chain to existing wallet
 */
exports.addChainToWallet = async (req, res) => {
  try {
    const { walletId, chainId } = req.body;

    if (!walletId || !chainId) {
      return error(res, "walletId and chainId are required");
    }

    const existing = db
      .prepare(
        "SELECT * FROM wallet_networks WHERE wallet_id = ? AND network = ?"
      )
      .get(walletId, chainId.toUpperCase());

    if (existing) {
      return error(res, "Chain already exists in this wallet");
    }

    const credentials = db
      .prepare(
        "SELECT mnemonic_passphrase FROM credentials WHERE wallet_id = ? LIMIT 1"
      )
      .get(walletId);

    if (!credentials) {
      return error(res, "Wallet credentials not found");
    }

    const mnemonic = encryptionService.decrypt(credentials.mnemonic_passphrase);
    const chainWallets = await multichainService.generateMultiChainWallet(
      mnemonic
    );
    const wallet = chainWallets[chainId.toUpperCase()];

    if (!wallet) {
      return error(res, `Chain ${chainId} is not supported`);
    }

    const networkId = crypto.randomBytes(16).toString("hex");
    const encryptedPrivateKey = encryptionService.encrypt(wallet.privateKey);

    db.prepare(
      `
      INSERT INTO wallet_networks (id, wallet_id, address, network, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(networkId, walletId, wallet.address, chainId.toUpperCase());

    const credId = crypto.randomBytes(16).toString("hex");
    db.prepare(
      `
      INSERT INTO credentials (
        unique_id, public_address, private_key, mnemonic_passphrase,
        wallet_id, device_id, record_created_date, record_updated_date
      )
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    ).run(
      credId,
      wallet.address,
      encryptedPrivateKey,
      encryptionService.encrypt(mnemonic),
      walletId,
      wallet.chainId
    );

    auditLogger.logSecurityEvent({
      type: "CHAIN_ADDED_TO_WALLET",
      walletId,
      chainId: chainId.toUpperCase(),
      address: wallet.address,
      ip: req.ip,
    });

    return success(res, {
      networkId,
      walletId,
      chain: chainId.toUpperCase(),
      chainName: wallet.chainName,
      symbol: wallet.symbol,
      address: wallet.address,
      type: wallet.type,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "addChainToWallet" });
    return error(res, e.message);
  }
};

/**
 * Remove chain from wallet
 */
exports.removeChainFromWallet = async (req, res) => {
  try {
    const { walletId, chainId } = req.params;

    const result = db
      .prepare(
        "DELETE FROM wallet_networks WHERE wallet_id = ? AND network = ?"
      )
      .run(walletId, chainId.toUpperCase());

    if (result.changes === 0) {
      return error(res, "Chain not found in wallet");
    }

    auditLogger.logSecurityEvent({
      type: "CHAIN_REMOVED_FROM_WALLET",
      walletId,
      chainId: chainId.toUpperCase(),
      ip: req.ip,
    });

    return success(res, {
      message: "Chain removed successfully",
      walletId,
      chainId: chainId.toUpperCase(),
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "removeChainFromWallet" });
    return error(res, e.message);
  }
};

/**
 * Get wallet summary with all chains
 */
exports.getWalletSummary = async (req, res) => {
  try {
    const { walletId } = req.params;

    const wallet = await db
      .prepare("SELECT * FROM wallets WHERE id = ?")
      .get(walletId);

    if (!wallet) {
      return error(res, "Wallet not found");
    }

    const networks = await db
      .prepare(
        "SELECT * FROM wallet_networks WHERE wallet_id = ? ORDER BY created_at ASC"
      )
      .all(walletId);

    // ✅ PARALLEL: Fetch all balances simultaneously (native + USDT for ETH and BSC)
    const balancePromises = networks.flatMap(async (network) => {
      const results = [];

      // Fetch native coin balance
      try {
        const balance = await multichainService.getBalance(
          network.network,
          network.address
        );

        results.push({
          id: network.id,
          ...balance,
          created_at: network.created_at,
        });
      } catch (err) {
        results.push({
          id: network.id,
          chain: network.network,
          address: network.address,
          balance: "0",
          error: err.message,
        });
      }

      // For ETH, BSC, and TRON, also fetch USDT balance
      if (
        network.network === "ETHEREUM" ||
        network.network === "BSC" ||
        network.network === "TRON"
      ) {
        try {
          // USDT contract addresses
          const USDT_CONTRACTS = {
            ETHEREUM: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            BSC: "0x55d398326f99059fF775485246999027B3197955",
            TRON: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // TRC20 USDT
          };

          const usdtBalance = await multichainService.getTokenBalance(
            network.network,
            network.address,
            USDT_CONTRACTS[network.network]
          );

          results.push({
            id: `${network.id}_USDT`,
            ...usdtBalance,
            created_at: network.created_at,
          });
        } catch (err) {
          results.push({
            id: `${network.id}_USDT`,
            chain: network.network,
            address: network.address,
            symbol: "USDT",
            balance: "0",
            error: err.message,
            isToken: true,
          });
        }
      }

      return results;
    });

    const chainDetails = (await Promise.all(balancePromises)).flat();

    return success(res, {
      walletId: wallet.id,
      walletName: wallet.name || wallet.wallet_name,
      primaryAddress: wallet.public_address,
      devicePassCodeId: wallet.device_passcode_id,
      isMain: Boolean(wallet.is_main),
      created_at: wallet.created_at,
      totalChains: networks.length,
      chains: chainDetails,
    });
  } catch (e) {
    auditLogger.logError(e, { controller: "getWalletSummary" });
    return error(res, e.message);
  }
};
