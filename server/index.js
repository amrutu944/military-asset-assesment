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

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
