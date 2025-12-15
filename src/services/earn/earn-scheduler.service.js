/**
 * Earn Scheduler Service
 * Auto-updates APY rates and campaign statuses
 * 
 * Location: src/services/earn/earn-scheduler.service.js
 */

const earnService = require('./earn.service');
const trustAlphaService = require('./trust-alpha.service');
const db = require('../../db/index');

class EarnSchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.updateInterval = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Start the scheduler
   */
  start(intervalMs) {
    if (this.isRunning) {
      //console.log('⏸️  Earn scheduler already running');
      return;
    }

    this.updateInterval = intervalMs || this.updateInterval;
    
    //console.log(`🚀 Starting Earn scheduler (interval: ${this.updateInterval / 1000}s)`);

    // Run immediately on start
    this.runUpdate();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runUpdate();
    }, this.updateInterval);

    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      //console.log('⏸️  Earn scheduler not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    //console.log('🛑 Earn scheduler stopped');
  }

  /**
   * Run scheduled update
   */
  async runUpdate() {
    //console.log(`\n🔄 [${new Date().toISOString()}] Running Earn scheduler update...`);

    try {
      // Update APY rates from external APIs
      await this.updateApyRates();

      // Update campaign statuses
      await this.updateCampaignStatuses();

      // Calculate and update position earnings
      await this.updatePositionEarnings();

      //console.log('✅ Earn scheduler update completed\n');
    } catch (err) {
      console.error('❌ Earn scheduler update failed:', err.message);
    }
  }

  /**
   * Update APY rates from external APIs
   */
  async updateApyRates() {
    try {
      //console.log('  📊 Updating APY rates...');
      
      const count = await earnService.refreshAllRates();
      
      //console.log(`  ✅ Updated ${count || 0} opportunities`);
    } catch (err) {
      console.error('  ❌ Failed to update APY rates:', err.message);
    }
  }

  /**
   * Update Trust Alpha campaign statuses
   */
  async updateCampaignStatuses() {
    try {
      //console.log('  🎯 Updating Trust Alpha campaign statuses...');

      const now = new Date().toISOString();

      // Mark upcoming campaigns as active if start date passed
      const activatedCount = db.prepare(`
        UPDATE trust_alpha_campaigns 
        SET status = 'active', updated_at = ?
        WHERE status = 'upcoming' AND start_date <= ?
      `).run(now, now).changes;

      // Mark active campaigns as ended if end date passed
      const endedCount = db.prepare(`
        UPDATE trust_alpha_campaigns 
        SET status = 'ended', updated_at = ?
        WHERE status = 'active' AND end_date <= ?
      `).run(now, now).changes;

      //console.log(`  ✅ Activated ${activatedCount} campaigns, ended ${endedCount} campaigns`);
    } catch (err) {
      console.error('  ❌ Failed to update campaign statuses:', err.message);
    }
  }

  /**
   * Update position earnings (calculate accumulated rewards)
   */
  async updatePositionEarnings() {
    try {
      //console.log('  💰 Calculating position earnings...');

      const positions = await db.prepare(`
        SELECT * FROM earn_positions WHERE status = 'active'
      `).all();

      if (positions.length === 0) {
        //console.log('  ℹ️  No active positions to update');
        return;
      }

      let updatedCount = 0;

      for (const position of positions) {
        try {
          const earnings = this.calculatePositionEarnings(
            parseFloat(position.amount),
            position.apy_at_start,
            position.last_claim_date || position.start_date
          );

          // Update total earned
          const currentTotal = parseFloat(position.total_earned || 0);
          const newTotal = currentTotal + parseFloat(earnings);

          await db.prepare(`
            UPDATE earn_positions 
            SET total_earned = ?
            WHERE id = ?
          `).run(newTotal.toFixed(6), position.id);

          updatedCount++;
        } catch (err) {
          console.error(`  ⚠️  Failed to update position ${position.id}:`, err.message);
        }
      }

      //console.log(`  ✅ Updated ${updatedCount} positions`);
    } catch (err) {
      console.error('  ❌ Failed to update position earnings:', err.message);
    }
  }

  /**
   * Calculate earnings for a position
   */
  calculatePositionEarnings(principal, apy, startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const daysActive = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));

    if (daysActive === 0) {
      return 0;
    }

    // Calculate compound interest (daily compounding)
    const dailyRate = (apy / 100) / 365;
    const finalAmount = principal * Math.pow(1 + dailyRate, daysActive);
    const earned = finalAmount - principal;

    return earned.toFixed(6);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updateInterval: this.updateInterval,
      updateIntervalMinutes: Math.floor(this.updateInterval / 60000),
      nextUpdate: this.isRunning 
        ? new Date(Date.now() + this.updateInterval).toISOString()
        : null
    };
  }

  /**
   * Force immediate update
   */
  async forceUpdate() {
    //console.log('🔄 Forcing immediate Earn update...');
    await this.runUpdate();
  }
}

module.exports = new EarnSchedulerService();

