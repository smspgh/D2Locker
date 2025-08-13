import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import expressStaticGzip from 'express-static-gzip';
import cors from 'cors';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT;

if (!port) {
  console.error('ERROR: PORT environment variable not set by Railway');
  process.exit(1);
}

console.log('Running unified server for Railway deployment');

// Configure CORS
app.use(cors({
  origin: ['https://www.shirezaks.com', 'https://www.shirezaks.com:443', 'https://localhost:443', 'https://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-D2L-Version'],
}));

// Middleware to parse JSON bodies (Express 5 built-in)
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize SQLite Database
let db;
try {
  db = new Database('d2l.db');
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      membershipId TEXT PRIMARY KEY,
      destinyVersion INTEGER,
      settings TEXT,
      loadouts TEXT,
      tags TEXT,
      triumphs TEXT,
      updates TEXT,
      createdAt INTEGER,
      lastUpdatedAt INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS api_keys (
      apiKey TEXT PRIMARY KEY,
      appName TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS loadout_shares (
      shareId TEXT PRIMARY KEY,
      loadoutData TEXT,
      notes TEXT,
      createdAt INTEGER
    );
  `);
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Database initialization error:', error);
  process.exit(1);
}

// Insert API key
try {
  const API_KEY = '788600d2-9320-484e-86dd-5f5c9c458b66';
  const APP_NAME = 'd2locker-dev';
  const stmt = db.prepare('INSERT OR IGNORE INTO api_keys (apiKey, appName, createdAt) VALUES (?, ?, ?)');
  const info = stmt.run(API_KEY, APP_NAME, Date.now());
  if (info.changes > 0) {
    console.log(`API key "${API_KEY}" for app "${APP_NAME}" inserted successfully.`);
  }
} catch (error) {
  console.error('Error inserting API key:', error.message);
}

// API Routes (from backend/server.js)
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sync endpoint
app.post('/api/profile_sync/:platformType/:membershipId', (req, res) => {
  const { platformType, membershipId } = req.params;
  const { settings, loadouts, tags, triumphs, updates } = req.body;

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO users (membershipId, destinyVersion, settings, loadouts, tags, triumphs, updates, lastUpdatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      membershipId,
      2,
      JSON.stringify(settings || {}),
      JSON.stringify(loadouts || []),
      JSON.stringify(tags || {}),
      JSON.stringify(triumphs || {}),
      JSON.stringify(updates || {}),
      Date.now()
    );

    res.json({ success: true, message: 'Profile synced successfully' });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to sync profile' });
  }
});

// Get profile endpoint
app.get('/api/profile/:platformType/:membershipId', (req, res) => {
  const { membershipId } = req.params;

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE membershipId = ?');
    const user = stmt.get(membershipId);

    if (user) {
      res.json({
        settings: JSON.parse(user.settings || '{}'),
        loadouts: JSON.parse(user.loadouts || '[]'),
        tags: JSON.parse(user.tags || '{}'),
        triumphs: JSON.parse(user.triumphs || '{}'),
        updates: JSON.parse(user.updates || '{}')
      });
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve profile' });
  }
});

// HMR client script injection
const hmrScript = `
<script>
(function() {
  const ws = new WebSocket('wss://www.shirezaks.com');
  let reconnectInterval;

  function connect() {
    const ws = new WebSocket('wss://www.shirezaks.com');

    ws.onopen = () => {
      console.log('HMR WebSocket connected');
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    };

    ws.onmessage = (event) => {
      if (event.data === 'reload') {
        console.log('HMR: Reloading page...');
        window.location.reload();
      }
    };

    ws.onclose = () => {
      console.log('HMR WebSocket disconnected');
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log('HMR: Attempting to reconnect...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('HMR WebSocket error:', error);
    };
  }

  connect();
})();
</script>
`;

// Serve static files from dist with HMR injection
app.use(expressStaticGzip(path.join(__dirname, 'dist'), {
  enableBrotli: true,
  customCompressions: [{
    encodingName: 'gzip',
    fileExtension: 'gz'
  }],
  orderPreference: ['br', 'gzip']
}));

// Catch-all handler for SPA routing with HMR
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'dist', 'index.html');
  
  if (fs.existsSync(filePath)) {
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Inject HMR script before closing body tag
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${hmrScript}</body>`);
    } else if (html.includes('</html>')) {
      html = html.replace('</html>', `${hmrScript}</html>`);
    } else {
      html += hmrScript;
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } else {
    res.status(404).send('Application not found - please check if the build completed successfully');
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for HMR
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('HMR client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('HMR client disconnected');
  });
});

// Watch dist directory for changes (only if it exists)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Setting up file watcher for HMR...');
  const watcher = chokidar.watch(distPath, {
    ignored: /(^|[\/\\])\../, 
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', (filepath) => {
    console.log(`File changed: ${filepath}`);
    clients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send('reload');
      }
    });
  });

  watcher.on('error', error => {
    console.error('File watcher error:', error);
  });
} else {
  console.log('Dist directory not found - HMR disabled until build completes');
}

// Start server
server.listen(port, () => {
  console.log(`Unified HTTP server running on port ${port} (Railway provides HTTPS)`);
  console.log('Serving API endpoints and static files with HMR support');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});