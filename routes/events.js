var express = require('express');
var router = express.Router();
const { registerClient } = require('../utils/realtime');

router.get('/stream', function(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write('retry: 2000\n\n');
  const unregister = registerClient(res);
  req.on('close', () => unregister());
});

module.exports = router;
