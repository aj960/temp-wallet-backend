/**
 * BSC Service
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Updated provider import: quicknode.provider → rpc.provider
 * - Uses PublicNode RPCs (free, no API keys)
 * - All balance fetching functionality preserved
 */

const { ethers } = require('ethers');
const { getBSCProvider } = require('../provider/rpc.provider');
const { USDT_BSC_CONTRACT } = require('../config/provider.config');

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

/**
 * Get BNB and USDT balances from mnemonic
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @returns {Promise<Object>} Address and balances
 */
async function getBalancesFromMnemonic(mnemonic) {
  const provider = getBSCProvider(); // ✅ Now uses PublicNode with failover

  // Derive wallet from mnemonic
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  const address = wallet.address;

  // Get BNB balance
  const bnbWei = await provider.getBalance(address);
  const bnbBalance = parseFloat(ethers.utils.formatEther(bnbWei));

  // Get USDT balance
  const usdt = new ethers.Contract(USDT_BSC_CONTRACT, ERC20_ABI, provider);
  const usdtRaw = await usdt.balanceOf(address);
  const decimals = await usdt.decimals();
  const usdtBalance = parseFloat(ethers.utils.formatUnits(usdtRaw, decimals));

  return { 
    address, 
    bnbBalance, 
    usdtBalance,
    rpcProvider: 'PublicNode'
  };
}

/**
 * Get token balance for any BEP-20 token
 * @param {string} address - Wallet address
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} Token balance info
 */
async function getTokenBalance(address, tokenAddress) {
  const provider = getBSCProvider(); // ✅ PublicNode

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  const raw = await contract.balanceOf(address);
  const decimals = await contract.decimals();
  const balance = parseFloat(ethers.utils.formatUnits(raw, decimals));

  return {
    address,
    tokenAddress,
    balance,
    decimals,
    rpcProvider: 'PublicNode'
  };
}

/**
 * Get multiple token balances in parallel
 * @param {string} address - Wallet address
 * @param {string[]} tokenAddresses - Array of token contract addresses
 * @returns {Promise<Object[]>} Array of token balances
 */
async function getMultipleTokenBalances(address, tokenAddresses) {
  const provider = getBSCProvider(); // ✅ PublicNode

  const balancePromises = tokenAddresses.map(async (tokenAddress) => {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const raw = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      const balance = parseFloat(ethers.utils.formatUnits(raw, decimals));

      return {
        tokenAddress,
        balance,
        decimals,
        success: true
      };
    } catch (error) {
      return {
        tokenAddress,
        balance: 0,
        error: error.message,
        success: false
      };
    }
  });

  const results = await Promise.all(balancePromises);

  return {
    address,
    tokens: results,
    rpcProvider: 'PublicNode'
  };
}

module.exports = { 
  getBalancesFromMnemonic,
  getTokenBalance,
  getMultipleTokenBalances
};

