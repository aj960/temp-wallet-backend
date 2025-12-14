const zeroXRoutes = require('./routes/zeroX.routes');

function registerZeroX(app) {
  app.use('/0x', zeroXRoutes);
  //console.log('0x routes registered at /0x');
}

module.exports = registerZeroX;
