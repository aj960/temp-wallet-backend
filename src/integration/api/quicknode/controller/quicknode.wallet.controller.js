const { ethers } = require('ethers');
const { success, failure, error } = require('../../../../utils/response');

async function generateMnemonic(req, res) {
  try {
    const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
    return success(res, { mnemonic });
  } catch (err) {
    return failure(res, 'Failed to generate mnemonic', err);
  }
}

async function validateMnemonic(req, res) {
  const { mnemonic } = req.body;
  if (!mnemonic) return error(res, 'Mnemonic is required');
  try {
    const valid = ethers.utils.isValidMnemonic(mnemonic);
    return success(res, { valid });
  } catch (err) {
    return failure(res, 'Invalid mnemonic', err);
  }
}

// 3️⃣ Create wallet
async function createWallet(req, res) {
  const { mnemonic } = req.body;
  if (!mnemonic) return error(res, 'Mnemonic is required');
  try {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    return success(res, {
      address: wallet.address,
      privateKey: wallet.privateKey
    });
  } catch (err) {
    return failure(res, 'Failed to create wallet', err);
  }
}

// 4️⃣ Derive child wallet
async function deriveWallet(req, res) {
  const { mnemonic, derivationPath } = req.body;
  try {
    const path = derivationPath || "m/44'/60'/0'/0/0";
    const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
    return success(res, { address: wallet.address });
  } catch (err) {
    return failure(res, 'Failed to derive wallet', err);
  }
}

// 5️⃣ Recover wallet
async function recoverWallet(req, res) {
  const { mnemonic } = req.body;
  try {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    return success(res, { address: wallet.address });
  } catch (err) {
    return failure(res, 'Failed to recover wallet', err);
  }
}

module.exports = {
  generateMnemonic,
  validateMnemonic,
  createWallet,
  deriveWallet,
  recoverWallet
};
