// File: db.js

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./licenses.db');

db.serialize(() => {

  // Create licenses table
  db.run(`CREATE TABLE IF NOT EXISTS licenses (
    token TEXT PRIMARY KEY,
    maxProxies INTEGER,
    hwid TEXT
  )`);

  // Create proxies table with IP, port, user/pass and assignment
  db.run(`CREATE TABLE IF NOT EXISTS proxies (
    proxy TEXT PRIMARY KEY,
    ip TEXT,
    port INTEGER,
    username TEXT,
    password TEXT,
    assignedToken TEXT
  )`);
});

module.exports = db;
