const { ethers } = require('ethers');
const { getProvider } = require('../../config/providerFactory');

exports.getBalance = async (coin, address) => {
  const provider = getProvider(coin);
  const balance = await provider.getBalance(address);
  return { coin, balance: ethers.utils.formatEther(balance) };
};

exports.broadcastTx = async (coin, rawTx) => {
  const provider = getProvider(coin);
  const tx = await provider.sendTransaction(rawTx);
  return { txHash: tx.hash };
};
