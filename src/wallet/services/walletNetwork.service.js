const WalletNetworkModel = require('../models/walletNetwork.model');
const axios = require('axios');

class WalletNetworkService {
  async addWalletNetwork({ wallet_id, address, network }) {
    
    const existing = WalletNetworkModel.findByWallet(wallet_id)
      .find(n => n.network === network && n.address === address);
    if (existing) throw new Error('Network already added for this wallet');

    return WalletNetworkModel.create({ wallet_id, address, network });
  }

  async getNetworkBalance(network, address) {

    try {
      
      const mockBalance = Math.random() * 0.5; 
      return Number(mockBalance.toFixed(6));
    } catch {
      throw new Error(`Failed to fetch balance for ${network}:${address}`);
    }
  }

  async listWalletNetworks(wallet_id) {
    return WalletNetworkModel.findByWallet(wallet_id);
  }
}

module.exports = new WalletNetworkService();
