const mongoose = require('mongoose');

let memoryServer = null;

// Connects to MONGO_URI. When it is not set (or USE_MEMORY_DB=true) an embedded,
// in-memory MongoDB is started instead — handy for local demos and reviewers
// who want to run the project without provisioning a database.
const connectDB = async () => {
  let uri = process.env.MONGO_URI;
  let inMemory = false;

  if (!uri || process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server-core');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('milasset');
    inMemory = true;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${inMemory ? 'in-memory instance' : conn.connection.host}`);
    return { inMemory };
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
