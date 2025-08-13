import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import expressStaticGzip from 'express-static-gzip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT;

if (!port) {
  console.error('ERROR: PORT environment variable not set by Railway');
  process.exit(1);
}

console.log('Running unified server for Railway deployment');

// Manual CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://www.shirezaks.com', 
    'https://www.shirezaks.com:443', 
    'https://localhost:443', 
    'https://localhost'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-D2L-Version');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Middleware to parse JSON bodies (Express 5 built-in)
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Note: Database functionality is handled by the backend service in production
console.log('Frontend-only server - API requests will be proxied to backend service');

// Simple API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), note: 'Frontend server' });
});

// Handle all other API requests
app.all('/api/*', (req, res) => {
  res.status(503).json({ 
    error: 'API not available in frontend-only mode',
    message: 'Please configure a separate backend service for API endpoints',
    path: req.path
  });
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
    process.exit(0);
  });
});