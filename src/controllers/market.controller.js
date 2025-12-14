const marketDataService = require('../services/market/market-data.service');
const earningService = require('../services/market/earning-opportunities.service');
const { success, error } = require('../utils/response');
const auditLogger = require('../security/audit-logger.service');

/**
 * Get trending tokens
 */
exports.getTrendingTokens = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const tokens = await marketDataService.getTrendingTokens(parseInt(limit));
    
    success(res, {
      total: tokens.length,
      tokens
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTrendingTokens' });
    error(res, e.message);
  }
};

/**
 * Get top tokens by market cap
 */
exports.getTopTokens = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const tokens = await marketDataService.getTopTokens(parseInt(limit));
    
    success(res, {
      total: tokens.length,
      tokens
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTopTokens' });
    error(res, e.message);
  }
};

/**
 * Get token details
 */
exports.getTokenDetails = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const token = await marketDataService.getTokenDetails(tokenId);
    
    success(res, token);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTokenDetails', tokenId: req.params.tokenId });
    error(res, e.message);
  }
};

/**
 * Get meme coins / high volatility tokens
 */
exports.getMemeCoins = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const tokens = await marketDataService.getMemeCoins(parseInt(limit));
    
    success(res, {
      total: tokens.length,
      tokens
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getMemeCoins' });
    error(res, e.message);
  }
};

/**
 * Get token price history
 */
exports.getTokenHistory = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { interval = 'd1', start, end } = req.query;
    
    const history = await marketDataService.getTokenHistory(
      tokenId,
      interval,
      start ? parseInt(start) : undefined,
      end ? parseInt(end) : undefined
    );
    
    success(res, {
      tokenId,
      interval,
      points: history.length,
      data: history
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTokenHistory', tokenId: req.params.tokenId });
    error(res, e.message);
  }
};

/**
 * Search tokens
 */
exports.searchTokens = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim() === '') {
      return error(res, 'Search query is required');
    }
    
    const tokens = await marketDataService.searchTokens(q, parseInt(limit));
    
    success(res, {
      query: q,
      total: tokens.length,
      tokens
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'searchTokens', query: req.query.q });
    error(res, e.message);
  }
};

/**
 * Get market overview
 */
exports.getMarketOverview = async (req, res) => {
  try {
    const overview = await marketDataService.getMarketOverview();
    success(res, overview);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getMarketOverview' });
    error(res, e.message);
  }
};

/**
 * Get gainers and losers
 */
exports.getGainersAndLosers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const data = await marketDataService.getGainersAndLosers(parseInt(limit));
    
    success(res, data);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getGainersAndLosers' });
    error(res, e.message);
  }
};

/**
 * Get token pairs from DEX
 */
exports.getTokenPairs = async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { chain = 'bsc' } = req.query;
    
    const pairs = await marketDataService.getTokenPairs(tokenAddress, chain);
    
    success(res, {
      tokenAddress,
      chain,
      pairs
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTokenPairs', tokenAddress: req.params.tokenAddress });
    error(res, e.message);
  }
};

/**
 * Get all earning opportunities
 */
exports.getAllEarningOpportunities = async (req, res) => {
  try {
    const opportunities = await earningService.getAllEarningOpportunities();
    
    success(res, {
      total: opportunities.length,
      opportunities
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getAllEarningOpportunities' });
    error(res, e.message);
  }
};

/**
 * Get top earning opportunities
 */
exports.getTopEarning = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const opportunities = await earningService.getTopEarning(parseInt(limit));
    
    success(res, {
      total: opportunities.length,
      opportunities
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTopEarning' });
    error(res, e.message);
  }
};

/**
 * Get earning by chain
 */
exports.getEarningByChain = async (req, res) => {
  try {
    const { chain } = req.params;
    const earning = await earningService.getEarningByChain(chain);
    
    success(res, earning);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getEarningByChain', chain: req.params.chain });
    error(res, e.message);
  }
};

/**
 * Refresh cache (admin only)
 */
exports.refreshCache = async (req, res) => {
  try {
    marketDataService.clearCache();
    earningService.clearCache();
    
    success(res, {
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'refreshCache' });
    error(res, e.message);
  }
};

/**
 * Get home screen data (combined endpoint for mobile)
 */
exports.getHomeScreenData = async (req, res) => {
  try {
    // Fetch all data in parallel for better performance
    const [overview, trending, topEarning, gainersLosers, memeCoins] = await Promise.all([
      marketDataService.getMarketOverview(),
      marketDataService.getTrendingTokens(10),
      earningService.getTopEarning(5),
      marketDataService.getGainersAndLosers(5),
      marketDataService.getMemeCoins(10)
    ]);

    success(res, {
      overview,
      trending: {
        tokens: trending
      },
      earning: {
        opportunities: topEarning
      },
      gainers: gainersLosers.gainers,
      losers: gainersLosers.losers,
      memeCoins: {
        tokens: memeCoins
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getHomeScreenData' });
    error(res, e.message);
  }
};

/**
 * Get token chart data
 */
exports.getTokenChart = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { period = '1D' } = req.query;
    
    const chartData = await marketDataService.getTokenChart(tokenId, period);
    
    success(res, chartData);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getTokenChart', tokenId: req.params.tokenId });
    error(res, e.message);
  }
};

