require("dotenv").config();
const { pool, query } = require("./db");

async function main() {
  if (!pool) {
    console.error("DATABASE_URL is not configured.");
    process.exitCode = 1;
    return;
  }

  try {
    await query("SELECT 1");
    console.log("Database connection is healthy.");
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Database check failed: ${error.message}`);
  process.exitCode = 1;
});
