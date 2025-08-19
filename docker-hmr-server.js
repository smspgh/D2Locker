import chokidar from 'chokidar';
import express from 'express';
import expressStaticGzip from 'express-static-gzip';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Load SSL certificates
let options;

try {
  options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'd2locker_com.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'd2locker_com.pem')),
  };
  console.log('SSL certificates loaded');
} catch (error) {
  console.error('Error loading SSL certificates:', error.message);
  throw new Error('SSL certificates are required');
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
    res.send = function (data) {
      if (typeof data === 'string' && data.includes('</body>')) {
        data = data.replace('</body>', hmrScript + '</body>');
      }
      originalSend.call(this, data);
    };
  }
  next();
});

// Serve static files with gzip support
app.use(
  expressStaticGzip(path.join(__dirname, 'dist'), {
    enableBrotli: true,
    orderPreference: ['br', 'gz'],
    serveStatic: {
      maxAge: '1d',
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    },
  }),
);

// Create HTTPS server
const port = 443;
const server = https.createServer(options, app);

// Create WebSocket server
const wss = new WebSocketServer({ server: server });

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
  persistent: true,
});

watcher.on('change', (filePath) => {
  console.log(`File changed: ${filePath}`);
  // Notify all connected clients
  clients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send('reload');
    }
  });
});

server.listen(port, () => {
  console.log(`HTTPS HMR server with WebSocket running on port ${port}`);
});
