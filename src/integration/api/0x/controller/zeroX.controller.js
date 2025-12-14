const { ethers } = require('ethers');
const { getSwapQuote } = require('../service/zeroX.service');
const { getQuickNodeProvider } = require('../../quicknode/provider/quicknode.provider');
const { success, failure } = require('../../../../utils/response');

// 0x Exchange Proxy (Spender) address on BSC (needed for token approval)
const ZEROX_SPENDER = '0x1111111254fb6c44bac0bed2854e76f90643097d'; 

// Minimal ERC20 ABI for interacting with allowance and approval functions
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];


exports.swapUSDTtoBNB = async (req, res) => {
  const { privateKey, amountUSDT } = req.body;
  
  if (!privateKey || !amountUSDT) return failure(res, 'Missing fields (privateKey or amountUSDT)');

  try {
    const provider = getQuickNodeProvider();
    const wallet = new ethers.Wallet(privateKey, provider);

    // USDT (BEP20) & WBNB contract addresses
    const USDT = '0x55d398326f99059fF775485246999027B3197955';
    const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

    // Convert input amount to wei (USDT uses 18 decimals)
    const amountWei = ethers.utils.parseUnits(amountUSDT.toString(), 18);

    // --- 1. Check and Handle ERC-20 Token Approval ---
    const tokenContract = new ethers.Contract(USDT, ERC20_ABI, wallet);
    
    // Check current allowance of the 0x spender for the wallet's tokens
    const currentAllowance = await tokenContract.allowance(wallet.address, ZEROX_SPENDER);

    if (currentAllowance.lt(amountWei)) {
        //console.log(`Insufficient allowance for ${amountUSDT} USDT. Approving 0x spender...`);
        
        // This transaction requires BNB for gas!
        const approvalTx = await tokenContract.approve(ZEROX_SPENDER, amountWei);
        //console.log(`Approval TX Hash: ${approvalTx.hash}`);

        // Wait for the approval transaction to be mined before proceeding to the swap
        await approvalTx.wait();
        //console.log('Approval confirmed. Proceeding with swap.');
    } else {
        //console.log('Sufficient allowance already granted.');
    }
    // ------------------------------------------------------------------

    // 2. Get swap data from 0x
    const quote = await getSwapQuote(USDT, WBNB, amountWei.toString(), wallet.address);

    // 3. Build & send transaction (This transaction also requires BNB for gas!)
    const tx = await wallet.sendTransaction({
      to: quote.to,
      data: quote.data,
      value: quote.value ? ethers.BigNumber.from(quote.value) : 0,
      gasLimit: quote.gas ? ethers.BigNumber.from(quote.gas) : 300000
    });

    return success(res, { txHash: tx.hash, price: quote.price, swappedAmount: amountUSDT });
  } catch (err) {
    // If the error message indicates insufficient funds, guide the user
    if (err.message && err.message.includes('insufficient funds for gas')) {
       return failure(res, 'Swap failed: Insufficient BNB for Gas', { 
           suggestion: "You need a small amount of BNB (the native token) in your wallet to pay for the transaction fees (gas) before you can swap your USDT." 
       });
    }

    // This handles the 0x API's 404/400 errors when fetching the quote
    console.error('Swap failed:', err.message);
    return failure(res, 'Swap failed', { error: err.message });
  }
};