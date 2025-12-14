const { ethers } = require('ethers');
const { QUICKNODE_BSC_URL } = require('../config/quicknode-config');

let provider;
function getQuickNodeProvider() {
  if (!provider) {
    provider = new ethers.providers.JsonRpcProvider(QUICKNODE_BSC_URL);
  }
  return provider;
}
module.exports = { getQuickNodeProvider };
