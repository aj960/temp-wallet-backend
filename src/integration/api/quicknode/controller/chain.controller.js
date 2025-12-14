const { getProvider } = require('../provider/rpc.provider');
const { success, failure, error } = require('../../../../utils/response');

exports.getBlock = async (req, res) => {
  const { number } = req.params;
  const { chainId = 'bsc' } = req.query;
  
  try {
    const provider = getProvider(chainId);
    const block = await provider.getBlock(number ? parseInt(number) : 'latest');
    
    return success(res, {
      ...block,
      chainId,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch block', { message: err.message });
  }
};

exports.getTransactionCount = async (req, res) => {
  const { address } = req.params;
  const { chainId = 'bsc' } = req.query;
  
  if (!address) return error(res, 'Address required');

  try {
    const provider = getProvider(chainId);
    const count = await provider.getTransactionCount(address);
    
    return success(res, { 
      address, 
      count,
      chainId,
      rpcProvider: 'PublicNode'
    });
  } catch (err) {
    return failure(res, 'Failed to fetch transaction count', { message: err.message });
  }
};



