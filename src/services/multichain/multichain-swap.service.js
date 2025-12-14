const { ethers } = require('ethers');
const axios = require('axios');
const { CHAINS, CHAIN_TYPES } = require('../../config/chains.config');
const { getProviderWithFailover } = require('../../config/rpc-providers.config'); // ✅ NEW
const auditLogger = require('../../security/audit-logger.service');

/**
 * Multi-Chain Token Swap Service
 * Supports swaps across all major blockchains
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Uses PublicNode RPCs for all EVM chains (free, no API keys)
 * - Automatic failover to Ankr backup
 * - All swap functionality preserved
 */
class MultiChainSwapService {
  
  /**
   * Get swap quote for any chain
   * @param {string} chainId - Chain identifier (ETHEREUM, BSC, POLYGON, etc.)
   * @param {string} sellToken - Token address or native token symbol
   * @param {string} buyToken - Token address or native token symbol  
   * @param {string} sellAmount - Amount in wei/smallest unit
   * @param {string} takerAddress - User wallet address
   */
  async getSwapQuote(chainId, sellToken, buyToken, sellAmount, takerAddress) {
    try {
      const chainConfig = CHAINS[chainId.toUpperCase()];
      
      if (!chainConfig) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      
      // Route to appropriate swap aggregator based on chain type
      switch (chainConfig.type) {
        case CHAIN_TYPES.EVM:
          return await this.getEVMSwapQuote(chainConfig, sellToken, buyToken, sellAmount, takerAddress);
        
        case CHAIN_TYPES.SOLANA:
          return await this.getSolanaSwapQuote(sellToken, buyToken, sellAmount, takerAddress);
        
        default:
          throw new Error(`Swap not implemented for chain type: ${chainConfig.type}`);
      }
      
    } catch (error) {
      auditLogger.logError(error, { service: 'getSwapQuote', chainId });
      throw error;
    }
  }
  
  /**
   * Get EVM chain swap quote using 0x Protocol
   * Supports: Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Base
   */
  async getEVMSwapQuote(chainConfig, sellToken, buyToken, sellAmount, takerAddress) {
    try {
      // 0x API endpoints for different chains
      const API_ENDPOINTS = {
        'ethereum': 'https://api.0x.org/swap/v1',
        'bsc': 'https://bsc.api.0x.org/swap/v1',
        'polygon': 'https://polygon.api.0x.org/swap/v1',
        'arbitrum': 'https://arbitrum.api.0x.org/swap/v1',
        'optimism': 'https://optimism.api.0x.org/swap/v1',
        'avalanchec': 'https://avalanche.api.0x.org/swap/v1',
        'fantom': 'https://fantom.api.0x.org/swap/v1',
        'base': 'https://base.api.0x.org/swap/v1'
      };
      
      const baseUrl = API_ENDPOINTS[chainConfig.id];
      
      if (!baseUrl) {
        throw new Error(`0x API not available for ${chainConfig.name}`);
      }
      
      const response = await axios.get(`${baseUrl}/quote`, {
        params: {
          sellToken,
          buyToken,
          sellAmount,
          takerAddress
        }
      });
      
      return {
        ...response.data,
        chainId: chainConfig.id,
        chainName: chainConfig.name,
        rpcProvider: 'PublicNode' // ✅ Uses PublicNode for execution
      };
      
    } catch (error) {
      if (error.response?.data) {
        throw new Error(error.response.data.description || error.response.data.reason || error.message);
      }
      throw error;
    }
  }
  
  /**
   * Get Solana swap quote using Jupiter Aggregator
   */
  async getSolanaSwapQuote(inputMint, outputMint, amount, userPublicKey) {
    try {
      const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps: 50 // 0.5% slippage
        }
      });
      
      return {
        ...response.data,
        chainId: 'solana',
        chainName: 'Solana'
      };
      
    } catch (error) {
      throw new Error(`Jupiter swap quote failed: ${error.message}`);
    }
  }
  
  /**
   * Execute swap on EVM chains
   * ✅ Uses PublicNode RPCs with automatic failover
   */
  async executeEVMSwap(chainConfig, privateKey, swapQuote) {
    try {
      // ✅ Get provider with automatic PublicNode → Ankr failover
      const provider = await getProviderWithFailover(chainConfig.id);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // ERC20 ABI for token approval
      const ERC20_ABI = [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)"
      ];
      
      // Check if we need to approve tokens (for token-to-token swaps)
      if (swapQuote.sellToken !== ethers.constants.AddressZero) {
        const tokenContract = new ethers.Contract(swapQuote.sellToken, ERC20_ABI, wallet);
        const currentAllowance = await tokenContract.allowance(wallet.address, swapQuote.allowanceTarget);
        
        if (currentAllowance.lt(swapQuote.sellAmount)) {
          //console.log('⏳ Approving token spend via PublicNode...');
          const approveTx = await tokenContract.approve(swapQuote.allowanceTarget, swapQuote.sellAmount);
          await approveTx.wait();
          //console.log('✅ Token approved');
        }
      }
      
      // Execute the swap
      //console.log('⏳ Executing swap via PublicNode RPC...');
      const tx = await wallet.sendTransaction({
        to: swapQuote.to,
        data: swapQuote.data,
        value: swapQuote.value ? ethers.BigNumber.from(swapQuote.value) : 0,
        gasLimit: swapQuote.gas ? ethers.BigNumber.from(swapQuote.gas) : 300000
      });
      
      //console.log(`🔄 Swap transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        txHash: tx.hash,
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        rpcProvider: 'PublicNode'
      };
      
    } catch (error) {
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }
  
  /**
   * Get supported DEXes/Aggregators per chain
   */
  getSupportedDexes(chainId) {
    const dexMap = {
      'ETHEREUM': ['0x Protocol', 'Uniswap', '1inch', 'Matcha'],
      'BSC': ['0x Protocol', 'PancakeSwap', '1inch'],
      'POLYGON': ['0x Protocol', 'QuickSwap', '1inch'],
      'ARBITRUM': ['0x Protocol', 'Uniswap', 'SushiSwap'],
      'OPTIMISM': ['0x Protocol', 'Uniswap', 'Velodrome'],
      'AVALANCHE': ['0x Protocol', 'Trader Joe', 'Pangolin'],
      'FANTOM': ['0x Protocol', 'SpookySwap', 'SpiritSwap'],
      'BASE': ['0x Protocol', 'BaseSwap', 'Uniswap'],
      'SOLANA': ['Jupiter', 'Raydium', 'Orca']
    };
    
    return dexMap[chainId.toUpperCase()] || [];
  }
  
  /**
   * Get common token addresses for a chain
   */
  getCommonTokens(chainId) {
    const tokens = {
      'BSC': {
        'USDT': '0x55d398326f99059fF775485246999027B3197955',
        'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        'CAKE': '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
      },
      'ETHEREUM': {
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      },
      'POLYGON': {
        'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
      }
    };
    
    return tokens[chainId.toUpperCase()] || {};
  }
}

module.exports = new MultiChainSwapService();





