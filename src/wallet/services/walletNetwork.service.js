const WalletNetworkModel = require('../models/walletNetwork.model');
const axios = require('axios');

class WalletNetworkService {
  async addWalletNetwork({ wallet_id, address, network }) {
    
    const networks = await WalletNetworkModel.findByWallet(wallet_id);
    const existing = networks.find(n => n.network === network && n.address === address);
    if (existing) throw new Error('Network already added for this wallet');

    return await WalletNetworkModel.create({ wallet_id, address, network });
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
    return await WalletNetworkModel.findByWallet(wallet_id);
  }
}

module.exports = new WalletNetworkService();
