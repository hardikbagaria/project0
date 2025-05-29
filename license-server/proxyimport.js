const fs = require('fs');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('licenses.db');


// Create table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS proxies (
    proxy TEXT,
    ip TEXT,
    port TEXT,
    username TEXT,
    password TEXT,
    assignedToken TEXT
  )`);
});

async function importProxies() {
  const fileStream = fs.createReadStream('proxies.txt');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const insertStmt = db.prepare(`INSERT INTO proxies (proxy, ip, port, username, password, assignedToken) VALUES (?, ?, ?, ?, ?, ?)`);

  for await (const line of rl) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Expected format: ip:port:username:password
    const parts = line.trim().split(':');
    if (parts.length !== 4) {
      console.error(`Invalid proxy format: ${line}`);
      continue;
    }

    const [ip, port, username, password] = parts;
    const proxy = line.trim();
    const assignedToken = '';

    insertStmt.run(proxy, ip, port, username, password, assignedToken, (err) => {
      if (err) {
        console.error(`Failed to insert proxy: ${proxy}`, err.message);
      } else {
        console.log(`Inserted proxy: ${proxy}`);
      }
    });
  }

  insertStmt.finalize(() => {
    console.log('All proxies processed.');
    db.close();
  });
}

importProxies().catch(console.error);
