const { getQuickNodeProvider } = require('../provider/quicknode.provider');
const { success, failure, error } = require('../../../../utils/response');

exports.getBlock = async (req, res) => {
  const { number } = req.params;
  try {
    const provider = getQuickNodeProvider();
    const block = await provider.getBlock(number ? parseInt(number) : 'latest');
    return success(res, block);
  } catch (err) {
    return failure(res, 'Failed to fetch block', { message: err.message });
  }
};

exports.getTransactionCount = async (req, res) => {
  const { address } = req.params;
  if (!address) return error(res, 'Address required');

  try {
    const provider = getQuickNodeProvider();
    const count = await provider.getTransactionCount(address);
    return success(res, { address, count });
  } catch (err) {
    return failure(res, 'Failed to fetch transaction count', { message: err.message });
  }
};
