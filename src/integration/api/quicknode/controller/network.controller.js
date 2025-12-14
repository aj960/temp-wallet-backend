const { getProvider } = require('../provider/rpc.provider');
const { success, failure } = require('../../../../utils/response');
const { ethers } = require('ethers');

exports.getNetworkInfo = async (req, res) => {
  const { chainId = 'bsc' } = req.query;
  
  try {
    const provider = getProvider(chainId);
    const network = await provider.getNetwork();
    
    return success(res, {
      name: network.name,
      chainId: network.chainId,
      rpcProvider: 'PublicNode',
      rateLimit: '1M requests/day per IP'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch network info', { message: err.message });
  }
};

exports.getGasPrice = async (req, res) => {
  const { chainId = 'bsc' } = req.query;
  
  try {
    const provider = getProvider(chainId);
    const gasPrice = await provider.getGasPrice();
    
    return success(res, {
      chainId,
      gasPriceWei: gasPrice.toString(),
      gasPriceGwei: parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei')),
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch gas price', { message: err.message });
  }
};

exports.getLatestBlockInfo = async (req, res) => {
  const { chainId = 'bsc' } = req.query;
  
  try {
    const provider = getProvider(chainId);
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);

    return success(res, {
      chainId,
      blockNumber,
      timestamp: new Date(block.timestamp * 1000).toISOString(),
      miner: block.miner,
      txCount: block.transactions.length,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch latest block info', { message: err.message });
  }
};




