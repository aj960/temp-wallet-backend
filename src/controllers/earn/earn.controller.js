/**
 * Earn Controller
 * Handles all Earn feature operations (Staking, Lending, Trust Alpha)
 * 
 * Location: src/controllers/earn/earn.controller.js
 */

const earnService = require('../../services/earn/earn.service');
const earnPositionService = require('../../services/earn/earn-position.service');
const trustAlphaService = require('../../services/earn/trust-alpha.service');
const { success, error } = require('../../utils/response');
const auditLogger = require('../../security/audit-logger.service');

class EarnController {
  /**
   * Get all available earning opportunities
   * GET /earn/opportunities
   */
  async getOpportunities(req, res) {
    try {
      const { 
        type,        // 'staking', 'lending', 'trust-alpha'
        chain,       // Filter by blockchain
        minApy,      // Minimum APY filter
        asset,       // Filter by specific asset
        limit = 50 
      } = req.query;

      const opportunities = await earnService.getEarnOpportunities({
        type,
        chain,
        minApy: minApy ? parseFloat(minApy) : undefined,
        asset,
        limit: parseInt(limit)
      });

      return success(res, {
        total: opportunities.length,
        opportunities
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getOpportunities' });
      return error(res, 'Failed to fetch earning opportunities', err.message);
    }
  }

  /**
   * Get stablecoin earning options
   * GET /earn/stablecoins
   */
  async getStablecoinEarn(req, res) {
    try {
      const { chain } = req.query;

      const stablecoins = await earnService.getStablecoinEarn(chain);

      return success(res, {
        total: stablecoins.length,
        stablecoins
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getStablecoinEarn' });
      return error(res, 'Failed to fetch stablecoin earn options', err.message);
    }
  }

  /**
   * Get native staking options
   * GET /earn/staking
   */
  async getStakingOptions(req, res) {
    try {
      const { chain, minApy } = req.query;

      const stakingOptions = await earnService.getStakingOptions({
        chain,
        minApy: minApy ? parseFloat(minApy) : undefined
      });

      return success(res, {
        total: stakingOptions.length,
        options: stakingOptions
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getStakingOptions' });
      return error(res, 'Failed to fetch staking options', err.message);
    }
  }

  /**
   * Get Trust Alpha campaigns
   * GET /earn/trust-alpha
   */
  async getTrustAlphaCampaigns(req, res) {
    try {
      const { status = 'active' } = req.query;

      const campaigns = await trustAlphaService.getCampaigns(status);

      return success(res, {
        total: campaigns.length,
        campaigns
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getTrustAlphaCampaigns' });
      return error(res, 'Failed to fetch Trust Alpha campaigns', err.message);
    }
  }

  /**
   * Get specific Trust Alpha campaign details
   * GET /earn/trust-alpha/:campaignId
   */
  async getTrustAlphaCampaignDetails(req, res) {
    try {
      const { campaignId } = req.params;

      const campaign = await trustAlphaService.getCampaignDetails(campaignId);

      if (!campaign) {
        return error(res, 'Campaign not found');
      }

      return success(res, campaign);
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getTrustAlphaCampaignDetails' });
      return error(res, 'Failed to fetch campaign details', err.message);
    }
  }

  /**
   * Start earning (stake/lend)
   * POST /earn/start
   */
  async startEarning(req, res) {
    try {
      const {
        walletId,
        opportunityId,
        amount,
        asset,
        chain,
        devicePasscodeId
      } = req.body;

      if (!walletId || !opportunityId || !amount || !asset || !chain || !devicePasscodeId) {
        return error(res, 'Missing required fields: walletId, opportunityId, amount, asset, chain, devicePasscodeId');
      }

      const result = await earnPositionService.createPosition({
        walletId,
        opportunityId,
        amount,
        asset,
        chain,
        devicePasscodeId
      });

      auditLogger.logSecurityEvent({
        type: 'EARN_POSITION_CREATED',
        walletId,
        opportunityId,
        amount,
        asset,
        chain,
        ip: req.ip
      });

      return success(res, result, 'Earning position created successfully');
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.startEarning' });
      return error(res, 'Failed to start earning', err.message);
    }
  }

  /**
   * Stop earning (unstake/withdraw)
   * POST /earn/stop
   */
  async stopEarning(req, res) {
    try {
      const {
        positionId,
        amount,
        devicePasscodeId
      } = req.body;

      if (!positionId || !devicePasscodeId) {
        return error(res, 'Missing required fields: positionId, devicePasscodeId');
      }

      const result = await earnPositionService.withdrawPosition({
        positionId,
        amount,
        devicePasscodeId
      });

      auditLogger.logSecurityEvent({
        type: 'EARN_POSITION_WITHDRAWN',
        positionId,
        amount: amount || 'full',
        ip: req.ip
      });

      return success(res, result, 'Withdrawal initiated successfully');
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.stopEarning' });
      return error(res, 'Failed to stop earning', err.message);
    }
  }

  /**
   * Get user's active earning positions
   * GET /earn/positions/:walletId
   */
  async getUserPositions(req, res) {
    try {
      const { walletId } = req.params;
      const { status = 'active' } = req.query;

      const positions = await earnPositionService.getUserPositions(walletId, status);

      // Calculate total earnings
      const totalValue = positions.reduce((sum, pos) => {
        return sum + parseFloat(pos.currentValue || pos.amount);
      }, 0);

      const totalEarned = positions.reduce((sum, pos) => {
        return sum + parseFloat(pos.totalEarned || 0);
      }, 0);

      return success(res, {
        walletId,
        totalPositions: positions.length,
        totalValue: totalValue.toFixed(6),
        totalEarned: totalEarned.toFixed(6),
        positions
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getUserPositions' });
      return error(res, 'Failed to fetch user positions', err.message);
    }
  }

  /**
   * Get specific position details
   * GET /earn/position/:positionId
   */
  async getPositionDetails(req, res) {
    try {
      const { positionId } = req.params;

      const position = await earnPositionService.getPositionDetails(positionId);

      if (!position) {
        return error(res, 'Position not found');
      }

      return success(res, position);
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getPositionDetails' });
      return error(res, 'Failed to fetch position details', err.message);
    }
  }

  /**
   * Claim rewards from earning position
   * POST /earn/claim-rewards
   */
  async claimRewards(req, res) {
    try {
      const { positionId, devicePasscodeId } = req.body;

      if (!positionId || !devicePasscodeId) {
        return error(res, 'Missing required fields: positionId, devicePasscodeId');
      }

      const result = await earnPositionService.claimRewards({
        positionId,
        devicePasscodeId
      });

      auditLogger.logSecurityEvent({
        type: 'EARN_REWARDS_CLAIMED',
        positionId,
        amount: result.claimedAmount,
        ip: req.ip
      });

      return success(res, result, 'Rewards claimed successfully');
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.claimRewards' });
      return error(res, 'Failed to claim rewards', err.message);
    }
  }

  /**
   * Calculate estimated earnings
   * POST /earn/estimate
   */
  async estimateEarnings(req, res) {
    try {
      const { opportunityId, amount, duration } = req.body;

      if (!opportunityId || !amount || !duration) {
        return error(res, 'Missing required fields: opportunityId, amount, duration');
      }

      const estimate = await earnService.estimateEarnings({
        opportunityId,
        amount: parseFloat(amount),
        duration: parseInt(duration)
      });

      return success(res, estimate);
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.estimateEarnings' });
      return error(res, 'Failed to estimate earnings', err.message);
    }
  }

  /**
   * Join Trust Alpha campaign
   * POST /earn/trust-alpha/join
   */
  async joinTrustAlpha(req, res) {
    try {
      const {
        walletId,
        campaignId,
        amount,
        devicePasscodeId
      } = req.body;

      if (!walletId || !campaignId || !amount || !devicePasscodeId) {
        return error(res, 'Missing required fields: walletId, campaignId, amount, devicePasscodeId');
      }

      const result = await trustAlphaService.joinCampaign({
        walletId,
        campaignId,
        amount,
        devicePasscodeId
      });

      auditLogger.logSecurityEvent({
        type: 'TRUST_ALPHA_JOINED',
        walletId,
        campaignId,
        amount,
        ip: req.ip
      });

      return success(res, result, 'Successfully joined Trust Alpha campaign');
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.joinTrustAlpha' });
      return error(res, 'Failed to join Trust Alpha campaign', err.message);
    }
  }

  /**
   * Get earning history for wallet
   * GET /earn/history/:walletId
   */
  async getEarningHistory(req, res) {
    try {
      const { walletId } = req.params;
      const { 
        startDate, 
        endDate, 
        type,
        limit = 100,
        offset = 0 
      } = req.query;

      const history = await earnPositionService.getEarningHistory({
        walletId,
        startDate,
        endDate,
        type,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return success(res, {
        walletId,
        total: history.length,
        history
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getEarningHistory' });
      return error(res, 'Failed to fetch earning history', err.message);
    }
  }

  /**
   * Get earning statistics for wallet
   * GET /earn/stats/:walletId
   */
  async getEarningStats(req, res) {
    try {
      const { walletId } = req.params;

      const stats = await earnPositionService.getEarningStats(walletId);

      return success(res, stats);
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getEarningStats' });
      return error(res, 'Failed to fetch earning statistics', err.message);
    }
  }

  /**
   * Get supported assets for earning
   * GET /earn/supported-assets
   */
  async getSupportedAssets(req, res) {
    try {
      const { chain } = req.query;

      const assets = await earnService.getSupportedAssets(chain);

      return success(res, {
        total: assets.length,
        assets
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.getSupportedAssets' });
      return error(res, 'Failed to fetch supported assets', err.message);
    }
  }

  /**
   * Refresh APY rates (admin/scheduled task)
   * POST /earn/refresh-rates
   */
  async refreshRates(req, res) {
    try {
      await earnService.refreshAllRates();

      return success(res, {
        message: 'APY rates refreshed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      auditLogger.logError(err, { controller: 'EarnController.refreshRates' });
      return error(res, 'Failed to refresh rates', err.message);
    }
  }
}

module.exports = new EarnController();



