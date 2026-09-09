require("dotenv").config();

const app = require("./src/app");
const config = require("./src/config");
const db = require("./db/knex");

const PORT = config.port;

async function start() {
  try {
    // Test database connection
    await db.raw("SELECT 1");
    console.log("[db] Database connection established.");
  } catch (err) {
    console.error("[db] Database connection failed:", err.message);
    console.warn(
      "[db] Continuing without database — run migrations before using the API.",
    );
  }

  app.listen(PORT, () => {
    console.log(`\n🌿 Gopax Backend`);
    console.log(`   Running on: http://localhost:${PORT}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Health check: http://localhost:${PORT}/health\n`);
  });
}

start();
