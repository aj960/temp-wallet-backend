const walletService = require('../../services/wallet/wallet.service');
const transactionService = require('../../services/transaction/transaction.service');
const swapService = require('../../services/swap/swap.service');
const { success, failure, error: errorResponse } = require('../../utils/response');




class SwapController {
  async getQuote(req, res) {
    try {
      const { chainId, sellToken, buyToken, sellAmount, slippagePercentage, takerAddress } = req.body;
      if (!chainId || !sellToken || !buyToken || !sellAmount) {
        return errorResponse(res, 'Missing required fields');
      }
      const result = await swapService.getSwapQuote({ chainId, sellToken, buyToken, sellAmount, slippagePercentage, takerAddress });
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to get swap quote', { message: err.message });
    }
  }

  async executeSwap(req, res) {
    try {
      const { walletId, chainId, quote, devicePasscodeId, customGasPrice, customGasLimit } = req.body;
      if (!walletId || !chainId || !quote || !devicePasscodeId) {
        return errorResponse(res, 'Missing required fields');
      }
      const result = await swapService.executeSwap({ walletId, chainId, quote, devicePasscodeId, customGasPrice, customGasLimit });
      return success(res, result, 'Swap executed successfully');
    } catch (err) {
      return failure(res, 'Swap execution failed', { message: err.message });
    }
  }

  async getPrice(req, res) {
    try {
      const { chainId, sellToken, buyToken, sellAmount } = req.query;
      if (!chainId || !sellToken || !buyToken || !sellAmount) {
        return errorResponse(res, 'Missing required fields');
      }
      const result = await swapService.getSwapPrice({ chainId, sellToken, buyToken, sellAmount });
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to get swap price', { message: err.message });
    }
  }

  async getSupportedTokens(req, res) {
    try {
      const { chainId } = req.params;
      if (!chainId) {
        return errorResponse(res, 'chainId is required');
      }
      const tokens = await swapService.getSupportedTokens(chainId);
      return success(res, { tokens, count: tokens.length });
    } catch (err) {
      return failure(res, 'Failed to get supported tokens', { message: err.message });
    }
  }
}

module.exports = {
  walletController: new WalletController(),
  transactionController: new TransactionController(),
  swapController: new SwapController()
};


