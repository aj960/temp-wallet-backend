const { getBalancesFromMnemonic } = require('../service/quicknode.service');
const { getQuickNodeProvider } = require('../provider/quicknode.provider');
const { success, failure, error } = require('../../../../utils/response');
const { ethers } = require('ethers');


async function healthCheck(req, res) {
  return success(res, { message: 'QuickNode API running smoothly!' });
}

async function networkInfo(req, res) {
  try {

    //console.log('QuickNode URL:', process.env.QUICKNODE_BSC_URL);

    const provider = getQuickNodeProvider();
    const network = await provider.getNetwork();
    return success(res, network);
  } catch (err) {
    console.error('QuickNode Network related Error:', err.message);
    return failure(res, 'Failed to get network info'); // 500
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
    const provider = getQuickNodeProvider();

    const balanceBN = await provider.getBalance(wallet.address);
    const bnbBalance = parseFloat(ethers.utils.formatEther(balanceBN));

    const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
    const usdtRaw = await usdtContract.balanceOf(wallet.address);
    const usdtDecimals = await usdtContract.decimals();
    const usdtBalance = parseFloat(ethers.utils.formatUnits(usdtRaw, usdtDecimals));

    return success(res, {
      address: wallet.address,
      bnbBalance,
      usdtBalance
    });
  } catch (err) {
    const apiFailure = { message: err.message, stack: err.stack };
    if (err.message.includes('invalid mnemonic')) {
      return error(res, 'Invalid mnemonic provided', apiFailure);
    } else {
      return failure(res, 'QuickNode request failed', apiFailure);
    }
  }
}

module.exports = { healthCheck, networkInfo, generateMnemonic, createWallet, fetchBalance };
