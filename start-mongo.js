const { MongoMemoryServer } = require('mongodb-memory-server');

async function start() {
  console.log('🚀 Starting In-Memory MongoDB Server on port 27017...');
  try {
    const mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017
      }
    });
    console.log('✅ In-Memory MongoDB running at mongodb://127.0.0.1:27017');
  } catch (err) {
    console.error('❌ MongoDB launch error:', err.message);
  }
}

start();
