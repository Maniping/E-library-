require("dotenv").config();
const { ensureDatabaseReady } = require("./db");

async function main() {
  const status = await ensureDatabaseReady();
  if (status.ready) {
    console.log(status.message);
    process.exit(0);
  }

  if (!status.configured) {
    console.error(status.message);
    process.exit(1);
  }

  console.error(`Database is not ready: ${status.message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error("Database initialization failed.", error);
  process.exit(1);
});
