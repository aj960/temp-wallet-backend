const quickNodeRoutes = require('./routes/quicknode.routes');

function registerQuickNode(app) {
  app.use('/quicknode', quickNodeRoutes);
  //console.log('✅ QuickNode routes registered at /quicknode');
}

module.exports = registerQuickNode;

