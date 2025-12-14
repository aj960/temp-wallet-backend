const axios = require('axios');

const BASE_URL = 'https://bsc.api.0x.org/swap/v1';


exports.getSwapQuote = async (sellToken, buyToken, sellAmount, takerAddress) => {
  try {
    const response = await axios.get(`${BASE_URL}/quote`, {
      params: {
        sellToken,
        buyToken,
        sellAmount,
        takerAddress
      }
    });
    return response.data;
  } catch (err) {
    console.error('0x Quote Error:', err.response?.data || err.message);
    throw new Error(err.response?.data?.description || err.message);
  }
};
