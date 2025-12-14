/**
 * Trust Alpha Service
 * Manages Trust Alpha campaigns (token launches, reward pools)
 * 
 * Location: src/services/earn/trust-alpha.service.js
 */

const db = require('../../db/index');
const { v4: uuidv4 } = require('uuid');

class TrustAlphaService {
  constructor() {
    this.initializeTables();
  }

  /**
   * Initialize Trust Alpha database tables
   */
  initializeTables() {
    try {
      // Trust Alpha campaigns table
      db.exec(`
        CREATE TABLE IF NOT EXISTS trust_alpha_campaigns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          project_name TEXT NOT NULL,
          description TEXT NOT NULL,
          lock_token TEXT NOT NULL,
          reward_token TEXT NOT NULL,
          lock_chain TEXT NOT NULL,
          reward_chain TEXT,
          total_rewards TEXT NOT NULL,
          pool_allocation TEXT,
          min_lock_amount TEXT DEFAULT '0',
          max_lock_amount TEXT,
          lock_period_days INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          unlock_date TEXT,
          status TEXT DEFAULT 'upcoming',
          participants INTEGER DEFAULT 0,
          total_locked TEXT DEFAULT '0',
          website_url TEXT,
          twitter_url TEXT,
          telegram_url TEXT,
          icon_url TEXT,
          banner_url TEXT,
          terms TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);

      // Trust Alpha participations
      db.exec(`
        CREATE TABLE IF NOT EXISTS trust_alpha_participations (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL,
          campaign_id TEXT NOT NULL,
          locked_amount TEXT NOT NULL,
          lock_token TEXT NOT NULL,
          expected_rewards TEXT,
          reward_token TEXT,
          status TEXT DEFAULT 'active',
          lock_date TEXT NOT NULL,
          unlock_date TEXT,
          tx_hash TEXT,
          claimed INTEGER DEFAULT 0,
          claim_date TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
          FOREIGN KEY (campaign_id) REFERENCES trust_alpha_campaigns(id) ON DELETE CASCADE
        )
      `);

      // Indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_trust_alpha_campaigns_status ON trust_alpha_campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_trust_alpha_campaigns_dates ON trust_alpha_campaigns(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_trust_alpha_participations_wallet ON trust_alpha_participations(wallet_id);
        CREATE INDEX IF NOT EXISTS idx_trust_alpha_participations_campaign ON trust_alpha_participations(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_trust_alpha_participations_status ON trust_alpha_participations(status);
      `);

      // Seed sample campaigns
      this.seedSampleCampaigns();

      //console.log('✅ Trust Alpha tables initialized');
    } catch (err) {
      console.error('❌ Failed to initialize Trust Alpha tables:', err);
    }
  }

  /**
   * Seed sample Trust Alpha campaigns
   */
  seedSampleCampaigns() {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const campaigns = [
      {
        id: 'atwo-campaign',
        name: 'Earn ATWO with TWT',
        project_name: 'Arena Two',
        description: 'Arena Two is the world\'s first Web3 live sports ecosystem. Lock TWT and earn ATWO tokens.',
        lock_token: 'TWT',
        reward_token: 'ATWO',
        lock_chain: 'BSC',
        reward_chain: 'BSC',
        total_rewards: '5000000',
        pool_allocation: '60%',
        min_lock_amount: '100',
        lock_period_days: 30,
        start_date: pastDate.toISOString(),
        end_date: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000).toISOString(),
        unlock_date: futureDate.toISOString(),
        status: 'active',
        participants: 2847,
        total_locked: '12500000',
        website_url: 'https://www.arenatwo.com',
        terms: 'Tokens will be locked for 30 days. Rewards distributed proportionally.'
      },
      {
        id: 'cred-campaign',
        name: 'Earn CRED with TWT',
        project_name: 'Credia Layer',
        description: 'Credia Layer is an AI-powered market intelligence platform. Lock TWT and earn CRED rewards.',
        lock_token: 'TWT',
        reward_token: 'CRED',
        lock_chain: 'BSC',
        reward_chain: 'ETHEREUM',
        total_rewards: '5000000',
        pool_allocation: '100%',
        min_lock_amount: '100',
        lock_period_days: 45,
        start_date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() - 33 * 24 * 60 * 60 * 1000).toISOString(),
        unlock_date: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ended',
        participants: 1523,
        total_locked: '8900000',
        website_url: 'https://credialayer.io'
      },
      {
        id: 'elde-campaign',
        name: 'Earn ELDE with TWT',
        project_name: 'Elderglade',
        description: 'Elderglade is world\'s 1st hybrid gaming ecosystem with blockchain integration. Earn ELDE tokens.',
        lock_token: 'TWT',
        reward_token: 'ELDE',
        lock_chain: 'BSC',
        reward_chain: 'BSC',
        total_rewards: '1660000',
        pool_allocation: '100%',
        min_lock_amount: '50',
        lock_period_days: 60,
        start_date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        unlock_date: pastDate.toISOString(),
        status: 'ended',
        participants: 956,
        total_locked: '4200000',
        website_url: 'https://elderglade.com'
      },
      {
        id: 'wod-campaign',
        name: 'Earn WOD with TWT',
        project_name: 'World of Dypians',
        description: 'Immersive MMORPG with virtual land ownership. Lock TWT to earn WOD tokens.',
        lock_token: 'TWT',
        reward_token: 'WOD',
        lock_chain: 'BSC',
        reward_chain: 'BSC',
        total_rewards: '3000000',
        min_lock_amount: '100',
        lock_period_days: 30,
        start_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000).toISOString(),
        unlock_date: new Date(now.getTime() + 67 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'upcoming',
        website_url: 'https://www.worldofdypians.com'
      }
    ];

    const insertCampaign = db.prepare(`
      INSERT OR IGNORE INTO trust_alpha_campaigns (
        id, name, project_name, description, lock_token, reward_token,
        lock_chain, reward_chain, total_rewards, pool_allocation, min_lock_amount,
        max_lock_amount, lock_period_days, start_date, end_date, unlock_date,
        status, participants, total_locked, website_url, twitter_url, telegram_url,
        icon_url, banner_url, terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    campaigns.forEach(campaign => {
      try {
        insertCampaign.run(
          campaign.id,
          campaign.name,
          campaign.project_name,
          campaign.description,
          campaign.lock_token,
          campaign.reward_token,
          campaign.lock_chain,
          campaign.reward_chain || null,
          campaign.total_rewards,
          campaign.pool_allocation || null,
          campaign.min_lock_amount || '0',
          campaign.max_lock_amount || null,
          campaign.lock_period_days,
          campaign.start_date,
          campaign.end_date,
          campaign.unlock_date || null,
          campaign.status,
          campaign.participants || 0,
          campaign.total_locked || '0',
          campaign.website_url || null,
          campaign.twitter_url || null,
          campaign.telegram_url || null,
          campaign.icon_url || null,
          campaign.banner_url || null,
          campaign.terms || null
        );
      } catch (err) {
        // Ignore duplicates
      }
    });
  }

  /**
   * Get campaigns by status
   */
  getCampaigns(status = 'active') {
    let sql = `SELECT * FROM trust_alpha_campaigns`;
    const params = [];

    if (status !== 'all') {
      sql += ` WHERE status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY start_date DESC`;

    const campaigns = db.prepare(sql).all(...params);

    // Calculate additional data
    return campaigns.map(campaign => {
      const now = new Date();
      const endDate = new Date(campaign.end_date);
      const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

      return {
        ...campaign,
        daysRemaining,
        isActive: campaign.status === 'active' && now < endDate,
        participationRate: campaign.total_locked && campaign.total_rewards 
          ? ((parseFloat(campaign.total_locked) / parseFloat(campaign.total_rewards)) * 100).toFixed(2)
          : '0'
      };
    });
  }

  /**
   * Get campaign details
   */
  getCampaignDetails(campaignId) {
    const campaign = db.prepare(`
      SELECT * FROM trust_alpha_campaigns WHERE id = ?
    `).get(campaignId);

    if (!campaign) {
      return null;
    }

    // Get participants count and stats
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as participants,
        SUM(CAST(locked_amount AS REAL)) as total_locked
      FROM trust_alpha_participations
      WHERE campaign_id = ?
    `).get(campaignId);

    const now = new Date();
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);
    const unlockDate = campaign.unlock_date ? new Date(campaign.unlock_date) : null;

    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    const daysUntilUnlock = unlockDate 
      ? Math.max(0, Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      ...campaign,
      participants: stats.participants || campaign.participants,
      total_locked: stats.total_locked?.toString() || campaign.total_locked,
      daysRemaining,
      daysUntilUnlock,
      isActive: campaign.status === 'active' && now >= startDate && now < endDate,
      hasStarted: now >= startDate,
      hasEnded: now >= endDate
    };
  }

  /**
   * Join campaign (lock tokens)
   */
  async joinCampaign({ walletId, campaignId, amount, devicePasscodeId }) {
    const campaign = db.prepare(`
      SELECT * FROM trust_alpha_campaigns WHERE id = ?
    `).get(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Check campaign status
    const now = new Date();
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);

    if (campaign.status !== 'active') {
      throw new Error('Campaign is not active');
    }

    if (now < startDate) {
      throw new Error('Campaign has not started yet');
    }

    if (now >= endDate) {
      throw new Error('Campaign has ended');
    }

    // Validate amount
    const lockAmount = parseFloat(amount);
    const minAmount = parseFloat(campaign.min_lock_amount || 0);

    if (lockAmount < minAmount) {
      throw new Error(`Minimum lock amount is ${minAmount} ${campaign.lock_token}`);
    }

    if (campaign.max_lock_amount) {
      const maxAmount = parseFloat(campaign.max_lock_amount);
      if (lockAmount > maxAmount) {
        throw new Error(`Maximum lock amount is ${maxAmount} ${campaign.lock_token}`);
      }
    }

    // Check if already participating
    const existing = db.prepare(`
      SELECT * FROM trust_alpha_participations 
      WHERE wallet_id = ? AND campaign_id = ? AND status = 'active'
    `).get(walletId, campaignId);

    if (existing) {
      throw new Error('Already participating in this campaign');
    }

    // Calculate expected rewards (proportional)
    const totalRewards = parseFloat(campaign.total_rewards);
    const currentLocked = parseFloat(campaign.total_locked || 0);
    const estimatedShare = lockAmount / (currentLocked + lockAmount);
    const expectedRewards = totalRewards * estimatedShare;

    // Create participation
    const participationId = uuidv4();
    const unlockDate = new Date(now.getTime() + campaign.lock_period_days * 24 * 60 * 60 * 1000);
    const mockTxHash = `0x${Buffer.from(participationId).toString('hex')}`;

    db.prepare(`
      INSERT INTO trust_alpha_participations (
        id, wallet_id, campaign_id, locked_amount, lock_token,
        expected_rewards, reward_token, status, lock_date, unlock_date, tx_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), ?, ?)
    `).run(
      participationId,
      walletId,
      campaignId,
      amount,
      campaign.lock_token,
      expectedRewards.toFixed(6),
      campaign.reward_token,
      unlockDate.toISOString(),
      mockTxHash
    );

    // Update campaign stats
    db.prepare(`
      UPDATE trust_alpha_campaigns 
      SET participants = participants + 1,
          total_locked = CAST(CAST(total_locked AS REAL) + ? AS TEXT),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(lockAmount, campaignId);

    return {
      participationId,
      campaignId,
      campaignName: campaign.name,
      lockedAmount: amount,
      lockToken: campaign.lock_token,
      expectedRewards: expectedRewards.toFixed(6),
      rewardToken: campaign.reward_token,
      lockPeriodDays: campaign.lock_period_days,
      unlockDate: unlockDate.toISOString(),
      txHash: mockTxHash
    };
  }

  /**
   * Get user's Trust Alpha participations
   */
  getUserParticipations(walletId, status = 'active') {
    let sql = `
      SELECT 
        p.*,
        c.name as campaign_name,
        c.project_name,
        c.lock_period_days,
        c.status as campaign_status
      FROM trust_alpha_participations p
      JOIN trust_alpha_campaigns c ON p.campaign_id = c.id
      WHERE p.wallet_id = ?
    `;
    const params = [walletId];

    if (status !== 'all') {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY p.created_at DESC`;

    const participations = db.prepare(sql).all(...params);

    return participations.map(p => {
      const now = new Date();
      const unlockDate = p.unlock_date ? new Date(p.unlock_date) : null;
      const daysUntilUnlock = unlockDate 
        ? Math.max(0, Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        ...p,
        daysUntilUnlock,
        isUnlocked: unlockDate && now >= unlockDate,
        canClaim: p.claimed === 0 && unlockDate && now >= unlockDate
      };
    });
  }

  /**
   * Claim rewards from Trust Alpha participation
   */
  async claimTrustAlphaRewards({ participationId, devicePasscodeId }) {
    const participation = db.prepare(`
      SELECT * FROM trust_alpha_participations WHERE id = ?
    `).get(participationId);

    if (!participation) {
      throw new Error('Participation not found');
    }

    if (participation.claimed === 1) {
      throw new Error('Rewards already claimed');
    }

    const now = new Date();
    const unlockDate = new Date(participation.unlock_date);

    if (now < unlockDate) {
      const daysRemaining = Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24));
      throw new Error(`Tokens are still locked. Unlock in ${daysRemaining} days`);
    }

    // Mark as claimed
    db.prepare(`
      UPDATE trust_alpha_participations 
      SET claimed = 1, claim_date = datetime('now'), status = 'completed'
      WHERE id = ?
    `).run(participationId);

    const mockTxHash = `0x${Buffer.from(participationId + '-claim').toString('hex')}`;

    return {
      participationId,
      claimedAmount: participation.expected_rewards,
      rewardToken: participation.reward_token,
      lockedAmountReturned: participation.locked_amount,
      lockToken: participation.lock_token,
      txHash: mockTxHash
    };
  }
}

module.exports = new TrustAlphaService();
