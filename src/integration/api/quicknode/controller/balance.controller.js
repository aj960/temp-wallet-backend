/**
 * Balance Controller
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Updated provider import: quicknode.provider → rpc.provider
 * - Uses PublicNode RPCs (free, no API keys)
 * - All balance fetching functionality preserved
 */

const { getProvider } = require('../provider/rpc.provider');
const { success, failure, error } = require('../../../../utils/response');
const { ethers } = require('ethers');

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

/**
 * Get native token balance (BNB, ETH, MATIC, etc.)
 */
exports.getNativeBalance = async (req, res) => {
  const { address, chainId = 'bsc' } = req.body;
  
  if (!address) {
    return error(res, 'Wallet address is required');
  }

  try {
    const provider = getProvider(chainId); // ✅ Now uses PublicNode with failover
    const balanceBN = await provider.getBalance(address);
    const balance = parseFloat(ethers.utils.formatEther(balanceBN));
    
    return success(res, { 
      address, 
      balance,
      chainId,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch native balance', { message: err.message });
  }
};

/**
 * Get ERC-20/BEP-20 token balance
 */
exports.getTokenBalance = async (req, res) => {
  const { address, tokenAddress, chainId = 'bsc' } = req.body;
  
  if (!address || !tokenAddress) {
    return error(res, 'Address and tokenAddress required');
  }

  try {
    const provider = getProvider(chainId); // ✅ Now uses PublicNode with failover
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const raw = await token.balanceOf(address);
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const balance = parseFloat(ethers.utils.formatUnits(raw, decimals));

    return success(res, { 
      address, 
      token: symbol, 
      balance,
      tokenAddress,
      chainId,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch token balance', { message: err.message });
  }
};



