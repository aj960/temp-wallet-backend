/**
 * Complete Transaction Service
 * Handles Send, Receive, Gas estimation, Transaction history
 * 
 * Location: src/services/transaction/transaction.service.js
 */

const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const { getProviderWithFailover } = require('../../config/rpc-providers.config');
const { CHAINS } = require('../../config/chains.config');
// FIX: Import from index file
const { walletRepository, transactionRepository } = require('../../repositories');
const crypto = require('crypto');

class TransactionService {
  /**
   * Get chain information - NEW METHOD for transaction controller
   * @param {string} chainId - Chain identifier
   * @returns {Object} Chain metadata
   */
  async getChainInfo(chainId) {
    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain) {
      throw new Error('Invalid chain');
    }

    return {
      id: chain.id,
      name: chain.name,
      symbol: chain.symbol,
      type: chain.type,
      decimals: chain.decimals || 18,
      explorerUrl: chain.explorerUrl
    };
  }

  /**
   * Get transaction history from blockchain - NEW METHOD
   * @param {string} chainId - Chain identifier
   * @param {string} address - Wallet address
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @returns {Array} Transactions
   */
  async getTransactionHistory(chainId, address, page = 1, pageSize = 20) {
    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain) {
      throw new Error('Invalid chain');
    }

    // Get from local database first
    const localTxs = await transactionRepository.findByWallet(address, {
      chainId,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    // For now, return local transactions
    // In production, this would also fetch from blockchain explorers
    return localTxs.map(tx => ({
      hash: tx.tx_hash,
      from: tx.from_address,
      to: tx.to_address,
      value: tx.amount,
      timestamp: new Date(tx.created_at).getTime() / 1000,
      blockNumber: tx.block_number,
      status: tx.status,
      gasUsed: tx.gas_used,
      gasPrice: tx.gas_price
    }));
  }

  /**
   * Estimate transaction fee - NEW METHOD
   * @param {Object} params - Fee estimation params
   * @returns {Object} Fee estimate
   */
  async estimateFee(params) {
    const { chainId, to, amount, tokenAddress } = params;

    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain) {
      throw new Error('Invalid chain');
    }

    if (chain.type === 'EVM') {
      const provider = await getProviderWithFailover(chainId);
      const gasPrice = await provider.getGasPrice();
      
      let gasLimit = 21000; // Default for native transfers
      
      if (tokenAddress) {
        gasLimit = 65000; // Typical for ERC20 transfers
      }

      const estimatedFee = ethers.utils.formatEther(
        gasPrice.mul(gasLimit)
      );

      return {
        chain: chainId.toUpperCase(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        gasLimit: gasLimit.toString(),
        estimatedFee,
        estimatedFeeUSD: null,
        currency: chain.symbol
      };
    }

    // For non-EVM chains, return default estimates
    return {
      chain: chainId.toUpperCase(),
      estimatedFee: '0.0001',
      currency: chain.symbol
    };
  }

  /**
   * Validate blockchain address - NEW METHOD
   * @param {string} chainId - Chain identifier
   * @param {string} address - Address to validate
   * @returns {Object} Validation result
   */
  async validateAddress(chainId, address) {
    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain) {
      return {
        chainId,
        address,
        isValid: false,
        addressType: null
      };
    }

    let isValid = false;
    let addressType = null;

    try {
      if (chain.type === 'EVM') {
        isValid = ethers.utils.isAddress(address);
        addressType = 'EVM';
      } else if (chain.type === 'UTXO') {
        // Basic Bitcoin address validation
        isValid = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
        addressType = 'UTXO';
      } else if (chain.type === 'SOLANA') {
        // Basic Solana address validation
        isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        addressType = 'SOLANA';
      }
    } catch (error) {
      isValid = false;
    }

    return {
      chainId,
      address,
      isValid,
      addressType
    };
  }

  /**
   * Send native cryptocurrency (ETH, BNB, MATIC, BTC, etc.)
   * @param {Object} params - Transaction parameters
   * @returns {Object} Transaction result with hash
   */
  async sendNative(params) {
    const {
      walletId,
      chainId,
      toAddress,
      amount,
      gasPrice,
      gasLimit,
      devicePasscodeId,
      memo
    } = params;

    try {
      // Verify wallet access
      const credentials = await walletRepository.verifyAndGetCredentials(
        walletId,
        devicePasscodeId
      );

      if (!credentials) {
        throw new Error('Unauthorized access');
      }

      const chain = CHAINS[chainId.toUpperCase()];
      if (!chain) {
        throw new Error('Invalid chain');
      }

      // Get wallet address for this chain
      const wallet = await walletRepository.findById(walletId);
      const network = wallet.networks.find(n => n.network.toUpperCase() === chainId.toUpperCase());
      if (!network) {
        throw new Error('Wallet does not support this chain');
      }

      let txHash, txFee;

      if (chain.type === 'EVM') {
        // EVM chains transaction
        const result = await this.sendEVMNative({
          privateKey: credentials.privateKeys[chainId.toLowerCase()],
          fromAddress: network.address,
          toAddress,
          amount,
          chainId,
          gasPrice,
          gasLimit
        });

        txHash = result.txHash;
        txFee = result.txFee;

      } else if (chain.type === 'UTXO') {
        // Bitcoin-like transaction
        const result = await this.sendBitcoinNative({
          privateKey: credentials.privateKeys[chainId.toLowerCase()],
          fromAddress: network.address,
          toAddress,
          amount,
          chainId
        });

        txHash = result.txHash;
        txFee = result.txFee;

      } else {
        throw new Error('Chain type not supported yet');
      }

      // Record transaction
      const txRecord = await transactionRepository.create({
        id: crypto.randomBytes(16).toString('hex'),
        walletId,
        network: chainId.toUpperCase(),
        txHash,
        fromAddress: network.address,
        toAddress,
        amount: amount.toString(),
        txType: 'send',
        status: 'pending',
        txFee,
        createdAt: new Date().toISOString()
      });

      // Start transaction monitoring
      this.monitorTransaction(txRecord.id, txHash, chainId);

      return {
        success: true,
        txHash,
        txId: txRecord.id,
        fromAddress: network.address,
        toAddress,
        amount: amount.toString(),
        chainId,
        txFee,
        status: 'pending',
        message: 'Transaction submitted successfully',
        explorerUrl: `${chain.explorerUrl}/tx/${txHash}`
      };

    } catch (error) {
      throw new Error(`Send failed: ${error.message}`);
    }
  }

  /**
   * Send EVM native token (ETH, BNB, MATIC, etc.)
   */
  async sendEVMNative(params) {
    const { privateKey, fromAddress, toAddress, amount, chainId, gasPrice, gasLimit } = params;

    const provider = await getProviderWithFailover(chainId);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Validate addresses
    if (!ethers.utils.isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    // Get current gas price if not provided
    const currentGasPrice = gasPrice 
      ? ethers.utils.parseUnits(gasPrice.toString(), 'gwei')
      : await provider.getGasPrice();

    // Parse amount
    const amountWei = ethers.utils.parseEther(amount.toString());

    // Check balance
    const balance = await provider.getBalance(fromAddress);
    if (balance.lt(amountWei)) {
      throw new Error('Insufficient balance');
    }

    // Estimate gas if not provided
    let estimatedGas = gasLimit;
    if (!estimatedGas) {
      estimatedGas = await provider.estimateGas({
        from: fromAddress,
        to: toAddress,
        value: amountWei
      });
    }

    // Calculate total cost
    const totalCost = amountWei.add(currentGasPrice.mul(estimatedGas));
    if (balance.lt(totalCost)) {
      throw new Error('Insufficient balance for amount + gas');
    }

    // Send transaction
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei,
      gasPrice: currentGasPrice,
      gasLimit: estimatedGas
    });

    const txFee = ethers.utils.formatEther(currentGasPrice.mul(estimatedGas));

    return {
      txHash: tx.hash,
      txFee,
      nonce: tx.nonce
    };
  }

  /**
   * Send Bitcoin native transaction
   */
  async sendBitcoinNative(params) {
    const { privateKey, fromAddress, toAddress, amount, chainId } = params;

    // Bitcoin transaction implementation
    // This is a simplified version - production would need UTXO management
    const network = chainId.toLowerCase() === 'bitcoin' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;

    // Get UTXOs from address
    const utxos = await this.getBitcoinUTXOs(fromAddress, chainId);
    
    if (utxos.length === 0) {
      throw new Error('No unspent outputs found');
    }

    // Calculate required amount with fee
    const satoshiAmount = Math.floor(amount * 100000000);
    const feeRate = 10; // sats per byte
    const estimatedSize = 250; // typical tx size
    const fee = feeRate * estimatedSize;

    // Build transaction
    const psbt = new bitcoin.Psbt({ network });
    let inputSum = 0;

    // Add inputs
    for (const utxo of utxos) {
      if (inputSum >= satoshiAmount + fee) break;
      
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPubKey, 'hex'),
          value: utxo.value
        }
      });
      
      inputSum += utxo.value;
    }

    if (inputSum < satoshiAmount + fee) {
      throw new Error('Insufficient balance');
    }

    // Add output
    psbt.addOutput({
      address: toAddress,
      value: satoshiAmount
    });

    // Add change output if needed
    const change = inputSum - satoshiAmount - fee;
    if (change > 546) { // dust limit
      psbt.addOutput({
        address: fromAddress,
        value: change
      });
    }

    // Sign
    const keyPair = bitcoin.ECPair.fromPrivateKey(
      Buffer.from(privateKey, 'hex'),
      { network }
    );
    
    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();

    // Broadcast
    const txHex = psbt.extractTransaction().toHex();
    const txHash = await this.broadcastBitcoinTx(txHex, chainId);

    return {
      txHash,
      txFee: (fee / 100000000).toFixed(8)
    };
  }

  /**
   * Send ERC-20/BEP-20 tokens
   * @param {Object} params - Token transfer parameters
   * @returns {Object} Transaction result
   */
  async sendToken(params) {
    const {
      walletId,
      chainId,
      tokenAddress,
      toAddress,
      amount,
      decimals,
      devicePasscodeId,
      gasPrice,
      gasLimit,
      memo
    } = params;

    try {
      // Verify wallet access
      const credentials = await walletRepository.verifyAndGetCredentials(
        walletId,
        devicePasscodeId
      );

      if (!credentials) {
        throw new Error('Unauthorized access');
      }

      const chain = CHAINS[chainId.toUpperCase()];
      if (!chain || chain.type !== 'EVM') {
        throw new Error('Token transfers only supported on EVM chains');
      }

      // Get wallet network
      const wallet = await walletRepository.findById(walletId);
      const network = wallet.networks.find(n => n.network.toUpperCase() === chainId.toUpperCase());
      if (!network) {
        throw new Error('Wallet does not support this chain');
      }

      // Execute token transfer
      const provider = await getProviderWithFailover(chainId);
      const signer = new ethers.Wallet(credentials.privateKeys[chainId.toLowerCase()], provider);

      // ERC20 ABI
      const erc20ABI = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);

      // Get token info
      const tokenDecimals = decimals || await tokenContract.decimals();
      const tokenSymbol = await tokenContract.symbol();

      // Check token balance
      const balance = await tokenContract.balanceOf(network.address);
      const amountInUnits = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

      if (balance.lt(amountInUnits)) {
        throw new Error('Insufficient token balance');
      }

      // Estimate gas
      const currentGasPrice = gasPrice 
        ? ethers.utils.parseUnits(gasPrice.toString(), 'gwei')
        : await provider.getGasPrice();

      const estimatedGas = gasLimit || await tokenContract.estimateGas.transfer(
        toAddress,
        amountInUnits
      );

      // Check native token for gas
      const nativeBalance = await provider.getBalance(network.address);
      const gasCost = currentGasPrice.mul(estimatedGas);

      if (nativeBalance.lt(gasCost)) {
        throw new Error(`Insufficient ${chain.symbol} for gas fees`);
      }

      // Send transaction
      const tx = await tokenContract.transfer(toAddress, amountInUnits, {
        gasPrice: currentGasPrice,
        gasLimit: estimatedGas
      });

      const txFee = ethers.utils.formatEther(gasCost);

      // Record transaction
      const txRecord = await transactionRepository.create({
        id: crypto.randomBytes(16).toString('hex'),
        walletId,
        network: chainId.toUpperCase(),
        txHash: tx.hash,
        fromAddress: network.address,
        toAddress,
        amount: amount.toString(),
        tokenAddress,
        tokenSymbol,
        txType: 'send_token',
        status: 'pending',
        txFee,
        createdAt: new Date().toISOString()
      });

      // Monitor transaction
      this.monitorTransaction(txRecord.id, tx.hash, chainId);

      return {
        success: true,
        txHash: tx.hash,
        txId: txRecord.id,
        fromAddress: network.address,
        toAddress,
        amount: amount.toString(),
        tokenAddress,
        tokenSymbol,
        chainId,
        txFee,
        status: 'pending',
        message: 'Token transfer submitted successfully',
        explorerUrl: `${chain.explorerUrl}/tx/${tx.hash}`
      };

    } catch (error) {
      throw new Error(`Token send failed: ${error.message}`);
    }
  }

  /**
   * Estimate gas for a transaction
   * @param {Object} params - Transaction parameters
   * @returns {Object} Gas estimation
   */
  async estimateGas(params) {
    const { chainId, fromAddress, toAddress, amount, tokenAddress } = params;

    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain || chain.type !== 'EVM') {
      throw new Error('Gas estimation only for EVM chains');
    }

    const provider = await getProviderWithFailover(chainId);

    try {
      let gasEstimate, gasPrice;

      if (tokenAddress) {
        // Token transfer estimation
        const erc20ABI = ['function transfer(address to, uint256 amount)'];
        const iface = new ethers.utils.Interface(erc20ABI);
        const data = iface.encodeFunctionData('transfer', [
          toAddress,
          ethers.utils.parseEther(amount.toString())
        ]);

        gasEstimate = await provider.estimateGas({
          from: fromAddress,
          to: tokenAddress,
          data
        });
      } else {
        // Native token transfer
        gasEstimate = await provider.estimateGas({
          from: fromAddress,
          to: toAddress,
          value: ethers.utils.parseEther(amount.toString())
        });
      }

      gasPrice = await provider.getGasPrice();
      const gasCost = gasPrice.mul(gasEstimate);

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        gasPriceWei: gasPrice.toString(),
        estimatedFee: ethers.utils.formatEther(gasCost),
        estimatedFeeUSD: 0, // Would integrate with price feed
        chainId,
        currency: chain.symbol
      };

    } catch (error) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }

  /**
   * Get transaction details
   * @param {string} txHash - Transaction hash
   * @param {string} chainId - Chain ID
   * @returns {Object} Transaction details
   */
  async getTransactionDetails(txHash, chainId) {
    const chain = CHAINS[chainId.toUpperCase()];
    if (!chain) {
      throw new Error('Invalid chain');
    }

    if (chain.type === 'EVM') {
      const provider = await getProviderWithFailover(chainId);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!tx) {
        throw new Error('Transaction not found');
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.utils.formatEther(tx.value),
        gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
        gasLimit: tx.gasLimit.toString(),
        nonce: tx.nonce,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        timestamp: receipt?.timestamp,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        confirmations: receipt ? receipt.confirmations : 0,
        gasUsed: receipt?.gasUsed.toString(),
        effectiveGasPrice: receipt?.effectiveGasPrice 
          ? ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei')
          : null,
        chainId,
        explorerUrl: `${chain.explorerUrl}/tx/${txHash}`
      };
    }

    throw new Error('Transaction lookup not supported for this chain type');
  }

  /**
   * Monitor transaction status
   * @param {string} txId - Internal transaction ID
   * @param {string} txHash - Blockchain transaction hash
   * @param {string} chainId - Chain ID
   */
  async monitorTransaction(txId, txHash, chainId) {
    const chain = CHAINS[chainId.toUpperCase()];
    if (chain.type !== 'EVM') return;

    try {
      const provider = await getProviderWithFailover(chainId);
      
      // Wait for transaction to be mined
      const receipt = await provider.waitForTransaction(txHash, 1);

      // Update transaction status
      await transactionRepository.update(txId, {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Transaction monitoring failed for ${txHash}:`, error.message);
      await transactionRepository.update(txId, {
        status: 'failed'
      });
    }
  }

  /**
   * Get Bitcoin UTXOs (placeholder - would integrate with API)
   */
  async getBitcoinUTXOs(address, chainId) {
    // This would call Blockstream API or similar
    // Placeholder implementation
    return [];
  }

  /**
   * Broadcast Bitcoin transaction (placeholder)
   */
  async broadcastBitcoinTx(txHex, chainId) {
    // This would call Blockstream API or similar
    // Placeholder implementation
    return 'placeholder_txid';
  }
}

module.exports = new TransactionService();



