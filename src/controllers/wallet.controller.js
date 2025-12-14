const walletService = require('../../services/wallet/wallet.service');
const transactionService = require('../../services/transaction/transaction.service');
const swapService = require('../../services/swap/swap.service');
const { success, failure, error: errorResponse } = require('../../utils/response');

// ==========================================
// WALLET CONTROLLER
// ==========================================

class WalletController {
  async generateMnemonic(req, res) {
    try {
      const { strength = 128 } = req.body;
      const result = await walletService.generateMnemonic(strength);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to generate mnemonic', { message: err.message });
    }
  }

  async validateMnemonic(req, res) {
    try {
      const { mnemonic } = req.body;
      if (!mnemonic) {
        return errorResponse(res, 'Mnemonic is required');
      }
      const result = walletService.validateMnemonic(mnemonic);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Validation failed', { message: err.message });
    }
  }

  async createWallet(req, res) {
    try {
      const { mnemonic, name, chains, devicePasscodeId, isMain } = req.body;
      if (!mnemonic || !devicePasscodeId) {
        return errorResponse(res, 'Mnemonic and devicePasscodeId are required');
      }
      const result = await walletService.createWallet({ mnemonic, name, chains, devicePasscodeId, isMain });
      return success(res, result, 'Wallet created successfully', 201);
    } catch (err) {
      return failure(res, 'Failed to create wallet', { message: err.message });
    }
  }

  async importWallet(req, res) {
    try {
      const { mnemonic, name, chains, devicePasscodeId } = req.body;
      if (!mnemonic || !devicePasscodeId) {
        return errorResponse(res, 'Mnemonic and devicePasscodeId are required');
      }
      const result = await walletService.importWallet({ mnemonic, name, chains, devicePasscodeId });
      return success(res, result, 'Wallet imported successfully', 201);
    } catch (err) {
      return failure(res, 'Failed to import wallet', { message: err.message });
    }
  }

  async importFromPrivateKey(req, res) {
    try {
      const { privateKey, chainId, name, devicePasscodeId } = req.body;
      if (!privateKey || !devicePasscodeId) {
        return errorResponse(res, 'Private key and devicePasscodeId are required');
      }
      const result = await walletService.importFromPrivateKey({ privateKey, chainId, name, devicePasscodeId });
      return success(res, result, 'Account imported successfully', 201);
    } catch (err) {
      return failure(res, 'Failed to import account', { message: err.message });
    }
  }

  async getWalletDetails(req, res) {
    try {
      const { walletId } = req.params;
      const { includeBalances = true } = req.query;
      const result = await walletService.getWalletDetails(walletId, includeBalances === 'true');
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to get wallet details', { message: err.message });
    }
  }

  async listWallets(req, res) {
    try {
      const { devicePasscodeId } = req.query;
      if (!devicePasscodeId) {
        return errorResponse(res, 'devicePasscodeId is required');
      }
      const wallets = await walletService.listWallets(devicePasscodeId);
      return success(res, { wallets, count: wallets.length });
    } catch (err) {
      return failure(res, 'Failed to list wallets', { message: err.message });
    }
  }

  async updateWalletName(req, res) {
    try {
      const { walletId } = req.params;
      const { name } = req.body;
      if (!name) {
        return errorResponse(res, 'Name is required');
      }
      const result = await walletService.setWalletName(walletId, name);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to update wallet name', { message: err.message });
    }
  }

  async setMainWallet(req, res) {
    try {
      const { walletId } = req.params;
      const { devicePasscodeId } = req.body;
      if (!devicePasscodeId) {
        return errorResponse(res, 'devicePasscodeId is required');
      }
      const result = await walletService.setMainWallet(walletId, devicePasscodeId);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to set main wallet', { message: err.message });
    }
  }

  async exportWallet(req, res) {
    try {
      const { walletId } = req.params;
      const { devicePasscodeId } = req.body;
      if (!devicePasscodeId) {
        return errorResponse(res, 'devicePasscodeId is required for security');
      }
      const result = await walletService.exportWallet(walletId, devicePasscodeId);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to export wallet', { message: err.message });
    }
  }

  async deleteWallet(req, res) {
    try {
      const { walletId } = req.params;
      const { devicePasscodeId } = req.body;
      if (!devicePasscodeId) {
        return errorResponse(res, 'devicePasscodeId is required for security');
      }
      const result = await walletService.deleteWallet(walletId, devicePasscodeId);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to delete wallet', { message: err.message });
    }
  }

  async deriveAddress(req, res) {
    try {
      const { walletId } = req.params;
      const { chainId, index = 0 } = req.body;
      if (!chainId) {
        return errorResponse(res, 'chainId is required');
      }
      const result = await walletService.deriveAddress(walletId, chainId, index);
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to derive address', { message: err.message });
    }
  }
}



