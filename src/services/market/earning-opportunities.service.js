const axios = require('axios');
const auditLogger = require('../../security/audit-logger.service');

/**
 * Earning Opportunities Service
 * Aggregates staking, yield farming, and earning data from Cosmos, Juno, Stargaze, etc.
 */
class EarningOpportunitiesService {
  constructor() {
    // Free RPC endpoints
    this.rpcEndpoints = {
      cosmos: 'https://rpc.cosmos.network',
      juno: 'https://rpc.juno.strange.love',
      stargaze: 'https://rpc.stargaze-apis.com',
      osmosis: 'https://rpc.osmosis.zone'
    };

    // Cache
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes for earning data
  }

  /**
   * Get cached data
   */
  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get Cosmos staking opportunities
   */
  async getCosmosStaking() {
    try {
      return await this.getCached('cosmos_staking', async () => {
        // Get staking parameters
        const stakingParams = await axios.get(
          `${this.rpcEndpoints.cosmos}/cosmos/staking/v1beta1/params`,
          { timeout: 10000 }
        );

        // Get staking pool
        const stakingPool = await axios.get(
          `${this.rpcEndpoints.cosmos}/cosmos/staking/v1beta1/pool`,
          { timeout: 10000 }
        );

        // Get validators (top 10)
        const validators = await axios.get(
          `${this.rpcEndpoints.cosmos}/cosmos/staking/v1beta1/validators`,
          {
            params: {
              status: 'BOND_STATUS_BONDED',
              'pagination.limit': 10
            },
            timeout: 10000
          }
        );

        const pool = stakingPool.data.pool;
        const bondedTokens = parseFloat(pool.bonded_tokens) / 1000000; // Convert to ATOM
        const totalSupply = parseFloat(pool.not_bonded_tokens) + parseFloat(pool.bonded_tokens);
        const stakingRatio = (parseFloat(pool.bonded_tokens) / totalSupply * 100).toFixed(2);

        return {
          chain: 'cosmos',
          chainName: 'Cosmos Hub',
          symbol: 'ATOM',
          apr: 16.18, // Approximate APR (can be calculated from inflation)
          totalStaked: bondedTokens,
          stakingRatio: parseFloat(stakingRatio),
          validators: validators.data.validators.slice(0, 10).map(v => ({
            address: v.operator_address,
            moniker: v.description.moniker,
            commission: parseFloat(v.commission.commission_rates.rate) * 100,
            votingPower: parseFloat(v.tokens) / 1000000,
            status: v.status
          }))
        };
      });
    } catch (error) {
      auditLogger.logError(error, { service: 'getCosmosStaking' });
      // Return fallback data
      return {
        chain: 'cosmos',
        chainName: 'Cosmos Hub',
        symbol: 'ATOM',
        apr: 16.18,
        totalStaked: 0,
        stakingRatio: 0,
        validators: [],
        error: 'Failed to fetch live data'
      };
    }
  }

  /**
   * Get Juno staking opportunities
   */
  async getJunoStaking() {
    try {
      return await this.getCached('juno_staking', async () => {
        const stakingPool = await axios.get(
          `${this.rpcEndpoints.juno}/cosmos/staking/v1beta1/pool`,
          { timeout: 10000 }
        );

        const validators = await axios.get(
          `${this.rpcEndpoints.juno}/cosmos/staking/v1beta1/validators`,
          {
            params: {
              status: 'BOND_STATUS_BONDED',
              'pagination.limit': 10
            },
            timeout: 10000
          }
        );

        const pool = stakingPool.data.pool;
        const bondedTokens = parseFloat(pool.bonded_tokens) / 1000000;

        return {
          chain: 'juno',
          chainName: 'Juno Network',
          symbol: 'JUNO',
          apr: 22.96, // Approximate APR
          totalStaked: bondedTokens,
          validators: validators.data.validators.slice(0, 10).map(v => ({
            address: v.operator_address,
            moniker: v.description.moniker,
            commission: parseFloat(v.commission.commission_rates.rate) * 100,
            votingPower: parseFloat(v.tokens) / 1000000
          }))
        };
      });
    } catch (error) {
      auditLogger.logError(error, { service: 'getJunoStaking' });
      return {
        chain: 'juno',
        chainName: 'Juno Network',
        symbol: 'JUNO',
        apr: 22.96,
        totalStaked: 0,
        validators: [],
        error: 'Failed to fetch live data'
      };
    }
  }

  /**
   * Get Stargaze staking opportunities
   */
  async getStargazeStaking() {
    try {
      return await this.getCached('stargaze_staking', async () => {
        const stakingPool = await axios.get(
          `${this.rpcEndpoints.stargaze}/cosmos/staking/v1beta1/pool`,
          { timeout: 10000 }
        );

        const validators = await axios.get(
          `${this.rpcEndpoints.stargaze}/cosmos/staking/v1beta1/validators`,
          {
            params: {
              status: 'BOND_STATUS_BONDED',
              'pagination.limit': 10
            },
            timeout: 10000
          }
        );

        const pool = stakingPool.data.pool;
        const bondedTokens = parseFloat(pool.bonded_tokens) / 1000000;

        return {
          chain: 'stargaze',
          chainName: 'Stargaze',
          symbol: 'STARS',
          apr: 26.01, // Approximate APR
          totalStaked: bondedTokens,
          validators: validators.data.validators.slice(0, 10).map(v => ({
            address: v.operator_address,
            moniker: v.description.moniker,
            commission: parseFloat(v.commission.commission_rates.rate) * 100,
            votingPower: parseFloat(v.tokens) / 1000000
          }))
        };
      });
    } catch (error) {
      auditLogger.logError(error, { service: 'getStargazeStaking' });
      return {
        chain: 'stargaze',
        chainName: 'Stargaze',
        symbol: 'STARS',
        apr: 26.01,
        totalStaked: 0,
        validators: [],
        error: 'Failed to fetch live data'
      };
    }
  }

  /**
   * Get all earning opportunities
   */
  async getAllEarningOpportunities() {
    try {
      const [cosmos, juno, stargaze] = await Promise.all([
        this.getCosmosStaking(),
        this.getJunoStaking(),
        this.getStargazeStaking()
      ]);

      // Add additional curated opportunities
      const opportunities = [
        cosmos,
        juno,
        stargaze,
        // Static data for popular protocols
        {
          chain: 'ethereum',
          chainName: 'Lido (Ethereum)',
          protocol: 'Lido',
          symbol: 'ETH',
          apr: 15.33,
          type: 'liquid_staking',
          description: 'Liquid staking for Ethereum 2.0',
          tvl: 32000000000, // $32B approximate
          url: 'https://lido.fi'
        },
        {
          chain: 'polygon',
          chainName: 'Native Staking',
          protocol: 'Polygon',
          symbol: 'MATIC',
          apr: 15.26,
          type: 'native_staking',
          description: 'Stake MATIC directly on Polygon network'
        }
      ];

      // Sort by APR (highest first)
      return opportunities.sort((a, b) => b.apr - a.apr);
    } catch (error) {
      auditLogger.logError(error, { service: 'getAllEarningOpportunities' });
      throw new Error('Failed to fetch earning opportunities');
    }
  }

  /**
   * Get top earning opportunities (for home screen)
   */
  async getTopEarning(limit = 5) {
    try {
      const all = await this.getAllEarningOpportunities();
      return all.slice(0, limit);
    } catch (error) {
      auditLogger.logError(error, { service: 'getTopEarning' });
      throw new Error('Failed to fetch top earning opportunities');
    }
  }

  /**
   * Get earning opportunity by chain
   */
  async getEarningByChain(chain) {
    try {
      const chainMap = {
        'cosmos': () => this.getCosmosStaking(),
        'juno': () => this.getJunoStaking(),
        'stargaze': () => this.getStargazeStaking()
      };

      const fetchFn = chainMap[chain.toLowerCase()];
      
      if (!fetchFn) {
        throw new Error(`Chain ${chain} not supported for earning data`);
      }

      return await fetchFn();
    } catch (error) {
      auditLogger.logError(error, { service: 'getEarningByChain', chain });
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new EarningOpportunitiesService();

