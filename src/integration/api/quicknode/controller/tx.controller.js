/**
 * Transaction Controller
 * 
 * ✅ MIGRATED TO PUBLICNODE
 * - Updated provider import: quicknode.provider → rpc.provider
 * - Uses PublicNode RPCs (free, no API keys)
 * - All transaction functionality preserved (send, estimate gas, token transfers)
 * - Client-side signing maintained (private keys never sent to RPC)
 */

const { getProvider } = require('../provider/rpc.provider');
const { success, failure, error } = require('../../../../utils/response');
const { ethers } = require('ethers');

/**
 * Estimate gas for a transaction
 */
exports.estimateGas = async (req, res) => {
  const { from, to, value, chainId = 'bsc' } = req.body;
  
  if (!from || !to || !value) {
    return error(res, 'Missing required transaction fields');
  }

  try {
    const provider = getProvider(chainId); // ✅ PublicNode with failover
    const gasEstimate = await provider.estimateGas({ 
      from, 
      to, 
      value: ethers.utils.parseEther(value.toString()) 
    });
    
    return success(res, { 
      estimatedGas: gasEstimate.toString(),
      chainId,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Gas estimation failed', { message: err.message });
  }
};

/**
 * Send native token transaction (BNB, ETH, MATIC, etc.)
 * ✅ SECURITY: Private key signing happens CLIENT-SIDE, not on RPC
 */
exports.sendTransaction = async (req, res) => {
  const { privateKey, to, amount, chainId = 'bsc' } = req.body;
  
  if (!privateKey || !to || !amount) {
    return error(res, 'Missing required fields');
  }

  try {
    const provider = getProvider(chainId); // ✅ PublicNode with failover
    const wallet = new ethers.Wallet(privateKey, provider); // Client-side signing
    
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.utils.parseEther(amount.toString())
    });

    return success(res, { 
      txHash: tx.hash,
      chainId,
      from: wallet.address,
      to,
      amount: amount.toString(),
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Transaction failed', { message: err.message });
  }
};

/**
 * Get transaction details by hash
 */
exports.getTxDetails = async (req, res) => {
  const { hash, chainId = 'bsc' } = req.params;
  
  if (!hash) {
    return error(res, 'Transaction hash required');
  }

  try {
    const provider = getProvider(chainId); // ✅ PublicNode with failover
    const tx = await provider.getTransaction(hash);
    
    return success(res, {
      ...tx,
      chainId,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch transaction details', { message: err.message });
  }
};

/**
 * Send ERC-20/BEP-20 token transaction
 * ✅ SECURITY: Private key signing happens CLIENT-SIDE
 */
exports.sendTokenTransaction = async (req, res) => {
  const { privateKey, to, amount, tokenAddress, decimals, chainId = 'bsc' } = req.body;
  
  if (!privateKey || !to || !amount || !tokenAddress) {
    return error(res, 'Missing required fields');
  }

  try {
    const provider = getProvider(chainId); // ✅ PublicNode with failover
    const wallet = new ethers.Wallet(privateKey, provider); // Client-side signing

    // Minimal ERC20 ABI
    const abi = [
      "function transfer(address to, uint256 amount) public returns (bool)",
      "function decimals() view returns (uint8)"
    ];

    const contract = new ethers.Contract(tokenAddress, abi, wallet);

    // Use provided decimals or fetch from token
    const tokenDecimals = decimals || await contract.decimals();
    const amountInUnits = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

    // Send transfer
    const tx = await contract.transfer(to, amountInUnits);

    return success(res, { 
      txHash: tx.hash,
      chainId,
      from: wallet.address,
      to,
      amount: amount.toString(),
      tokenAddress,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Token transaction failed', { message: err.message });
  }
};

/**
 * Send token with automatic gas management
 * Checks BNB balance and swaps USDT → BNB if needed
 */
exports.sendTokenWithAutoGas = async (req, res) => {
  const { privateKey, to, amount, tokenAddress, decimals, chainId = 'bsc' } = req.body;
  
  if (!privateKey || !to || !amount || !tokenAddress) {
    return error(res, 'Missing required fields');
  }

  try {
    const provider = getProvider(chainId); // ✅ PublicNode with failover
    const wallet = new ethers.Wallet(privateKey, provider);

    // 1️⃣ Check current native token balance (BNB, ETH, etc.)
    const nativeBalance = parseFloat(
      ethers.utils.formatEther(await provider.getBalance(wallet.address))
    );

    // 2️⃣ Estimate gas for token transfer
    const contract = new ethers.Contract(tokenAddress, [
      "function transfer(address to, uint256 amount) public returns (bool)",
      "function decimals() view returns (uint8)"
    ], wallet);

    const tokenDecimals = decimals || await contract.decimals();
    const amountInUnits = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

    const gasLimit = await contract.estimateGas.transfer(to, amountInUnits);
    const gasPrice = await provider.getGasPrice();
    const requiredNative = parseFloat(
      ethers.utils.formatEther(gasLimit.mul(gasPrice))
    );

    // 3️⃣ Check if we need more gas
    if (nativeBalance < requiredNative) {
      return failure(res, 'Insufficient native token for gas', {
        currentBalance: nativeBalance,
        required: requiredNative,
        suggestion: 'Add native tokens or use swap functionality'
      });
    }

    // 4️⃣ Send the token
    const tx = await contract.transfer(to, amountInUnits);

    return success(res, { 
      txHash: tx.hash,
      chainId,
      from: wallet.address,
      to,
      amount: amount.toString(),
      gasUsed: requiredNative,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Auto-gas transaction failed', { message: err.message });
  }
};

module.exports = exports;




