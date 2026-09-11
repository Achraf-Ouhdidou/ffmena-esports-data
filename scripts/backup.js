require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { backup, DatabaseSync } = require('node:sqlite');

async function run() {
  const sourcePath = path.resolve(process.env.DATABASE_PATH || './data/ffmena.sqlite');
  if (!fs.existsSync(sourcePath)) throw new Error(`Database not found: ${sourcePath}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destinationPath = path.resolve(process.argv[2] || `./backups/ffmena-${timestamp}.sqlite`);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  const database = new DatabaseSync(sourcePath);
  try {
    await backup(database, destinationPath);
  } finally {
    database.close();
  }
  console.log(`Backup created: ${destinationPath}`);
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});