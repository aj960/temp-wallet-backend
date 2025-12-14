/**
 * Complete Buy/Sell Service
 * Fiat on/off-ramp integration (Moonpay, Transak, Ramp Network)
 * 
 * Location: src/services/fiat/buy-sell.service.js
 */

const axios = require('axios');
const crypto = require('crypto');

class BuySellService {
  constructor() {
    // Supported fiat on-ramp providers
    this.providers = {
      moonpay: {
        name: 'MoonPay',
        apiUrl: 'https://api.moonpay.com',
        widgetUrl: 'https://buy.moonpay.com',
        apiKey: process.env.MOONPAY_API_KEY,
        secretKey: process.env.MOONPAY_SECRET_KEY,
        supportedFiat: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        minAmount: 20,
        maxAmount: 20000
      },
      transak: {
        name: 'Transak',
        apiUrl: 'https://api.transak.com',
        widgetUrl: 'https://global.transak.com',
        apiKey: process.env.TRANSAK_API_KEY,
        supportedFiat: ['USD', 'EUR', 'GBP', 'INR', 'JPY'],
        minAmount: 30,
        maxAmount: 10000
      },
      ramp: {
        name: 'Ramp Network',
        apiUrl: 'https://api.ramp.network',
        widgetUrl: 'https://buy.ramp.network',
        apiKey: process.env.RAMP_API_KEY,
        supportedFiat: ['USD', 'EUR', 'GBP'],
        minAmount: 20,
        maxAmount: 15000
      }
    };

    // Supported cryptocurrencies by provider
    this.supportedCrypto = {
      moonpay: [
        { symbol: 'ETH', name: 'Ethereum', chains: ['ethereum'] },
        { symbol: 'BTC', name: 'Bitcoin', chains: ['bitcoin'] },
        { symbol: 'BNB', name: 'BNB', chains: ['bsc'] },
        { symbol: 'MATIC', name: 'Polygon', chains: ['polygon'] },
        { symbol: 'USDT', name: 'Tether', chains: ['ethereum', 'bsc', 'polygon'] },
        { symbol: 'USDC', name: 'USD Coin', chains: ['ethereum', 'bsc', 'polygon'] }
      ],
      transak: [
        { symbol: 'ETH', name: 'Ethereum', chains: ['ethereum'] },
        { symbol: 'BTC', name: 'Bitcoin', chains: ['bitcoin'] },
        { symbol: 'BNB', name: 'BNB', chains: ['bsc'] },
        { symbol: 'MATIC', name: 'Polygon', chains: ['polygon'] },
        { symbol: 'SOL', name: 'Solana', chains: ['solana'] },
        { symbol: 'USDT', name: 'Tether', chains: ['ethereum', 'bsc', 'polygon'] }
      ],
      ramp: [
        { symbol: 'ETH', name: 'Ethereum', chains: ['ethereum'] },
        { symbol: 'BTC', name: 'Bitcoin', chains: ['bitcoin'] },
        { symbol: 'BNB', name: 'BNB', chains: ['bsc'] },
        { symbol: 'MATIC', name: 'Polygon', chains: ['polygon'] }
      ]
    };
  }

  /**
   * Get buy quote from all providers
   * @param {Object} params - Quote parameters
   * @returns {Object} Best quote from all providers
   */
  async getBuyQuote(params) {
    const {
      cryptoCurrency,
      fiatCurrency = 'USD',
      fiatAmount,
      walletAddress,
      chainId
    } = params;

    try {
      // Get quotes from all providers in parallel
      const quotePromises = [
        this.getMoonPayBuyQuote({
          cryptoCurrency,
          fiatCurrency,
          fiatAmount,
          walletAddress
        }).catch(err => ({ error: err.message, provider: 'moonpay' })),

        this.getTransakBuyQuote({
          cryptoCurrency,
          fiatCurrency,
          fiatAmount,
          walletAddress,
          chainId
        }).catch(err => ({ error: err.message, provider: 'transak' })),

        this.getRampBuyQuote({
          cryptoCurrency,
          fiatCurrency,
          fiatAmount,
          walletAddress
        }).catch(err => ({ error: err.message, provider: 'ramp' }))
      ];

      const quotes = await Promise.all(quotePromises);
      
      // Filter valid quotes
      const validQuotes = quotes.filter(q => !q.error);
      
      if (validQuotes.length === 0) {
        throw new Error('No buy quotes available from any provider');
      }

      // Find best quote (most crypto for the fiat amount)
      const bestQuote = validQuotes.reduce((best, current) => {
        const currentAmount = parseFloat(current.cryptoAmount);
        const bestAmount = parseFloat(best.cryptoAmount);
        return currentAmount > bestAmount ? current : best;
      });

      return {
        success: true,
        bestQuote,
        alternativeQuotes: validQuotes.filter(q => q !== bestQuote),
        fiatCurrency,
        fiatAmount,
        cryptoCurrency,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to get buy quote: ${error.message}`);
    }
  }

  /**
   * Get MoonPay buy quote
   */
  async getMoonPayBuyQuote(params) {
    const { cryptoCurrency, fiatCurrency, fiatAmount } = params;
    const config = this.providers.moonpay;

    if (!config.apiKey) {
      throw new Error('MoonPay API key not configured');
    }

    try {
      const response = await axios.get(`${config.apiUrl}/v3/currencies/${cryptoCurrency.toLowerCase()}/buy_quote`, {
        params: {
          apiKey: config.apiKey,
          baseCurrencyCode: fiatCurrency.toLowerCase(),
          baseCurrencyAmount: fiatAmount
        }
      });

      const quote = response.data;

      return {
        provider: 'moonpay',
        cryptoCurrency,
        cryptoAmount: quote.quoteCurrencyAmount,
        fiatCurrency,
        fiatAmount: quote.baseCurrencyAmount,
        fees: {
          networkFee: quote.networkFeeAmount,
          transactionFee: quote.feeAmount,
          totalFee: parseFloat(quote.networkFeeAmount) + parseFloat(quote.feeAmount)
        },
        exchangeRate: quote.quoteCurrencyPrice,
        estimatedTime: '10-30 minutes',
        paymentMethods: ['card', 'bank_transfer', 'apple_pay', 'google_pay']
      };

    } catch (error) {
      throw new Error(`MoonPay quote failed: ${error.message}`);
    }
  }

  /**
   * Get Transak buy quote
   */
  async getTransakBuyQuote(params) {
    const { cryptoCurrency, fiatCurrency, fiatAmount, chainId } = params;
    const config = this.providers.transak;

    if (!config.apiKey) {
      throw new Error('Transak API key not configured');
    }

    try {
      const response = await axios.get(`${config.apiUrl}/api/v2/currencies/price`, {
        params: {
          partnerApiKey: config.apiKey,
          fiatCurrency,
          cryptoCurrency,
          fiatAmount,
          network: chainId
        }
      });

      const quote = response.data.response;

      return {
        provider: 'transak',
        cryptoCurrency,
        cryptoAmount: quote.cryptoAmount,
        fiatCurrency,
        fiatAmount: quote.fiatAmount,
        fees: {
          networkFee: quote.networkFee,
          transactionFee: quote.totalFee - quote.networkFee,
          totalFee: quote.totalFee
        },
        exchangeRate: quote.conversionPrice,
        estimatedTime: '5-20 minutes',
        paymentMethods: ['card', 'bank_transfer']
      };

    } catch (error) {
      throw new Error(`Transak quote failed: ${error.message}`);
    }
  }

  /**
   * Get Ramp Network buy quote
   */
  async getRampBuyQuote(params) {
    const { cryptoCurrency, fiatCurrency, fiatAmount } = params;
    const config = this.providers.ramp;

    if (!config.apiKey) {
      throw new Error('Ramp Network API key not configured');
    }

    try {
      const response = await axios.get(`${config.apiUrl}/api/host-api/assets`, {
        params: {
          currencyCode: fiatCurrency,
          cryptoAssetSymbol: cryptoCurrency
        },
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      // Ramp doesn't have direct quote API, calculate based on price
      const asset = response.data.assets.find(a => a.symbol === cryptoCurrency);
      const cryptoAmount = fiatAmount / asset.price;
      const fee = fiatAmount * 0.025; // 2.5% fee

      return {
        provider: 'ramp',
        cryptoCurrency,
        cryptoAmount: cryptoAmount.toFixed(8),
        fiatCurrency,
        fiatAmount,
        fees: {
          networkFee: 0,
          transactionFee: fee,
          totalFee: fee
        },
        exchangeRate: asset.price,
        estimatedTime: '5-15 minutes',
        paymentMethods: ['card', 'bank_transfer', 'apple_pay']
      };

    } catch (error) {
      throw new Error(`Ramp quote failed: ${error.message}`);
    }
  }

  /**
   * Create buy widget URL
   * @param {Object} params - Widget parameters
   * @returns {Object} Widget URL and session
   */
  async createBuyWidget(params) {
    const {
      provider = 'moonpay',
      cryptoCurrency,
      fiatCurrency = 'USD',
      fiatAmount,
      walletAddress,
      chainId,
      email,
      redirectUrl
    } = params;

    const providerConfig = this.providers[provider];
    if (!providerConfig) {
      throw new Error('Invalid provider');
    }

    let widgetUrl;

    switch (provider) {
      case 'moonpay':
        widgetUrl = this.createMoonPayWidget({
          cryptoCurrency,
          fiatCurrency,
          fiatAmount,
          walletAddress,
          email,
          redirectUrl
        });
        break;

      case 'transak':
        widgetUrl = this.createTransakWidget({
          cryptoCurrency,
          fiatCurrency,
          fiatAmount,
          walletAddress,
          chainId,
          email,
          redirectUrl
        });
        break;

      case 'ramp':
        widgetUrl = this.createRampWidget({
          cryptoCurrency,
          fiatCurrency,
          fiatAmount,
          walletAddress,
          email
        });
        break;

      default:
        throw new Error('Provider not supported');
    }

    return {
      success: true,
      provider,
      widgetUrl,
      sessionId: crypto.randomBytes(16).toString('hex'),
      expiresIn: 3600,
      message: 'Complete purchase in the widget'
    };
  }

  /**
   * Create MoonPay widget URL
   */
  createMoonPayWidget(params) {
    const {
      cryptoCurrency,
      fiatCurrency,
      fiatAmount,
      walletAddress,
      email,
      redirectUrl
    } = params;

    const config = this.providers.moonpay;
    const baseUrl = config.widgetUrl;

    const queryParams = new URLSearchParams({
      apiKey: config.apiKey,
      currencyCode: cryptoCurrency.toLowerCase(),
      baseCurrencyCode: fiatCurrency.toLowerCase(),
      baseCurrencyAmount: fiatAmount,
      walletAddress,
      ...(email && { email }),
      ...(redirectUrl && { redirectURL: redirectUrl }),
      colorCode: '#6366f1'
    });

    // Generate signature for security
    const signature = this.generateMoonPaySignature(queryParams.toString());
    queryParams.append('signature', signature);

    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * Create Transak widget URL
   */
  createTransakWidget(params) {
    const {
      cryptoCurrency,
      fiatCurrency,
      fiatAmount,
      walletAddress,
      chainId,
      email,
      redirectUrl
    } = params;

    const config = this.providers.transak;
    const baseUrl = config.widgetUrl;

    const queryParams = new URLSearchParams({
      apiKey: config.apiKey,
      cryptoCurrencyCode: cryptoCurrency,
      fiatCurrency,
      fiatAmount,
      walletAddress,
      network: chainId,
      ...(email && { email }),
      ...(redirectUrl && { redirectURL: redirectUrl }),
      themeColor: '6366f1'
    });

    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * Create Ramp Network widget URL
   */
  createRampWidget(params) {
    const {
      cryptoCurrency,
      fiatCurrency,
      fiatAmount,
      walletAddress,
      email
    } = params;

    const config = this.providers.ramp;
    const baseUrl = config.widgetUrl;

    const queryParams = new URLSearchParams({
      hostApiKey: config.apiKey,
      swapAsset: `${cryptoCurrency}_${cryptoCurrency}`,
      fiatCurrency,
      fiatValue: fiatAmount,
      userAddress: walletAddress,
      ...(email && { userEmailAddress: email })
    });

    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * Generate MoonPay signature
   */
  generateMoonPaySignature(queryString) {
    const secretKey = this.providers.moonpay.secretKey;
    if (!secretKey) {
      return '';
    }

    return crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('base64');
  }

  /**
   * Get sell quote (crypto to fiat)
   * @param {Object} params - Sell parameters
   * @returns {Object} Sell quote
   */
  async getSellQuote(params) {
    const {
      cryptoCurrency,
      cryptoAmount,
      fiatCurrency = 'USD',
      walletAddress
    } = params;

    // MoonPay supports selling
    const config = this.providers.moonpay;

    if (!config.apiKey) {
      throw new Error('Sell not available - MoonPay not configured');
    }

    try {
      const response = await axios.get(`${config.apiUrl}/v3/currencies/${cryptoCurrency.toLowerCase()}/sell_quote`, {
        params: {
          apiKey: config.apiKey,
          baseCurrencyCode: fiatCurrency.toLowerCase(),
          quoteCurrencyAmount: cryptoAmount
        }
      });

      const quote = response.data;

      return {
        success: true,
        provider: 'moonpay',
        cryptoCurrency,
        cryptoAmount: quote.quoteCurrencyAmount,
        fiatCurrency,
        fiatAmount: quote.baseCurrencyAmount,
        fees: {
          networkFee: quote.networkFeeAmount,
          transactionFee: quote.feeAmount,
          totalFee: parseFloat(quote.networkFeeAmount) + parseFloat(quote.feeAmount)
        },
        exchangeRate: quote.quoteCurrencyPrice,
        estimatedTime: '1-3 business days',
        paymentMethods: ['bank_transfer']
      };

    } catch (error) {
      throw new Error(`Failed to get sell quote: ${error.message}`);
    }
  }

  /**
   * Get supported assets
   * @param {string} provider - Provider name
   * @returns {Array} Supported assets
   */
  getSupportedAssets(provider = 'moonpay') {
    return this.supportedCrypto[provider] || [];
  }

  /**
   * Get supported fiat currencies
   * @param {string} provider - Provider name
   * @returns {Array} Supported fiat currencies
   */
  getSupportedFiat(provider = 'moonpay') {
    const config = this.providers[provider];
    return config ? config.supportedFiat : [];
  }

  /**
   * Get provider limits
   * @param {string} provider - Provider name
   * @returns {Object} Min/max limits
   */
  getProviderLimits(provider = 'moonpay') {
    const config = this.providers[provider];
    return config ? {
      minAmount: config.minAmount,
      maxAmount: config.maxAmount,
      currency: 'USD'
    } : null;
  }

  /**
   * Check KYC status (if provider supports it)
   * @param {string} provider - Provider name
   * @param {string} customerId - Customer ID
   * @returns {Object} KYC status
   */
  async checkKYCStatus(provider, customerId) {
    // This would integrate with provider's KYC API
    // Placeholder implementation
    return {
      verified: false,
      status: 'pending',
      requiredDocuments: ['id', 'proof_of_address']
    };
  }
}

module.exports = new BuySellService();


