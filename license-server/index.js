// server.js

require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Middleware to authenticate admin using Basic Auth
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return next(); // Authenticated
  }

  return res.status(403).send('Forbidden');
}

// Create new token (protected)
app.post('/add-token', authenticateAdmin, (req, res) => {
  const { token, maxProxies } = req.body;
  db.run(
    "INSERT INTO licenses (token, maxProxies, hwid) VALUES (?, ?, ?)",
    [token, maxProxies, null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, token });
    }
  );
  console.log(`Added the token ${token} with proxies ${maxProxies}`);
});

// Validate token & bind HWID
app.post('/validate-token', (req, res) => {
  const { token, hwid } = req.body;

  db.get("SELECT * FROM licenses WHERE token = ?", [token], (err, row) => {
    if (err || !row) {
      return res.status(403).json({ valid: false });
    }

    if (row.hwid) {
      if (row.hwid !== hwid) {
        return res.status(403).json({ valid: false });
      } else {
        return res.json({ valid: true, maxProxies: row.maxProxies });
      }
    } else {
      db.run("UPDATE licenses SET hwid = ? WHERE token = ?", [hwid, token], (updateErr) => {
        if (updateErr) return res.status(500).json({ valid: false });
        return res.json({ valid: true, maxProxies: row.maxProxies });
      });
    }
  });
});

// Revoke token (protected)
app.post('/revoke-token', authenticateAdmin, (req, res) => {
  const { token } = req.body;
  db.run("DELETE FROM licenses WHERE token = ?", [token], (err) => {
    if (err) return res.status(500).json({ error: err.message });
  });
    db.run("DELETE FROM proxies WHERE assignedToken = ?", [token], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ revoked: true });
  });
  console.log(`Removed the token ${token}`);
});

// ALLOCATE PROXIES
app.post('/allocate-proxies', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "Token required" });

  db.get("SELECT * FROM licenses WHERE token = ?", [token], (err, licenseRow) => {
    if (err) return res.status(500).json({ success: false, message: "DB error 1" });
    if (!licenseRow) return res.status(404).json({ success: false, message: "Invalid token" });

    const maxProxies = licenseRow.maxProxies;

    db.all("SELECT * FROM proxies WHERE assignedToken = ?", [token], (err, assignedRows) => {
      if (err) return res.status(500).json({ success: false, message: "DB error 2" });

      if (assignedRows.length > 0) {
        return res.json({
          success: true,
          proxies: assignedRows.map(row => row.proxy)
        });
      }

      db.all("SELECT * FROM proxies WHERE assignedToken IS NULL LIMIT ?", [maxProxies], (err, availableRows) => {
        if (err) return res.status(500).json({ success: false, message: "DB error 3" });

        if (availableRows.length < maxProxies) {
          return res.status(400).json({
            success: false,
            message: "Not enough unassigned proxies available"
          });
        }

        const assignTasks = availableRows.map(proxy => {
          return new Promise((resolve, reject) => {
            db.run("UPDATE proxies SET assignedToken = ? WHERE proxy = ?", [token, proxy.proxy], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });

        Promise.all(assignTasks)
          .then(() => {
            res.json({
              success: true,
              proxies: availableRows.map(row => row.proxy)
            });
          })
          .catch(() => {
            res.status(500).json({ success: false, message: "Failed to assign proxies" });
          });
      });
    });
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`License server running on port ${PORT}`));
