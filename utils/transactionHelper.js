const mongoose = require('mongoose');

function canUseTransactions() {
  try {
    const type = mongoose.connection?.client?.topology?.description?.type || '';
    return ['ReplicaSetWithPrimary', 'ReplicaSetNoPrimary', 'Sharded'].includes(type);
  } catch (error) {
    return false;
  }
}

async function runDbTransaction(work) {
  if (!canUseTransactions()) {
    return await work(null);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runDbTransaction, canUseTransactions };
