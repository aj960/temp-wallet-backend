/**
 * Earn Service
 * Core service for fetching and managing earning opportunities
 * Integrates with DeFi Llama, CoinGecko, and custom aggregators
 * 
 * Location: src/services/earn/earn.service.js
 */

const axios = require('axios');
const db = require('../../db/index');
const { v4: uuidv4 } = require('uuid');

class EarnService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastUpdate = null;

    // API endpoints
    this.apis = {
      defiLlama: 'https://yields.llama.fi',
      coinGecko: 'https://api.coingecko.com/api/v3',
      stakingRewards: 'https://api.stakingrewards.com/public/v1'
    };

    // Initialize database tables
    this.initializeTables();
  }

  /**
   * Initialize earn-related database tables
   */
  initializeTables() {
    try {
      // Earning opportunities table
      db.exec(`
        CREATE TABLE IF NOT EXISTS earn_opportunities (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          protocol TEXT NOT NULL,
          asset TEXT NOT NULL,
          chain TEXT NOT NULL,
          apy REAL NOT NULL,
          tvl TEXT,
          min_amount TEXT DEFAULT '0',
          max_amount TEXT,
          lock_period INTEGER DEFAULT 0,
          risk_level TEXT DEFAULT 'medium',
          verified INTEGER DEFAULT 1,
          active INTEGER DEFAULT 1,
          protocol_url TEXT,
          icon_url TEXT,
          description TEXT,
          terms TEXT,
          updated_at TEXT DEFAULT (datetime('now')),
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);

      // User earning positions
      db.exec(`
        CREATE TABLE IF NOT EXISTS earn_positions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL,
          opportunity_id TEXT NOT NULL,
          amount TEXT NOT NULL,
          asset TEXT NOT NULL,
          chain TEXT NOT NULL,
          apy_at_start REAL NOT NULL,
          status TEXT DEFAULT 'active',
          total_earned TEXT DEFAULT '0',
          last_claim_date TEXT,
          start_date TEXT NOT NULL,
          end_date TEXT,
          tx_hash TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
          FOREIGN KEY (opportunity_id) REFERENCES earn_opportunities(id)
        )
      `);

      // Earning history/transactions
      db.exec(`
        CREATE TABLE IF NOT EXISTS earn_transactions (
          id TEXT PRIMARY KEY,
          position_id TEXT NOT NULL,
          wallet_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount TEXT NOT NULL,
          asset TEXT NOT NULL,
          tx_hash TEXT,
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT (datetime('now')),
          confirmed_at TEXT,
          FOREIGN KEY (position_id) REFERENCES earn_positions(id) ON DELETE CASCADE,
          FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
        )
      `);

      // APY history for tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS earn_apy_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opportunity_id TEXT NOT NULL,
          apy REAL NOT NULL,
          recorded_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (opportunity_id) REFERENCES earn_opportunities(id) ON DELETE CASCADE
        )
      `);

      // Indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_earn_opportunities_type ON earn_opportunities(type);
        CREATE INDEX IF NOT EXISTS idx_earn_opportunities_chain ON earn_opportunities(chain);
        CREATE INDEX IF NOT EXISTS idx_earn_opportunities_asset ON earn_opportunities(asset);
        CREATE INDEX IF NOT EXISTS idx_earn_opportunities_active ON earn_opportunities(active);
        
        CREATE INDEX IF NOT EXISTS idx_earn_positions_wallet ON earn_positions(wallet_id);
        CREATE INDEX IF NOT EXISTS idx_earn_positions_status ON earn_positions(status);
        CREATE INDEX IF NOT EXISTS idx_earn_positions_opportunity ON earn_positions(opportunity_id);
        
        CREATE INDEX IF NOT EXISTS idx_earn_transactions_position ON earn_transactions(position_id);
        CREATE INDEX IF NOT EXISTS idx_earn_transactions_wallet ON earn_transactions(wallet_id);
        CREATE INDEX IF NOT EXISTS idx_earn_transactions_status ON earn_transactions(status);
      `);

      //console.log('✅ Earn database tables initialized');
    } catch (err) {
      console.error('❌ Failed to initialize earn tables:', err);
    }
  }

  /**
   * Get all earning opportunities with filters
   */
  async getEarnOpportunities(filters = {}) {
    const { type, chain, minApy, asset, limit = 50 } = filters;

    // Build SQL query
    let sql = `
      SELECT * FROM earn_opportunities
      WHERE active = 1
    `;
    const params = [];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (chain) {
      sql += ` AND UPPER(chain) = UPPER(?)`;
      params.push(chain);
    }

    if (minApy) {
      sql += ` AND apy >= ?`;
      params.push(minApy);
    }

    if (asset) {
      sql += ` AND UPPER(asset) = UPPER(?)`;
      params.push(asset);
    }

    sql += ` ORDER BY apy DESC LIMIT ?`;
    params.push(limit);

    const opportunities = db.prepare(sql).all(...params);

    // If database is empty or stale, fetch from APIs
    if (opportunities.length === 0 || this.shouldRefresh()) {
      await this.refreshOpportunities();
      return db.prepare(sql).all(...params);
    }

    return opportunities;
  }

  /**
   * Get stablecoin earning options
   */
  async getStablecoinEarn(chain) {
    const stablecoins = ['USDC', 'USDT', 'USDA', 'DAI', 'BUSD'];
    
    let sql = `
      SELECT * FROM earn_opportunities
      WHERE active = 1
      AND asset IN (${stablecoins.map(() => '?').join(',')})
    `;
    const params = [...stablecoins];

    if (chain) {
      sql += ` AND UPPER(chain) = UPPER(?)`;
      params.push(chain);
    }

    sql += ` ORDER BY apy DESC`;

    let results = db.prepare(sql).all(...params);

    // Fetch from APIs if empty
    if (results.length === 0) {
      await this.refreshStablecoinRates();
      results = db.prepare(sql).all(...params);
    }

    return results;
  }

  /**
   * Get native staking options
   */
  async getStakingOptions(filters = {}) {
    const { chain, minApy } = filters;

    let sql = `
      SELECT * FROM earn_opportunities
      WHERE active = 1
      AND type = 'staking'
    `;
    const params = [];

    if (chain) {
      sql += ` AND UPPER(chain) = UPPER(?)`;
      params.push(chain);
    }

    if (minApy) {
      sql += ` AND apy >= ?`;
      params.push(minApy);
    }

    sql += ` ORDER BY apy DESC`;

    let results = db.prepare(sql).all(...params);

    // Fetch from APIs if empty
    if (results.length === 0) {
      await this.refreshStakingRates();
      results = db.prepare(sql).all(...params);
    }

    return results;
  }

  /**
   * Refresh opportunities from external APIs
   */
  async refreshOpportunities() {
    try {
      //console.log('🔄 Refreshing earn opportunities from APIs...');

      // Fetch from multiple sources in parallel
      const [defiPools, stakingData] = await Promise.allSettled([
        this.fetchDefiLlamaPools(),
        this.fetchStakingData()
      ]);

      let count = 0;

      // Process DeFi Llama pools
      if (defiPools.status === 'fulfilled' && defiPools.value) {
        count += await this.saveOpportunities(defiPools.value, 'lending');
      }

      // Process staking data
      if (stakingData.status === 'fulfilled' && stakingData.value) {
        count += await this.saveOpportunities(stakingData.value, 'staking');
      }

      this.lastUpdate = Date.now();
      //console.log(`✅ Refreshed ${count} earning opportunities`);

      return count;
    } catch (err) {
      console.error('❌ Failed to refresh opportunities:', err.message);
      throw err;
    }
  }

  /**
   * Fetch pools from DeFi Llama
   */
  async fetchDefiLlamaPools() {
    try {
      const response = await axios.get(`${this.apis.defiLlama}/pools`, {
        timeout: 10000
      });

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from DeFi Llama');
      }

      // Filter and format pools
      const pools = response.data.data
        .filter(pool => {
          // Filter for relevant chains and reasonable APYs
          const validChains = ['Ethereum', 'BSC', 'Polygon', 'Arbitrum', 'Optimism', 'Avalanche', 'Base'];
          return (
            pool.apy && 
            pool.apy > 0 && 
            pool.apy < 200 && // Filter out suspicious high APYs
            validChains.includes(pool.chain) &&
            pool.tvlUsd > 100000 // Minimum TVL
          );
        })
        .map(pool => ({
          id: uuidv4(),
          type: 'lending',
          protocol: pool.project || 'Unknown',
          asset: pool.symbol || 'Unknown',
          chain: this.normalizeChainName(pool.chain),
          apy: pool.apy,
          tvl: pool.tvlUsd ? pool.tvlUsd.toString() : '0',
          min_amount: '0',
          lock_period: 0,
          risk_level: this.calculateRiskLevel(pool),
          verified: 1,
          active: 1,
          protocol_url: pool.projectLink || null,
          description: `Earn ${pool.apy.toFixed(2)}% APY on ${pool.symbol} via ${pool.project}`
        }));

      return pools.slice(0, 100); // Limit to top 100
    } catch (err) {
      console.error('Failed to fetch DeFi Llama pools:', err.message);
      return [];
    }
  }

  /**
   * Fetch staking data (simulated - replace with actual API)
   */
  async fetchStakingData() {
    // This is a curated list of major staking opportunities
    // In production, integrate with actual staking APIs or on-chain data
    return [
      {
        id: uuidv4(),
        type: 'staking',
        protocol: 'Ethereum 2.0',
        asset: 'ETH',
        chain: 'ETHEREUM',
        apy: 3.5,
        tvl: '30000000000',
        min_amount: '0.01',
        lock_period: 0,
        risk_level: 'low',
        verified: 1,
        active: 1,
        description: 'Stake ETH and earn rewards while securing the Ethereum network'
      },
      {
        id: uuidv4(),
        type: 'staking',
        protocol: 'BNB Chain',
        asset: 'BNB',
        chain: 'BSC',
        apy: 5.2,
        tvl: '8000000000',
        min_amount: '0.1',
        lock_period: 7,
        risk_level: 'low',
        verified: 1,
        active: 1,
        description: 'Stake BNB to earn rewards on BNB Smart Chain'
      },
      {
        id: uuidv4(),
        type: 'staking',
        protocol: 'Solana',
        asset: 'SOL',
        chain: 'SOLANA',
        apy: 7.1,
        tvl: '5000000000',
        min_amount: '0.01',
        lock_period: 0,
        risk_level: 'medium',
        verified: 1,
        active: 1,
        description: 'Stake SOL to help secure the Solana network and earn rewards'
      },
      {
        id: uuidv4(),
        type: 'staking',
        protocol: 'Polygon',
        asset: 'MATIC',
        chain: 'POLYGON',
        apy: 4.8,
        tvl: '2000000000',
        min_amount: '1',
        lock_period: 0,
        risk_level: 'low',
        verified: 1,
        active: 1,
        description: 'Stake MATIC and participate in network consensus'
      },
      {
        id: uuidv4(),
        type: 'staking',
        protocol: 'Cosmos Hub',
        asset: 'ATOM',
        chain: 'COSMOS',
        apy: 15.2,
        tvl: '3000000000',
        min_amount: '0.1',
        lock_period: 21,
        risk_level: 'medium',
        verified: 1,
        active: 1,
        description: 'Stake ATOM to earn rewards in the Cosmos ecosystem'
      }
    ];
  }

  /**
   * Refresh stablecoin rates specifically
   */
  async refreshStablecoinRates() {
    const stablecoinOpportunities = [
      {
        id: uuidv4(),
        type: 'lending',
        protocol: 'Aave',
        asset: 'USDC',
        chain: 'ETHEREUM',
        apy: 4.54,
        tvl: '2500000000',
        min_amount: '0.01',
        lock_period: 0,
        risk_level: 'low',
        verified: 1,
        active: 1,
        protocol_url: 'https://app.aave.com',
        description: 'Supply USDC to Aave and earn interest'
      },
      {
        id: uuidv4(),
        type: 'lending',
        protocol: 'Aave',
        asset: 'USDT',
        chain: 'ETHEREUM',
        apy: 4.09,
        tvl: '1800000000',
        min_amount: '0.01',
        lock_period: 0,
        risk_level: 'low',
        verified: 1,
        active: 1,
        protocol_url: 'https://app.aave.com',
        description: 'Supply USDT to Aave and earn interest'
      },
      {
        id: uuidv4(),
        type: 'lending',
        protocol: 'Compound',
        asset: 'USDC',
        chain: 'ETHEREUM',
        apy: 3.85,
        tvl: '1500000000',
        min_amount: '0.01',
        lock_period: 0,
        risk_level: 'low',
        verified: 1,
        active: 1,
        protocol_url: 'https://app.compound.finance',
        description: 'Supply USDC to Compound and earn interest'
      },
      {
        id: uuidv4(),
        type: 'lending',
        protocol: 'Venus',
        asset: 'USDT',
        chain: 'BSC',
        apy: 5.32,
        tvl: '800000000',
        min_amount: '1',
        lock_period: 0,
        risk_level: 'low',
        verified: 1,
        active: 1,
        protocol_url: 'https://app.venus.io',
        description: 'Supply USDT to Venus on BSC and earn interest'
      }
    ];

    return await this.saveOpportunities(stablecoinOpportunities, 'lending');
  }

  /**
   * Refresh staking rates specifically
   */
  async refreshStakingRates() {
    const stakingData = await this.fetchStakingData();
    return await this.saveOpportunities(stakingData, 'staking');
  }

  /**
   * Save opportunities to database
   */
  async saveOpportunities(opportunities, type) {
    if (!opportunities || opportunities.length === 0) {
      return 0;
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO earn_opportunities (
        id, type, protocol, asset, chain, apy, tvl, min_amount, max_amount,
        lock_period, risk_level, verified, active, protocol_url, icon_url,
        description, terms, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const transaction = db.transaction((opps) => {
      for (const opp of opps) {
        insertStmt.run(
          opp.id,
          opp.type || type,
          opp.protocol,
          opp.asset,
          opp.chain,
          opp.apy,
          opp.tvl || '0',
          opp.min_amount || '0',
          opp.max_amount || null,
          opp.lock_period || 0,
          opp.risk_level || 'medium',
          opp.verified !== undefined ? opp.verified : 1,
          opp.active !== undefined ? opp.active : 1,
          opp.protocol_url || null,
          opp.icon_url || null,
          opp.description || null,
          opp.terms || null
        );
      }
    });

    transaction(opportunities);
    return opportunities.length;
  }

  /**
   * Estimate earnings based on opportunity and parameters
   */
  async estimateEarnings({ opportunityId, amount, duration }) {
    const opportunity = db.prepare(`
      SELECT * FROM earn_opportunities WHERE id = ?
    `).get(opportunityId);

    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    const principal = parseFloat(amount);
    const apy = opportunity.apy / 100;
    const days = parseInt(duration);

    // Calculate compound interest (daily compounding)
    const dailyRate = apy / 365;
    const finalAmount = principal * Math.pow(1 + dailyRate, days);
    const earnings = finalAmount - principal;

    return {
      opportunityId,
      protocol: opportunity.protocol,
      asset: opportunity.asset,
      principal: principal.toFixed(6),
      apy: opportunity.apy,
      duration: days,
      estimatedEarnings: earnings.toFixed(6),
      estimatedTotal: finalAmount.toFixed(6),
      dailyEarnings: (earnings / days).toFixed(6)
    };
  }

  /**
   * Get supported assets for earning
   */
  async getSupportedAssets(chain) {
    let sql = `
      SELECT DISTINCT asset, chain, COUNT(*) as opportunities
      FROM earn_opportunities
      WHERE active = 1
    `;
    const params = [];

    if (chain) {
      sql += ` AND UPPER(chain) = UPPER(?)`;
      params.push(chain);
    }

    sql += ` GROUP BY asset, chain ORDER BY opportunities DESC`;

    return db.prepare(sql).all(...params);
  }

  /**
   * Refresh all rates (called by scheduler or admin)
   */
  async refreshAllRates() {
    await this.refreshOpportunities();
    await this.refreshStablecoinRates();
    await this.refreshStakingRates();
  }

  /**
   * Helper: Check if cache should be refreshed
   */
  shouldRefresh() {
    if (!this.lastUpdate) return true;
    return Date.now() - this.lastUpdate > this.cacheExpiry;
  }

  /**
   * Helper: Normalize chain names
   */
  normalizeChainName(chain) {
    const mapping = {
      'Ethereum': 'ETHEREUM',
      'BSC': 'BSC',
      'BNB': 'BSC',
      'Binance': 'BSC',
      'Polygon': 'POLYGON',
      'Arbitrum': 'ARBITRUM',
      'Optimism': 'OPTIMISM',
      'Avalanche': 'AVALANCHE',
      'Base': 'BASE',
      'Fantom': 'FANTOM'
    };
    return mapping[chain] || chain.toUpperCase();
  }

  /**
   * Helper: Calculate risk level based on pool data
   */
  calculateRiskLevel(pool) {
    const tvl = pool.tvlUsd || 0;
    const apy = pool.apy || 0;

    if (tvl > 100000000 && apy < 20) return 'low';
    if (tvl > 10000000 && apy < 50) return 'medium';
    return 'high';
  }
}

module.exports = new EarnService();


