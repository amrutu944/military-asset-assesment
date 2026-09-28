const dotenv = require('dotenv');
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set — using an insecure development secret');
  process.env.JWT_SECRET = 'dev-only-secret-change-me';
}

const app = require('./app');
const connectDB = require('./config/db');
const { seedDemoData } = require('./seed');

const PORT = process.env.PORT || 5000;

(async () => {
  const { inMemory } = await connectDB();

  // An in-memory database starts empty, so always seed it. For a real database
  // seeding is opt-in (SEED_DEMO=true) and only runs while the ledger is empty.
  if (inMemory || process.env.SEED_DEMO === 'true') {
    await seedDemoData();
  }

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  // Behind Render's proxy, Node's default 5s keep-alive lets the proxy reuse a
  // connection Node has just closed, which surfaces as random 502/520 errors.
  // Keep idle connections open longer than the proxy does.
  server.keepAliveTimeout = 120 * 1000;
  server.headersTimeout = 121 * 1000;
})();
