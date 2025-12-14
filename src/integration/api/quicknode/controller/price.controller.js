const axios = require('axios');
const { success, failure, error } = require('../../../../utils/response');

exports.getTokenPrice = async (req, res) => {
  const { symbol } = req.params;
  
  if (!symbol) return error(res, 'Token symbol required');

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`;
    const { data } = await axios.get(url);
    
    return success(res, { 
      symbol, 
      priceUSD: data[symbol.toLowerCase()].usd 
    });
  } catch (err) {
    return failure(res, 'Failed to fetch token price', { message: err.message });
  }
};

