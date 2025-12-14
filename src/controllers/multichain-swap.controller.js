const multichainSwapService = require('../services/multichain/multichain-swap.service');
const db = require('../db/index'); // ✅ Updated to centralized db
const encryptionService = require('../security/encryption.service');
const auditLogger = require('../security/audit-logger.service');
const { success, error } = require('../utils/response');
const { ethers } = require('ethers');

/**
 * Get swap quote for any chain
 */
exports.getSwapQuote = async (req, res) => {
  try {
    const { chainId, sellToken, buyToken, sellAmount, takerAddress } = req.body;

    if (!chainId || !sellToken || !buyToken || !sellAmount || !takerAddress) {
      return error(res, 'chainId, sellToken, buyToken, sellAmount, and takerAddress are required');
    }

    const quote = await multichainSwapService.getSwapQuote(
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      takerAddress
    );

    auditLogger.logSecurityEvent({
      type: 'SWAP_QUOTE_REQUESTED',
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      ip: req.ip
    });

    return success(res, quote);

  } catch (e) {
    auditLogger.logError(e, { controller: 'getSwapQuote' });
    return error(res, e.message);
  }
};

/**
 * Execute swap on any EVM chain
 */
exports.executeSwap = async (req, res) => {
  try {
    const { walletId, chainId, sellToken, buyToken, sellAmount } = req.body;

    if (!walletId || !chainId || !sellToken || !buyToken || !sellAmount) {
      return error(res, 'walletId, chainId, sellToken, buyToken, and sellAmount are required');
    }

    // Get wallet credentials
    const credentials = db
      .prepare('SELECT private_key, public_address FROM credentials WHERE wallet_id = ? LIMIT 1')
      .get(walletId);

    if (!credentials) {
      return error(res, 'Wallet credentials not found');
    }

    // Decrypt private key
    const privateKey = encryptionService.decrypt(credentials.private_key);
    const takerAddress = credentials.public_address;

    // Get swap quote
    const quote = await multichainSwapService.getSwapQuote(
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      takerAddress
    );

    // Execute the swap
    const { CHAINS } = require('../../config/chains.config');
    const chainConfig = CHAINS[chainId.toUpperCase()];

    if (!chainConfig) {
      return error(res, `Chain ${chainId} not supported`);
    }

    const result = await multichainSwapService.executeEVMSwap(chainConfig, privateKey, quote);

    auditLogger.logSecurityEvent({
      type: 'SWAP_EXECUTED',
      walletId,
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      txHash: result.txHash,
      ip: req.ip
    });

    return success(res, {
      message: 'Swap executed successfully',
      ...result,
      quote: {
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: quote.buyAmount,
        price: quote.price
      }
    });

  } catch (e) {
    auditLogger.logError(e, { controller: 'executeSwap' });
    return error(res, e.message);
  }
};

/**
 * Swap native token to stablecoin (e.g., BNB -> USDT, ETH -> USDC)
 */
exports.swapNativeToStablecoin = async (req, res) => {
  try {
    const { walletId, chainId, amount, stablecoin = 'USDT' } = req.body;

    if (!walletId || !chainId || !amount) {
      return error(res, 'walletId, chainId, and amount are required');
    }

    // Get common tokens for the chain
    const commonTokens = multichainSwapService.getCommonTokens(chainId);
    const stablecoinAddress = commonTokens[stablecoin];

    if (!stablecoinAddress) {
      return error(res, `${stablecoin} not available on ${chainId}`);
    }

    // Get wallet network address for this chain
    const network = db
      .prepare('SELECT address FROM wallet_networks WHERE wallet_id = ? AND network = ?')
      .get(walletId, chainId.toUpperCase());

    if (!network) {
      return error(res, `Chain ${chainId} not found in wallet`);
    }

    // Native token symbol depends on chain
    const nativeTokenSymbol = 'ETH'; // This will be used as sellToken

    // Convert amount to wei
    const { CHAINS } = require('../../config/chains.config');
    const chainConfig = CHAINS[chainId.toUpperCase()];
    const sellAmount = ethers.utils.parseUnits(amount.toString(), chainConfig.decimals).toString();

    // Get quote
    const quote = await multichainSwapService.getSwapQuote(
      chainId,
      nativeTokenSymbol,
      stablecoinAddress,
      sellAmount,
      network.address
    );

    return success(res, {
      message: 'Swap quote generated',
      quote,
      estimatedOutput: ethers.utils.formatUnits(quote.buyAmount, 18), // Most stablecoins use 18 decimals
      instructions: 'Use POST /multichain/swap/execute to complete the swap'
    });

  } catch (e) {
    auditLogger.logError(e, { controller: 'swapNativeToStablecoin' });
    return error(res, e.message);
  }
};

/**
 * Swap stablecoin to native token (e.g., USDT -> BNB, USDC -> ETH)
 */
exports.swapStablecoinToNative = async (req, res) => {
  try {
    const { walletId, chainId, amount, stablecoin = 'USDT' } = req.body;

    if (!walletId || !chainId || !amount) {
      return error(res, 'walletId, chainId, and amount are required');
    }

    // Get common tokens for the chain
    const commonTokens = multichainSwapService.getCommonTokens(chainId);
    const stablecoinAddress = commonTokens[stablecoin];

    if (!stablecoinAddress) {
      return error(res, `${stablecoin} not available on ${chainId}`);
    }

    // Get wallet network address for this chain
    const network = db
      .prepare('SELECT address FROM wallet_networks WHERE wallet_id = ? AND network = ?')
      .get(walletId, chainId.toUpperCase());

    if (!network) {
      return error(res, `Chain ${chainId} not found in wallet`);
    }

    // Convert amount to token units (most stablecoins use 18 decimals on BSC, 6 on Ethereum)
    const decimals = chainId.toUpperCase() === 'ETHEREUM' ? 6 : 18;
    const sellAmount = ethers.utils.parseUnits(amount.toString(), decimals).toString();

    // Native token symbol
    const nativeTokenSymbol = 'ETH';

    // Get quote
    const quote = await multichainSwapService.getSwapQuote(
      chainId,
      stablecoinAddress,
      nativeTokenSymbol,
      sellAmount,
      network.address
    );

    const { CHAINS } = require('../../config/chains.config');
    const chainConfig = CHAINS[chainId.toUpperCase()];
    const estimatedOutput = ethers.utils.formatUnits(quote.buyAmount, chainConfig.decimals);

    return success(res, {
      message: 'Swap quote generated',
      quote,
      estimatedOutput: `${estimatedOutput} ${chainConfig.symbol}`,
      instructions: 'Use POST /multichain/swap/execute to complete the swap'
    });

  } catch (e) {
    auditLogger.logError(e, { controller: 'swapStablecoinToNative' });
    return error(res, e.message);
  }
};

/**
 * Get supported DEXes/Aggregators for a chain
 */
exports.getSupportedDexes = async (req, res) => {
  try {
    const { chainId } = req.params;

    const dexes = multichainSwapService.getSupportedDexes(chainId);

    return success(res, {
      chainId: chainId.toUpperCase(),
      supportedDexes: dexes,
      count: dexes.length
    });

  } catch (e) {
    auditLogger.logError(e, { controller: 'getSupportedDexes' });
    return error(res, e.message);
  }
};

/**
 * Get common tokens for a chain
 */
exports.getCommonTokens = async (req, res) => {
  try {
    const { chainId } = req.params;

    const tokens = multichainSwapService.getCommonTokens(chainId);

    return success(res, {
      chainId: chainId.toUpperCase(),
      tokens,
      count: Object.keys(tokens).length
    });

  } catch (e) {
    auditLogger.logError(e, { controller: 'getCommonTokens' });
    return error(res, e.message);
  }
};



