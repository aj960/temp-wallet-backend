exports.getBalance = async (coin, address) => {
  return { coin, balance: '0.0000', note: 'BTC RPC not yet implemented' };
};

exports.broadcastTx = async (coin, rawTx) => {
  return { txHash: 'BTC_TX_HASH_PLACEHOLDER' };
};
