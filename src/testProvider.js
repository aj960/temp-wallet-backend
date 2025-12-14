require('dotenv').config(); // load .env variables
const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);

(async () => {
  try {
    const network = await provider.getNetwork();
    //console.log('Network:', network);

    const balance = await provider.getBalance('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    //console.log('Balance (ETH):', ethers.utils.formatEther(balance));
  } catch (e) {
    console.error('Error connecting to provider:', e.message);
  }
})();
