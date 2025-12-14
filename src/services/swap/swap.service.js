/**
 * Complete Swap Service
 * Integrates with DEX aggregators (0x, 1inch, Uniswap, PancakeSwap)
 * 
 * Location: src/services/swap/swap.service.js
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { getProviderWithFailover } = require('../../config/rpc-providers.config');
const { CHAINS } = require('../../config/chains.config');
const walletRepository = require('../../repositories/wallet.repository');
const transactionRepository = require('../../repositories/transaction.repository');
const crypto = require('crypto');

class SwapService {
  constructor() {
    // DEX Router addresses by chain
    this.dexRouters = {
      ethereum: {
        uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        zeroX: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF'
      },
      bsc: {
        pancakeswapV2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        pancakeswapV3: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
        zeroX: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF'
      },
      polygon: {
        quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        zeroX: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF'
      },
      arbitrum: {
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
      },
      optimism: {
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
      },
      avalanche: {
        traderjoe: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
        pangolin: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106'
      },
      base: {
        uniswapV3: '0x2626664c2603336E57B271c5C0b26F421741e481'
      }
    };

    // 0x API endpoints
    this.zeroXAPIs = {
      ethereum: 'https://api.0x.org',
      bsc: 'https://bsc.api.0x.org',
      polygon: 'https://polygon.api.0x.org',
      arbitrum: 'https://arbitrum.api.0x.org',
      optimism: 'https://optimism.api.0x.org',
      avalanche: 'https://avalanche.api.0x.org',
      base: 'https://base.api.0x.org'
    };
  }

  /**
   * Get swap quote from multiple DEX aggregators
   * @param {Object} params - Quote parameters
   * @returns {Object} Best quote with routing
   */
  async getSwapQuote(params) {
    const {
      chainId,
      sellToken,
      buyToken,
      sellAmount,
      slippagePercentage = 0.5,
      takerAddress
    } = params;

    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain || chain.type !== 'EVM') {
      throw new Error('Swaps only supported on EVM chains');
    }

    try {
      // Try multiple aggregators in parallel
      const quotePromises = [
        this.get0xQuote(chainId, {
          sellToken,
          buyToken,
          sellAmount,
          slippagePercentage,
          takerAddress
        }).catch(err => ({ error: err.message, source: '0x' })),
        
        this.get1inchQuote(chainId, {
          sellToken,
          buyToken,
          sellAmount,
          slippagePercentage,
          takerAddress
        }).catch(err => ({ error: err.message, source: '1inch' })),
        
        this.getUniswapQuote(chainId, {
          sellToken,
          buyToken,
          sellAmount,
          slippagePercentage
        }).catch(err => ({ error: err.message, source: 'uniswap' }))
      ];

      const quotes = await Promise.all(quotePromises);
      
      // Filter successful quotes
      const validQuotes = quotes.filter(q => !q.error);
      
      if (validQuotes.length === 0) {
        throw new Error('No valid quotes available');
      }

      // Find best quote (highest buyAmount)
      const bestQuote = validQuotes.reduce((best, current) => {
        const currentAmount = parseFloat(current.buyAmount);
        const bestAmount = parseFloat(best.buyAmount);
        return currentAmount > bestAmount ? current : best;
      });

      return {
        success: true,
        quote: bestQuote,
        alternativeQuotes: validQuotes.filter(q => q !== bestQuote),
        chainId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to get swap quote: ${error.message}`);
    }
  }

  /**
   * Get quote from 0x Protocol
   */
  async get0xQuote(chainId, params) {
    const apiUrl = this.zeroXAPIs[chainId];
    if (!apiUrl) {
      throw new Error('0x not supported on this chain');
    }

    const { sellToken, buyToken, sellAmount, slippagePercentage, takerAddress } = params;

    const queryParams = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      slippagePercentage: (slippagePercentage / 100).toString(),
      ...(takerAddress && { takerAddress })
    });

    const response = await axios.get(`${apiUrl}/swap/v1/quote?${queryParams}`, {
      headers: {
        '0x-api-key': process.env.ZEROX_API_KEY || ''
      }
    });

    return {
      source: '0x',
      sellToken,
      buyToken,
      sellAmount: response.data.sellAmount,
      buyAmount: response.data.buyAmount,
      price: response.data.price,
      guaranteedPrice: response.data.guaranteedPrice,
      to: response.data.to,
      data: response.data.data,
      value: response.data.value,
      gasPrice: response.data.gasPrice,
      estimatedGas: response.data.estimatedGas,
      allowanceTarget: response.data.allowanceTarget,
      sources: response.data.sources,
      chainId
    };
  }

  /**
   * Get quote from 1inch
   */
  async get1inchQuote(chainId, params) {
    const chainIdMap = {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      avalanche: 43114
    };

    const networkId = chainIdMap[chainId];
    if (!networkId) {
      throw new Error('1inch not supported on this chain');
    }

    const { sellToken, buyToken, sellAmount, slippagePercentage, takerAddress } = params;

    const response = await axios.get(
      `https://api.1inch.io/v5.0/${networkId}/quote`,
      {
        params: {
          fromTokenAddress: sellToken,
          toTokenAddress: buyToken,
          amount: sellAmount
        }
      }
    );

    return {
      source: '1inch',
      sellToken,
      buyToken,
      sellAmount: response.data.fromTokenAmount,
      buyAmount: response.data.toTokenAmount,
      price: (parseFloat(response.data.toTokenAmount) / parseFloat(response.data.fromTokenAmount)).toString(),
      estimatedGas: response.data.estimatedGas,
      protocols: response.data.protocols,
      chainId
    };
  }

  /**
   * Get quote from Uniswap (on-chain)
   */
  async getUniswapQuote(chainId, params) {
    const { sellToken, buyToken, sellAmount } = params;
    
    const router = this.dexRouters[chainId]?.uniswapV2 || this.dexRouters[chainId]?.uniswapV3;
    if (!router) {
      throw new Error('Uniswap not available on this chain');
    }

    const provider = await getProviderWithFailover(chainId);
    
    // Uniswap V2 Router ABI (simplified)
    const routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
    ];

    const routerContract = new ethers.Contract(router, routerABI, provider);
    const path = [sellToken, buyToken];

    try {
      const amounts = await routerContract.getAmountsOut(sellAmount, path);
      const buyAmount = amounts[amounts.length - 1];

      return {
        source: 'Uniswap',
        sellToken,
        buyToken,
        sellAmount,
        buyAmount: buyAmount.toString(),
        price: (parseFloat(ethers.utils.formatEther(buyAmount)) / parseFloat(ethers.utils.formatEther(sellAmount))).toString(),
        router,
        path,
        chainId
      };
    } catch (error) {
      throw new Error(`Uniswap quote failed: ${error.message}`);
    }
  }

  /**
   * Execute swap transaction
   * @param {Object} params - Swap parameters
   * @returns {Object} Transaction result
   */
  async executeSwap(params) {
    const {
      walletId,
      chainId,
      quote,
      devicePasscodeId,
      customGasPrice,
      customGasLimit
    } = params;

    try {
      // Verify wallet access
      const credentials = await walletRepository.verifyAndGetCredentials(
        walletId,
        devicePasscodeId
      );

      if (!credentials) {
        throw new Error('Unauthorized access');
      }

      const chain = CHAINS[chainId.toUpperCase()];
      const wallet = await walletRepository.findById(walletId);
      const network = wallet.networks.find(n => n.network === chainId);
      
      if (!network) {
        throw new Error('Wallet does not support this chain');
      }

      const provider = await getProviderWithFailover(chainId);
      const signer = new ethers.Wallet(credentials.privateKeys[chainId], provider);

      // Check if token approval is needed
      if (quote.sellToken !== ethers.constants.AddressZero) {
        const approved = await this.checkAndApproveToken(
          signer,
          quote.sellToken,
          quote.allowanceTarget || quote.to,
          quote.sellAmount
        );

        if (!approved) {
          throw new Error('Token approval failed');
        }
      }

      // Prepare transaction
      const txParams = {
        to: quote.to,
        data: quote.data,
        value: quote.value || '0',
        gasPrice: customGasPrice 
          ? ethers.utils.parseUnits(customGasPrice.toString(), 'gwei')
          : quote.gasPrice,
        gasLimit: customGasLimit || quote.estimatedGas
      };

      // Send swap transaction
      const tx = await signer.sendTransaction(txParams);

      // Record transaction
      const txRecord = await transactionRepository.create({
        id: crypto.randomBytes(16).toString('hex'),
        walletId,
        network: chainId,
        txHash: tx.hash,
        fromAddress: network.address,
        toAddress: quote.to,
        amount: quote.sellAmount,
        tokenAddress: quote.sellToken,
        txType: 'swap',
        status: 'pending',
        metadata: JSON.stringify({
          sellToken: quote.sellToken,
          buyToken: quote.buyToken,
          sellAmount: quote.sellAmount,
          expectedBuyAmount: quote.buyAmount,
          source: quote.source
        }),
        createdAt: new Date().toISOString()
      });

      // Monitor transaction
      this.monitorSwapTransaction(txRecord.id, tx.hash, chainId);

      return {
        success: true,
        txHash: tx.hash,
        txId: txRecord.id,
        sellToken: quote.sellToken,
        buyToken: quote.buyToken,
        sellAmount: quote.sellAmount,
        expectedBuyAmount: quote.buyAmount,
        source: quote.source,
        chainId,
        status: 'pending',
        message: 'Swap transaction submitted successfully',
        explorerUrl: `${chain.explorerUrl}/tx/${tx.hash}`
      };

    } catch (error) {
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }

  /**
   * Check and approve token for swap
   */
  async checkAndApproveToken(signer, tokenAddress, spenderAddress, amount) {
    const erc20ABI = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ];

    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);
    
    // Check current allowance
    const currentAllowance = await tokenContract.allowance(
      await signer.getAddress(),
      spenderAddress
    );

    // If allowance is sufficient, return true
    if (currentAllowance.gte(ethers.BigNumber.from(amount))) {
      return true;
    }

    // Approve maximum amount
    const approveTx = await tokenContract.approve(
      spenderAddress,
      ethers.constants.MaxUint256
    );

    await approveTx.wait();
    return true;
  }

  /**
   * Monitor swap transaction
   */
  async monitorSwapTransaction(txId, txHash, chainId) {
    try {
      const provider = await getProviderWithFailover(chainId);
      const receipt = await provider.waitForTransaction(txHash, 1);

      await transactionRepository.update(txId, {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Swap monitoring failed for ${txHash}:`, error.message);
      await transactionRepository.update(txId, {
        status: 'failed'
      });
    }
  }

  /**
   * Get supported tokens for swapping on a chain
   * @param {string} chainId - Chain ID
   * @returns {Array} List of supported tokens
   */
  async getSupportedTokens(chainId) {
    const apiUrl = this.zeroXAPIs[chainId];
    if (!apiUrl) {
      return [];
    }

    try {
      const response = await axios.get(`${apiUrl}/swap/v1/tokens`);
      return response.data.records || [];
    } catch (error) {
      console.error('Failed to fetch supported tokens:', error.message);
      return [];
    }
  }

  /**
   * Get swap price (simplified quote without full routing)
   * @param {Object} params - Price parameters
   * @returns {Object} Price information
   */
  async getSwapPrice(params) {
    const { chainId, sellToken, buyToken, sellAmount } = params;

    try {
      const quote = await this.getSwapQuote({
        ...params,
        slippagePercentage: 0.5
      });

      return {
        price: quote.quote.price,
        guaranteedPrice: quote.quote.guaranteedPrice,
        sellAmount: quote.quote.sellAmount,
        buyAmount: quote.quote.buyAmount,
        estimatedPriceImpact: this.calculatePriceImpact(
          quote.quote.price,
          quote.quote.guaranteedPrice
        ),
        source: quote.quote.source
      };

    } catch (error) {
      throw new Error(`Failed to get swap price: ${error.message}`);
    }
  }

  /**
   * Calculate price impact percentage
   */
  calculatePriceImpact(price, guaranteedPrice) {
    if (!guaranteedPrice) return '0';
    const impact = ((parseFloat(price) - parseFloat(guaranteedPrice)) / parseFloat(price)) * 100;
    return impact.toFixed(2);
  }
}

module.exports = new SwapService();





