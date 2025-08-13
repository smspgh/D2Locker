import express from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import expressStaticGzip from 'express-static-gzip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Load SSL certificates (only for local development)
let options;
const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_DEPLOYMENT_ID;

if (!isRailway) {
  // Local development - use SSL certificates
  try {
    options = {
      key: fs.readFileSync(path.join(__dirname, 'certs', 'shirezaks_com.key')),
      cert: fs.readFileSync(path.join(__dirname, 'certs', 'shirezaks_com.pem')),
    };
    console.log('SSL certificates loaded for local development');
  } catch (error) {
    console.error('Error loading SSL certificates:', error.message);
    throw new Error('SSL certificates are required for local development');
  }
} else {
  console.log('Running on Railway - using HTTP (Railway provides HTTPS termination)');
}

// Inject HMR client script
const hmrScript = `
<script>
(function() {
  const ws = new WebSocket('wss://' + window.location.hostname + ':443');
  let reconnectInterval;

  function connect() {
    const ws = new WebSocket('wss://' + window.location.hostname + ':443');

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
        }, 1000);
      }
    };

    ws.onerror = (error) => {
      console.error('HMR WebSocket error:', error);
    };

    return ws;
  }

  connect();
})();
</script>
`;

// Middleware to inject HMR script
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    const originalSend = res.send;
    res.send = function(data) {
      if (typeof data === 'string' && data.includes('</body>')) {
        data = data.replace('</body>', hmrScript + '</body>');
      }
      originalSend.call(this, data);
    };
  }
  next();
});

// Serve static files with gzip support
app.use(expressStaticGzip(path.join(__dirname, 'dist'), {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
  serveStatic: {
    maxAge: '1d',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }
}));

// Create server
let server;
const port = process.env.PORT || (isRailway ? 80 : 443);

if (isRailway) {
  // HTTP server for Railway
  server = app;
} else {
  // HTTPS server for local development
  server = https.createServer(options, app);
}

// Create WebSocket server
const wss = new WebSocketServer({ server: isRailway ? undefined : server, port: isRailway ? port : undefined });

// Track connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Watch for file changes
const watcher = chokidar.watch(path.join(__dirname, 'dist'), {
  ignored: /node_modules/,
  persistent: true
});

watcher.on('change', (filePath) => {
  console.log(`File changed: ${filePath}`);
  // Notify all connected clients
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send('reload');
    }
  });
});

if (isRailway) {
  app.listen(port, () => {
    console.log(`HTTP HMR server with WebSocket running on port ${port} (Railway provides HTTPS)`);
  });
} else {
  server.listen(port, () => {
    console.log(`HTTPS HMR server with WebSocket running on port ${port}`);
  });
}