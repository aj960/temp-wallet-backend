const walletService = require('../services/wallet/wallet.service');
const transactionService = require('../services/transaction/transaction.service');
const { success, failure, error: errorResponse } = require('../utils/response');

class TransactionController {
  /**
   * Universal send transaction endpoint
   * Supports all blockchains (EVM, UTXO, Solana, etc.)
   */
  async sendTransaction(req, res) {
    try {
      const { walletId, chainId, to, amount, tokenAddress, memo } = req.body;
      
      if (!walletId || !chainId || !to || !amount) {
        return errorResponse(res, 'Missing required fields: walletId, chainId, to, amount');
      }

      // Get wallet to verify it exists
      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        return errorResponse(res, 'Wallet not found', 404);
      }

      // Determine if this is a token or native currency transfer
      const isToken = !!tokenAddress;

      let result;
      if (isToken) {
        // Token transfer
        result = await transactionService.sendToken({
          walletId,
          chainId,
          tokenAddress,
          toAddress: to,
          amount,
          memo
        });
      } else {
        // Native currency transfer
        result = await transactionService.sendNative({
          walletId,
          chainId,
          toAddress: to,
          amount,
          memo
        });
      }

      return success(res, result, 'Transaction sent successfully');
    } catch (err) {
      console.error('Send transaction error:', err);
      return failure(res, 'Transaction failed', { message: err.message });
    }
  }

  /**
   * Get receive address for a specific blockchain
   */
  async getReceiveAddress(req, res) {
    try {
      const { walletId, chainId } = req.params;

      if (!walletId || !chainId) {
        return errorResponse(res, 'Missing required parameters: walletId, chainId');
      }

      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        return errorResponse(res, 'Wallet not found', 404);
      }

      // Get the address for the specific chain
      const address = await walletService.getAddressForChain(walletId, chainId);
      if (!address) {
        return errorResponse(res, `Chain ${chainId} not found for this wallet`, 404);
      }

      // Get chain information
      const chainInfo = await transactionService.getChainInfo(chainId);

      // Generate QR code URL
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(address)}`;

      return success(res, {
        walletId,
        chain: chainId,
        chainName: chainInfo.name,
        symbol: chainInfo.symbol,
        address,
        qrCode: qrCodeUrl,
        message: 'Share this address to receive funds',
        warning: `Only send ${chainInfo.symbol} to this address`
      });
    } catch (err) {
      console.error('Get receive address error:', err);
      return failure(res, 'Failed to get receive address', { message: err.message });
    }
  }

  /**
   * Get transaction history for a wallet on specific chain
   */
  async getTransactionHistory(req, res) {
    try {
      const { walletId, chainId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      if (!walletId || !chainId) {
        return errorResponse(res, 'Missing required parameters: walletId, chainId');
      }

      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        return errorResponse(res, 'Wallet not found', 404);
      }

      const address = await walletService.getAddressForChain(walletId, chainId);
      if (!address) {
        return errorResponse(res, `Chain ${chainId} not found for this wallet`, 404);
      }

      // Fetch transaction history from blockchain
      const transactions = await transactionService.getTransactionHistory(
        chainId,
        address,
        parseInt(page),
        parseInt(pageSize)
      );

      return success(res, {
        walletId,
        chain: chainId,
        address,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        transactions
      });
    } catch (err) {
      console.error('Get transaction history error:', err);
      return failure(res, 'Failed to get transaction history', { message: err.message });
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateTransactionFee(req, res) {
    try {
      const { chainId, to, amount, tokenAddress } = req.body;

      if (!chainId || !to || !amount) {
        return errorResponse(res, 'Missing required fields: chainId, to, amount');
      }

      const estimation = await transactionService.estimateFee({
        chainId,
        to,
        amount,
        tokenAddress
      });

      return success(res, estimation);
    } catch (err) {
      console.error('Fee estimation error:', err);
      return failure(res, 'Fee estimation failed', { message: err.message });
    }
  }

  /**
   * Validate blockchain address format
   */
  async validateAddress(req, res) {
    try {
      const { chainId, address } = req.body;

      if (!chainId || !address) {
        return errorResponse(res, 'Missing required fields: chainId, address');
      }

      const validation = await transactionService.validateAddress(chainId, address);

      return success(res, validation);
    } catch (err) {
      console.error('Address validation error:', err);
      return failure(res, 'Address validation failed', { message: err.message });
    }
  }

  // Legacy methods (keep for backward compatibility)
  async sendNative(req, res) {
    try {
      const { walletId, chainId, toAddress, amount, gasPrice, gasLimit, devicePasscodeId } = req.body;
      if (!walletId || !chainId || !toAddress || !amount || !devicePasscodeId) {
        return errorResponse(res, 'Missing required fields');
      }
      const result = await transactionService.sendNative({ 
        walletId, 
        chainId, 
        toAddress, 
        amount, 
        gasPrice, 
        gasLimit, 
        devicePasscodeId 
      });
      return success(res, result, 'Transaction sent successfully');
    } catch (err) {
      return failure(res, 'Transaction failed', { message: err.message });
    }
  }

  async sendToken(req, res) {
    try {
      const { walletId, chainId, tokenAddress, toAddress, amount, decimals, devicePasscodeId, gasPrice, gasLimit } = req.body;
      if (!walletId || !chainId || !tokenAddress || !toAddress || !amount || !devicePasscodeId) {
        return errorResponse(res, 'Missing required fields');
      }
      const result = await transactionService.sendToken({ 
        walletId, 
        chainId, 
        tokenAddress, 
        toAddress, 
        amount, 
        decimals, 
        devicePasscodeId, 
        gasPrice, 
        gasLimit 
      });
      return success(res, result, 'Token transfer sent successfully');
    } catch (err) {
      return failure(res, 'Token transfer failed', { message: err.message });
    }
  }

  async estimateGas(req, res) {
    try {
      const { chainId, fromAddress, toAddress, amount, tokenAddress } = req.body;
      if (!chainId || !fromAddress || !toAddress || !amount) {
        return errorResponse(res, 'Missing required fields');
      }
      const result = await transactionService.estimateGas({ 
        chainId, 
        fromAddress, 
        toAddress, 
        amount, 
        tokenAddress 
      });
      return success(res, result);
    } catch (err) {
      return failure(res, 'Gas estimation failed', { message: err.message });
    }
  }

  async getTransactionDetails(req, res) {
    try {
      const { txHash } = req.params;
      const { chainId } = req.query;
      if (!chainId) {
        return errorResponse(res, 'chainId is required');
      }
      const result = await transactionService.getTransactionDetails(txHash, chainId);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to get transaction details', { message: err.message });
    }
  }
}

module.exports = new TransactionController();

