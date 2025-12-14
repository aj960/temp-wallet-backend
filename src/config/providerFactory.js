const { ethers } = require('ethers');
const chains = require('./chains');

exports.getProvider = (coin) => {
  const chain = chains[coin];
  if (!chain) throw new Error(`Unsupported chain: ${coin}`);
  return new ethers.providers.JsonRpcProvider(chain.rpc);
};
