const { ethers } = require('ethers');
const { getQuickNodeProvider } = require('../provider/quicknode.provider');
const { USDT_BSC_CONTRACT } = require('../config/quicknode-config');

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function getBalancesFromMnemonic(mnemonic) {
  const provider = getQuickNodeProvider();

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  const address = wallet.address;

  const bnbWei = await provider.getBalance(address);
  const bnbBalance = parseFloat(ethers.utils.formatEther(bnbWei));

  const usdt = new ethers.Contract(USDT_BSC_CONTRACT, ERC20_ABI, provider);
  const usdtRaw = await usdt.balanceOf(address);
  const decimals = await usdt.decimals();
  const usdtBalance = parseFloat(ethers.utils.formatUnits(usdtRaw, decimals));

  return { address, bnbBalance, usdtBalance };
}

module.exports = { getBalancesFromMnemonic };
