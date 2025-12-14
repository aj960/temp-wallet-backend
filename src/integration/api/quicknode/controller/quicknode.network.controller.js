const { success, failure } = require('../../../../utils/response');
const { getQuickNodeProvider } = require('../provider/quicknode.provider');
const { ethers } = require('ethers');


exports.getNetworkInfo = async (req, res) => {
  try {
    const provider = getQuickNodeProvider();
    const network = await provider.getNetwork();
    return success(res, {
      name: network.name,
      chainId: network.chainId,
      rpcUrl: provider.connection?.url || 'N/A'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch network info', { message: err.message });
  }
};


exports.getGasPrice = async (req, res) => {
  try {
    const provider = getQuickNodeProvider();
    const gasPrice = await provider.getGasPrice();
    return success(res, {
      gasPriceWei: gasPrice.toString(),
      gasPriceGwei: parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'))
    });
  } catch (err) {
    return failure(res, 'Failed to fetch gas price', { message: err.message });
  }
};

exports.getLatestBlockInfo = async (req, res) => {
  try {
    const provider = getQuickNodeProvider();
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);

    return success(res, {
      blockNumber,
      timestamp: new Date(block.timestamp * 1000).toISOString(),
      miner: block.miner,
      txCount: block.transactions.length
    });
  } catch (err) {
    return failure(res, 'Failed to fetch latest block info', { message: err.message });
  }
};
