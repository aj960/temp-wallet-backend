/**
 * Earn Position Service
 * Manages user earning positions (stakes, deposits, etc.)
 * 
 * Location: src/services/earn/earn-position.service.js
 */

const db = require('../../db/index');
const { v4: uuidv4 } = require('uuid');
const encryptionService = require('../security/encryption.service');
const multichainService = require('../multichain/multichain.service');
const { ethers } = require('ethers');

class EarnPositionService {
  /**
   * Create new earning position (stake/deposit)
   */
  async createPosition({ walletId, opportunityId, amount, asset, chain, devicePasscodeId }) {
    // Verify wallet exists
    const wallet = db.prepare(`
      SELECT * FROM wallets WHERE id = ?
    `).get(walletId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Verify opportunity exists
    const opportunity = db.prepare(`
      SELECT * FROM earn_opportunities WHERE id = ? AND active = 1
    `).get(opportunityId);

    if (!opportunity) {
      throw new Error('Earning opportunity not found or inactive');
    }

    // Validate amount
    const depositAmount = parseFloat(amount);
    const minAmount = parseFloat(opportunity.min_amount || 0);

    if (depositAmount < minAmount) {
      throw new Error(`Minimum amount is ${minAmount} ${asset}`);
    }

    if (opportunity.max_amount) {
      const maxAmount = parseFloat(opportunity.max_amount);
      if (depositAmount > maxAmount) {
        throw new Error(`Maximum amount is ${maxAmount} ${asset}`);
      }
    }

    // Get wallet network for this chain
    const network = db.prepare(`
      SELECT * FROM wallet_networks WHERE wallet_id = ? AND UPPER(network) = UPPER(?)
    `).get(walletId, chain);

    if (!network) {
      throw new Error(`Wallet does not support ${chain} network`);
    }

    // Check balance (optional - can be done on frontend)
    const balance = await multichainService.getBalance(chain, network.address);
    const balanceAmount = parseFloat(balance.balance);

    if (balanceAmount < depositAmount) {
      throw new Error(`Insufficient balance. Available: ${balanceAmount} ${asset}`);
    }

    // Create position record
    const positionId = uuidv4();
    const now = new Date().toISOString();

    const insertPosition = db.prepare(`
      INSERT INTO earn_positions (
        id, wallet_id, opportunity_id, amount, asset, chain,
        apy_at_start, status, start_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);

    insertPosition.run(
      positionId,
      walletId,
      opportunityId,
      amount,
      asset,
      chain.toUpperCase(),
      opportunity.apy,
      now,
      now
    );

    // Create transaction record
    const txId = uuidv4();
    const insertTx = db.prepare(`
      INSERT INTO earn_transactions (
        id, position_id, wallet_id, type, amount, asset, status, created_at
      ) VALUES (?, ?, ?, 'deposit', ?, ?, 'pending', ?)
    `);

    insertTx.run(txId, positionId, walletId, amount, asset, now);

    // In production, execute actual blockchain transaction here
    // For now, we'll simulate success
    const mockTxHash = `0x${Buffer.from(positionId).toString('hex')}`;

    // Update transaction with hash
    db.prepare(`
      UPDATE earn_transactions 
      SET tx_hash = ?, status = 'confirmed', confirmed_at = datetime('now')
      WHERE id = ?
    `).run(mockTxHash, txId);

    // Update position with tx_hash
    db.prepare(`
      UPDATE earn_positions SET tx_hash = ? WHERE id = ?
    `).run(mockTxHash, positionId);

    return {
      positionId,
      walletId,
      opportunityId,
      protocol: opportunity.protocol,
      amount,
      asset,
      chain,
      apy: opportunity.apy,
      lockPeriod: opportunity.lock_period,
      startDate: now,
      estimatedDailyEarnings: this.calculateDailyEarnings(depositAmount, opportunity.apy),
      txHash: mockTxHash,
      status: 'active'
    };
  }

  /**
   * Withdraw from position (unstake/withdraw)
   */
  async withdrawPosition({ positionId, amount, devicePasscodeId }) {
    const position = db.prepare(`
      SELECT * FROM earn_positions WHERE id = ? AND status = 'active'
    `).get(positionId);

    if (!position) {
      throw new Error('Position not found or not active');
    }

    // Check if locked
    const opportunity = db.prepare(`
      SELECT * FROM earn_opportunities WHERE id = ?
    `).get(position.opportunity_id);

    if (opportunity.lock_period > 0) {
      const startDate = new Date(position.start_date);
      const now = new Date();
      const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      if (daysPassed < opportunity.lock_period) {
        const daysRemaining = opportunity.lock_period - daysPassed;
        throw new Error(`Position is locked for ${daysRemaining} more days`);
      }
    }

    // Calculate earnings
    const earnings = this.calculateEarnings(
      parseFloat(position.amount),
      position.apy_at_start,
      position.start_date
    );

    const withdrawAmount = amount ? parseFloat(amount) : parseFloat(position.amount);
    const isFullWithdrawal = !amount || withdrawAmount >= parseFloat(position.amount);

    // Create withdrawal transaction
    const txId = uuidv4();
    const now = new Date().toISOString();

    const insertTx = db.prepare(`
      INSERT INTO earn_transactions (
        id, position_id, wallet_id, type, amount, asset, status, created_at
      ) VALUES (?, ?, ?, 'withdrawal', ?, ?, 'pending', ?)
    `);

    insertTx.run(
      txId,
      positionId,
      position.wallet_id,
      withdrawAmount.toString(),
      position.asset,
      now
    );

    // Mock transaction hash
    const mockTxHash = `0x${Buffer.from(txId).toString('hex')}`;

    // Update transaction
    db.prepare(`
      UPDATE earn_transactions 
      SET tx_hash = ?, status = 'confirmed', confirmed_at = datetime('now')
      WHERE id = ?
    `).run(mockTxHash, txId);

    // Update position
    if (isFullWithdrawal) {
      db.prepare(`
        UPDATE earn_positions 
        SET status = 'closed', end_date = datetime('now'), total_earned = ?
        WHERE id = ?
      `).run(earnings.totalEarned, positionId);
    } else {
      const newAmount = parseFloat(position.amount) - withdrawAmount;
      db.prepare(`
        UPDATE earn_positions 
        SET amount = ?, total_earned = ?
        WHERE id = ?
      `).run(newAmount.toString(), earnings.totalEarned, positionId);
    }

    return {
      positionId,
      withdrawAmount: withdrawAmount.toFixed(6),
      earnings: earnings.totalEarned,
      totalReturned: (withdrawAmount + parseFloat(earnings.totalEarned)).toFixed(6),
      txHash: mockTxHash,
      status: isFullWithdrawal ? 'closed' : 'active'
    };
  }

  /**
   * Claim rewards without withdrawing principal
   */
  async claimRewards({ positionId, devicePasscodeId }) {
    const position = db.prepare(`
      SELECT * FROM earn_positions WHERE id = ? AND status = 'active'
    `).get(positionId);

    if (!position) {
      throw new Error('Position not found or not active');
    }

    // Calculate unclaimed earnings
    const earnings = this.calculateEarnings(
      parseFloat(position.amount),
      position.apy_at_start,
      position.last_claim_date || position.start_date
    );

    if (parseFloat(earnings.totalEarned) <= 0) {
      throw new Error('No rewards available to claim');
    }

    // Create claim transaction
    const txId = uuidv4();
    const now = new Date().toISOString();

    const insertTx = db.prepare(`
      INSERT INTO earn_transactions (
        id, position_id, wallet_id, type, amount, asset, status, created_at
      ) VALUES (?, ?, ?, 'claim', ?, ?, 'confirmed', ?)
    `);

    insertTx.run(
      txId,
      positionId,
      position.wallet_id,
      earnings.totalEarned,
      position.asset,
      now
    );

    const mockTxHash = `0x${Buffer.from(txId).toString('hex')}`;

    db.prepare(`
      UPDATE earn_transactions SET tx_hash = ?, confirmed_at = datetime('now')
      WHERE id = ?
    `).run(mockTxHash, txId);

    // Update position
    const currentTotalEarned = parseFloat(position.total_earned || 0);
    const newTotalEarned = currentTotalEarned + parseFloat(earnings.totalEarned);

    db.prepare(`
      UPDATE earn_positions 
      SET total_earned = ?, last_claim_date = datetime('now')
      WHERE id = ?
    `).run(newTotalEarned.toString(), positionId);

    return {
      positionId,
      claimedAmount: earnings.totalEarned,
      txHash: mockTxHash,
      totalEarnedAllTime: newTotalEarned.toFixed(6)
    };
  }

  /**
   * Get user's earning positions
   */
  getUserPositions(walletId, status = 'active') {
    let sql = `
      SELECT 
        p.*,
        o.protocol,
        o.type as opportunity_type,
        o.protocol_url,
        o.risk_level
      FROM earn_positions p
      JOIN earn_opportunities o ON p.opportunity_id = o.id
      WHERE p.wallet_id = ?
    `;
    const params = [walletId];

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY p.created_at DESC`;

    const positions = db.prepare(sql).all(...params);

    // Calculate current values and earnings
    return positions.map(pos => {
      const earnings = this.calculateEarnings(
        parseFloat(pos.amount),
        pos.apy_at_start,
        pos.last_claim_date || pos.start_date
      );

      const currentValue = parseFloat(pos.amount) + parseFloat(earnings.totalEarned);

      return {
        ...pos,
        currentValue: currentValue.toFixed(6),
        unclaimedEarnings: earnings.totalEarned,
        dailyEarnings: earnings.dailyEarnings,
        daysActive: earnings.daysActive
      };
    });
  }

  /**
   * Get position details
   */
  getPositionDetails(positionId) {
    const position = db.prepare(`
      SELECT 
        p.*,
        o.protocol,
        o.type as opportunity_type,
        o.protocol_url,
        o.description,
        o.risk_level,
        o.lock_period
      FROM earn_positions p
      JOIN earn_opportunities o ON p.opportunity_id = o.id
      WHERE p.id = ?
    `).get(positionId);

    if (!position) {
      return null;
    }

    const earnings = this.calculateEarnings(
      parseFloat(position.amount),
      position.apy_at_start,
      position.last_claim_date || position.start_date
    );

    // Get transaction history
    const transactions = db.prepare(`
      SELECT * FROM earn_transactions 
      WHERE position_id = ? 
      ORDER BY created_at DESC
    `).all(positionId);

    return {
      ...position,
      currentValue: (parseFloat(position.amount) + parseFloat(earnings.totalEarned)).toFixed(6),
      unclaimedEarnings: earnings.totalEarned,
      dailyEarnings: earnings.dailyEarnings,
      daysActive: earnings.daysActive,
      transactions
    };
  }

  /**
   * Get earning history
   */
  getEarningHistory({ walletId, startDate, endDate, type, limit = 100, offset = 0 }) {
    let sql = `
      SELECT 
        t.*,
        p.asset,
        p.chain,
        o.protocol
      FROM earn_transactions t
      JOIN earn_positions p ON t.position_id = p.id
      JOIN earn_opportunities o ON p.opportunity_id = o.id
      WHERE t.wallet_id = ?
    `;
    const params = [walletId];

    if (startDate) {
      sql += ` AND t.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND t.created_at <= ?`;
      params.push(endDate);
    }

    if (type) {
      sql += ` AND t.type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  /**
   * Get earning statistics
   */
  getEarningStats(walletId) {
    // Active positions
    const activePositions = db.prepare(`
      SELECT COUNT(*) as count, SUM(CAST(amount AS REAL)) as totalValue
      FROM earn_positions
      WHERE wallet_id = ? AND status = 'active'
    `).get(walletId);

    // Total earned (all time)
    const totalEarned = db.prepare(`
      SELECT SUM(CAST(total_earned AS REAL)) as total
      FROM earn_positions
      WHERE wallet_id = ?
    `).get(walletId);

    // Earnings by asset
    const earningsByAsset = db.prepare(`
      SELECT 
        asset,
        SUM(CAST(total_earned AS REAL)) as earned,
        COUNT(*) as positions
      FROM earn_positions
      WHERE wallet_id = ?
      GROUP BY asset
    `).all(walletId);

    // Recent activity
    const recentActivity = db.prepare(`
      SELECT 
        t.type,
        t.amount,
        t.asset,
        t.created_at,
        o.protocol
      FROM earn_transactions t
      JOIN earn_positions p ON t.position_id = p.id
      JOIN earn_opportunities o ON p.opportunity_id = o.id
      WHERE t.wallet_id = ?
      ORDER BY t.created_at DESC
      LIMIT 10
    `).all(walletId);

    return {
      activePositions: activePositions.count || 0,
      totalValueLocked: (activePositions.totalValue || 0).toFixed(6),
      totalEarnedAllTime: (totalEarned.total || 0).toFixed(6),
      earningsByAsset,
      recentActivity
    };
  }

  /**
   * Helper: Calculate earnings for a position
   */
  calculateEarnings(principal, apy, startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const daysActive = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));

    if (daysActive === 0) {
      return {
        totalEarned: '0',
        dailyEarnings: '0',
        daysActive: 0
      };
    }

    // Calculate compound interest (daily compounding)
    const dailyRate = (apy / 100) / 365;
    const finalAmount = principal * Math.pow(1 + dailyRate, daysActive);
    const earned = finalAmount - principal;
    const dailyEarnings = earned / daysActive;

    return {
      totalEarned: earned.toFixed(6),
      dailyEarnings: dailyEarnings.toFixed(6),
      daysActive
    };
  }

  /**
   * Helper: Calculate daily earnings
   */
  calculateDailyEarnings(amount, apy) {
    const dailyRate = (apy / 100) / 365;
    const dailyEarnings = amount * dailyRate;
    return dailyEarnings.toFixed(6);
  }
}

module.exports = new EarnPositionService();


