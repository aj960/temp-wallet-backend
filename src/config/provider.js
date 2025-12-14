const { ethers } = require('ethers');

exports.ethProvider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
