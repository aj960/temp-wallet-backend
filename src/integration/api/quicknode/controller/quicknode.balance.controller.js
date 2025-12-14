const { getQuickNodeProvider } = require('../provider/quicknode.provider');
const { success, failure, error } = require('../../../../utils/response');
const { ethers } = require('ethers');

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

exports.getNativeBalance = async (req, res) => {
  const { address } = req.body;
  if (!address) return error(res, 'Wallet address is required');

  try {
    const provider = getQuickNodeProvider();
    const balanceBN = await provider.getBalance(address);
    const balance = parseFloat(ethers.utils.formatEther(balanceBN));
    return success(res, { address, balance });
  } catch (err) {
    return failure(res, 'Failed to fetch native balance', { message: err.message });
  }
};

exports.getTokenBalance = async (req, res) => {
  const { address, tokenAddress } = req.body;
  if (!address || !tokenAddress) return error(res, 'Address and tokenAddress required');

  try {
    const provider = getQuickNodeProvider();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const raw = await token.balanceOf(address);
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const balance = parseFloat(ethers.utils.formatUnits(raw, decimals));

    return success(res, { address, token: symbol, balance });
  } catch (err) {
    return failure(res, 'Failed to fetch token balance', { message: err.message });
  }
};
