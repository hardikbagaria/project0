import express from "express";
import session from "express-session";
import path, { join, dirname } from "path";
import { fileURLToPath } from "url";
import { validateToken } from "./verifier.js";
import axios from "axios";
import { startSingleBot } from './bot.js';  // ✅ Import your bot function

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 8000;

app.use(express.json());
app.use(session({
    secret: 'hardik-secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.use(express.static(join(__dirname, "public")));

app.post("/verify", async (req, res) => {
    const { token } = req.body;
    const proxyCount = await validateToken(token);

    if (proxyCount > 0) {
        req.session.isAuthenticated = true;
        req.session.proxyCount = proxyCount;
        req.session.token = token;
        console.log("Session saved with proxyCount:", proxyCount);
        return res.json({ status: "success" });
    } else {
        return res.status(401).json({ status: "denied" });
    }
});

app.get("/success", (req, res) => {
    if (req.session.isAuthenticated) {
        res.sendFile(join(__dirname, "protected/success.html"));
    } else {
        res.status(403).send("Access Denied");
    }
});

app.get("/api/session-info", (req, res) => {
    if (req.session.isAuthenticated) {
        res.json({ proxyCount: req.session.proxyCount });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

app.get('/api/get-proxies', async (req, res) => {
    const token = req.session.token;
    if (!token) return res.status(401).json({ success: false, message: "Token missing from session" });

    try {
        const response = await axios.post('http://localhost:3000/allocate-proxies', { token });
        return res.json(response.data);
    } catch (err) {
        console.error("Error calling /allocate-proxies:", err.message);
        const errorMessage = err.response?.data?.message || 'Unknown error';
        return res.status(500).json({ success: false, message: errorMessage });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// === New endpoint to start a single bot ===
app.post('/api/start-single-bot', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const botConfig = req.body;

  try {
    startSingleBot(botConfig);
    return res.json({ status: 'bot started', bot: botConfig });
  } catch (error) {
    console.error('Error starting bot:', error);
    return res.status(500).json({ error: 'Failed to start bot' });
  }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
