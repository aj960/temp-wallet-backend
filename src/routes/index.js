const express = require('express');
const router = express.Router();

const adminRoutes = require('./admin.routes');
const devicePasscodes = require('./devicePasscodes.routes');

router.get('/', (req, res) => res.send('TwwWin Wallet Backend running!'));

router.use('/admin', adminRoutes);
router.use('/device-passcodes', devicePasscodes);

module.exports = router;
