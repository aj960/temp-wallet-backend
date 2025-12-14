const walletNetworkService = require('../services/walletNetwork.service');
const { success, error } = require('../../utils/response');

exports.addWalletNetwork = async (req, res) => {
  try {
    const { walletId, address, network } = req.body;

    if (!walletId || !address || !network) {
      return error(res, 'walletId, network, and address are required');
    }

    const networkEntry = await walletNetworkService.addWalletNetwork({
      wallet_id: walletId,
      address,
      network
    });

    success(res, networkEntry);
  } catch (e) {
    error(res, e.message);
  }
};

exports.getNetworkBalance = async (req, res) => {
  try {
    const { network, address } = req.params;
    const balance = await walletNetworkService.getNetworkBalance(network, address);
    success(res, { network, address, balance });
  } catch (e) {
    error(res, e.message);
  }
};

exports.listWalletNetworks = async (req, res) => {
  try {
    const { walletId } = req.params;
    const networks = await walletNetworkService.listWalletNetworks(walletId);
    success(res, networks);
  } catch (e) {
    error(res, e.message);
  }
};


