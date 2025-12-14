const { getQuickNodeProvider } = require('../provider/quicknode.provider');
const { success, failure, error } = require('../../../../utils/response');
const { ethers } = require('ethers');
const { swapUSDTtoBNB } = require('../../0x/controller/zeroX.controller');


exports.estimateGas = async (req, res) => {
  const { from, to, value } = req.body;
  if (!from || !to || !value) return error(res, 'Missing required transaction fields');

  try {
    const provider = getQuickNodeProvider();
    const gasEstimate = await provider.estimateGas({ from, to, value: ethers.utils.parseEther(value.toString()) });
    return success(res, { estimatedGas: gasEstimate.toString() });
  } catch (err) {
    return failure(res, 'Gas estimation failed', { message: err.message });
  }
};

exports.sendTransaction = async (req, res) => {
  const { privateKey, to, amount } = req.body;
  if (!privateKey || !to || !amount) return error(res, 'Missing required fields');

  try {
    const provider = getQuickNodeProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.utils.parseEther(amount.toString())
    });

    return success(res, { txHash: tx.hash });
  } catch (err) {
    return failure(res, 'Transaction failed', { message: err.message });
  }
};

exports.getTxDetails = async (req, res) => {
  const { hash } = req.params;
  if (!hash) return error(res, 'Transaction hash required');

  try {
    const provider = getQuickNodeProvider();
    const tx = await provider.getTransaction(hash);
    return success(res, tx);
  } catch (err) {
    return failure(res, 'Failed to fetch transaction details', { message: err.message });
  }
};

exports.sendTokenTransaction = async (req, res) => {
  const { privateKey, to, amount, tokenAddress, decimals } = req.body;
  if (!privateKey || !to || !amount || !tokenAddress) 
    return error(res, 'Missing required fields');

  try {
    const provider = getQuickNodeProvider();
    const wallet = new ethers.Wallet(privateKey, provider);

    // Minimal ERC20 ABI
    const abi = [
      "function transfer(address to, uint256 amount) public returns (bool)",
      "function decimals() view returns (uint8)"
    ];

    const contract = new ethers.Contract(tokenAddress, abi, wallet);

    // use provided decimals (optional) or fetch from token
    const tokenDecimals = decimals || await contract.decimals();
    const amountInUnits = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

    // Send transfer
    const tx = await contract.transfer(to, amountInUnits);

    return success(res, { txHash: tx.hash });
  } catch (err) {
    return failure(res, 'Token transaction failed', { message: err.message });
  }
};
/*
Token	Network	Decimals	
USDT (BEP20)	BSC	18	
USDC (ERC20)	Ethereum	6	  
BUSD (BEP20)	BSC	18	
CAKE	BSC	18
*/



exports.sendTokenWithAutoGas = async (req, res) => {
  const { privateKey, to, amount, tokenAddress, decimals } = req.body;
  if (!privateKey || !to || !amount || !tokenAddress) 
    return error(res, 'Missing required fields');

  const provider = getQuickNodeProvider();
  const wallet = new ethers.Wallet(privateKey, provider);

  // 1️ Check current BNB balance
  const bnbBalance = parseFloat(ethers.utils.formatEther(await provider.getBalance(wallet.address)));

  // 2️ Estimate gas for token transfer
  const contract = new ethers.Contract(tokenAddress, [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function decimals() view returns (uint8)"
  ], wallet);

  const tokenDecimals = decimals || await contract.decimals();
  const amountInUnits = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

  const gasLimit = await contract.estimateGas.transfer(to, amountInUnits);
  const gasPrice = await provider.getGasPrice();
  const requiredBNB = parseFloat(ethers.utils.formatEther(gasLimit.mul(gasPrice)));

  // 3️Swap USDT → BNB if needed
  if (bnbBalance < requiredBNB) {
    const swapAmountUSDT = 0.5; // can be dynamic: estimate 2x gas in USD
    await swapUSDTtoBNB({ body: { privateKey, amountUSDT: swapAmountUSDT } }, { 
      status: () => ({ send: () => {} }) 
    });
  }

  // 4️ Send the token
  const tx = await contract.transfer(to, amountInUnits);

  return success(res, { txHash: tx.hash });
};
