/**
 * Buy/Sell Controller
 * Fiat on/off-ramp operations
 * 
 * Location: src/controllers/wallet/buy-sell.controller.js
 */

const buySellService = require('../../services/fiat/buy-sell.service');
const { success, failure, error: errorResponse } = require('../../utils/response');

class BuySellController {
  /**
   * Get buy quote from providers
   */
  async getBuyQuote(req, res) {
    try {
      const {
        cryptoCurrency,
        fiatCurrency,
        fiatAmount,
        walletAddress,
        chainId
      } = req.body;

      if (!cryptoCurrency || !fiatAmount || !walletAddress) {
        return errorResponse(res, 'cryptoCurrency, fiatAmount, and walletAddress are required');
      }

      const result = await buySellService.getBuyQuote({
        cryptoCurrency,
        fiatCurrency,
        fiatAmount,
        walletAddress,
        chainId
      });

      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to get buy quote', { message: err.message });
    }
  }

  /**
   * Get sell quote
   */
  async getSellQuote(req, res) {
    try {
      const {
        cryptoCurrency,
        cryptoAmount,
        fiatCurrency,
        walletAddress
      } = req.body;

      if (!cryptoCurrency || !cryptoAmount || !walletAddress) {
        return errorResponse(res, 'cryptoCurrency, cryptoAmount, and walletAddress are required');
      }

      const result = await buySellService.getSellQuote({
        cryptoCurrency,
        cryptoAmount,
        fiatCurrency,
        walletAddress
      });

      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to get sell quote', { message: err.message });
    }
  }

  /**
   * Create buy widget URL
   */
  async createBuyWidget(req, res) {
    try {
      const {
        provider,
        cryptoCurrency,
        fiatCurrency,
        fiatAmount,
        walletAddress,
        chainId,
        email,
        redirectUrl
      } = req.body;

      if (!cryptoCurrency || !fiatAmount || !walletAddress) {
        return errorResponse(res, 'cryptoCurrency, fiatAmount, and walletAddress are required');
      }

      const result = await buySellService.createBuyWidget({
        provider,
        cryptoCurrency,
        fiatCurrency,
        fiatAmount,
        walletAddress,
        chainId,
        email,
        redirectUrl
      });

      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to create buy widget', { message: err.message });
    }
  }

  /**
   * Get supported assets for a provider
   */
  async getSupportedAssets(req, res) {
    try {
      const { provider = 'moonpay' } = req.params;

      const assets = buySellService.getSupportedAssets(provider);
      
      return success(res, { 
        assets, 
        count: assets.length,
        provider 
      });
    } catch (err) {
      return failure(res, 'Failed to get supported assets', { message: err.message });
    }
  }

  /**
   * Get supported fiat currencies
   */
  async getSupportedFiat(req, res) {
    try {
      const { provider = 'moonpay' } = req.params;

      const currencies = buySellService.getSupportedFiat(provider);
      
      return success(res, { 
        currencies, 
        count: currencies.length,
        provider 
      });
    } catch (err) {
      return failure(res, 'Failed to get supported fiat currencies', { message: err.message });
    }
  }

  /**
   * Get provider limits
   */
  async getProviderLimits(req, res) {
    try {
      const { provider } = req.params;

      if (!provider) {
        return errorResponse(res, 'provider is required');
      }

      const limits = buySellService.getProviderLimits(provider);
      
      if (!limits) {
        return errorResponse(res, 'Invalid provider');
      }

      return success(res, limits);
    } catch (err) {
      return failure(res, 'Failed to get provider limits', { message: err.message });
    }
  }

  /**
   * Check KYC status
   */
  async checkKYCStatus(req, res) {
    try {
      const { provider, customerId } = req.body;

      if (!provider || !customerId) {
        return errorResponse(res, 'provider and customerId are required');
      }

      const result = await buySellService.checkKYCStatus(provider, customerId);
      
      return success(res, result);
    } catch (err) {
      return failure(res, 'Failed to check KYC status', { message: err.message });
    }
  }
}

module.exports = new BuySellController();




