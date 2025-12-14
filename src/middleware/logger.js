const util = require('util');

module.exports = (req, res, next) => {
  const startTime = Date.now();

  //console.log('======================');
  //console.log(`➡️ Incoming Request: ${req.method} ${req.originalUrl}`);
  //console.log('📦 Body:', util.inspect(req.body, { depth: null, colors: true }));

  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = res.statusCode; 

  res.status = function (code) {
    statusCode = code;
    return originalStatus(code);
  };

  res.send = function (body) {
    const duration = Date.now() - startTime;
    //console.log(`⬅️ Response Status: ${statusCode}`);
    //console.log('⬅️ Response Body:', util.inspect(body, { depth: null, colors: true }));
    //console.log(`⏱️ Duration: ${duration}ms`);
    //console.log('======================\n');

    return originalSend(body);
  };

  res.json = function (body) {
    const duration = Date.now() - startTime;
    //console.log(`⬅️ Response Status: ${statusCode}`);
    //console.log('⬅️ JSON Body:', util.inspect(body, { depth: null, colors: true }));
    //console.log(`⏱️ Duration: ${duration}ms`);
    //console.log('======================\n');

    return originalJson(body);
  };

  next();
};
