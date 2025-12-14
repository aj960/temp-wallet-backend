/**
 * BSC Blockchain Controller
 * 
 * ✅ MIGRATED FROM QUICKNODE TO PUBLICNODE
 * 
 * Changes:
 * - Renamed from quicknode.controller.js to bsc.controller.js
 * - Updated provider import from quicknode.provider to rpc.provider
 * - Uses PublicNode RPCs (no API keys needed)
 * - All functionality preserved (wallet generation, balance fetching, etc.)
 * 
 * PublicNode: Free, privacy-first, 1M req/day per IP
 */

const { getBSCProvider } = require('../provider/rpc.provider');
const { success, failure, error } = require('../../../../utils/response');
const { ethers } = require('ethers');


async function healthCheck(req, res) {
  return success(res, { message: 'BSC API running smoothly via PublicNode!' });
}

async function networkInfo(req, res) {
  try {
    const provider = getBSCProvider();
    const network = await provider.getNetwork();
    
    return success(res, {
      ...network,
      rpcProvider: 'PublicNode by Allnodes',
      rateLimit: '1M requests/day per IP',
      apiKeysRequired: false
    });
  } catch (err) {
    console.error('Network info error:', err.message);
    return failure(res, 'Failed to get network info');
  }
}


async function generateMnemonic(req, res) {
  try {
    const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
    return success(res, { mnemonic });
  } catch (err) {
    console.error('Mnemonic generation error:', err);
    return failure(res, 'Failed to generate mnemonic', { message: err.message, stack: err.stack });
  }
}

async function createWallet(req, res) {
  const { mnemonic } = req.body;
  if (!mnemonic) return error(res, 'Mnemonic is required');

  try {
    if (!ethers.utils.isValidMnemonic(mnemonic)) {
      return error(res, 'Invalid mnemonic provided');
    }

    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    return success(res, {
      address: wallet.address,
      privateKey: wallet.privateKey,
    });
  } catch (err) {
    console.error('Wallet creation error:', err);
    return failure(res, 'Failed to create wallet', { message: err.message, stack: err.stack });
  }
}

// USDT contract address on BSC
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function fetchBalance(req, res) {
  const { mnemonic } = req.body;
  if (!mnemonic) return error(res, 'Mnemonic is required');

  try {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic); 
    const provider = getBSCProvider(); // ✅ Now uses PublicNode

    // Get BNB balance
    const balanceBN = await provider.getBalance(wallet.address);
    const bnbBalance = parseFloat(ethers.utils.formatEther(balanceBN));

    // Get USDT balance
    const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
    const usdtRaw = await usdtContract.balanceOf(wallet.address);
    const usdtDecimals = await usdtContract.decimals();
    const usdtBalance = parseFloat(ethers.utils.formatUnits(usdtRaw, usdtDecimals));

    return success(res, {
      address: wallet.address,
      bnbBalance,
      usdtBalance,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    const apiFailure = { message: err.message, stack: err.stack };
    if (err.message.includes('invalid mnemonic')) {
      return error(res, 'Invalid mnemonic provided', apiFailure);
    } else {
      return failure(res, 'RPC request failed', apiFailure);
    }
  }
}

module.exports = { 
  healthCheck, 
  networkInfo, 
  generateMnemonic, 
  createWallet, 
  fetchBalance 
};
