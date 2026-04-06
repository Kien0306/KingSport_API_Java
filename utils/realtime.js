const clients = new Set();

function registerClient(res) {
  clients.add(res);
  return () => clients.delete(res);
}

function sendEvent(res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (error) {
    clients.delete(res);
  }
}

function broadcast(type, data = {}) {
  const payload = { type, data, ts: Date.now() };
  for (const res of [...clients]) {
    sendEvent(res, payload);
  }
}

function heartbeat() {
  for (const res of [...clients]) {
    try {
      res.write(': ping\n\n');
    } catch (error) {
      clients.delete(res);
    }
  }
}

setInterval(heartbeat, 25000).unref();

module.exports = { registerClient, broadcast };
