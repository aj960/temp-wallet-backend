const express = require('express');
const router = express.Router();

router.use('/wallet', require('./quicknode.wallet.routes'));
router.use('/balance', require('./quicknode.balance.routes'));
router.use('/tx', require('./quicknode.tx.routes'));
router.use('/chain', require('./quicknode.chain.routes'));
router.use('/price', require('./quicknode.price.routes'));
router.use('/validate', require('./quicknode.validate.routes'));
router.use('/health', require('./quicknode.health.routes'));
router.use('/network', require('./quicknode.network.routes'));

module.exports = router;

