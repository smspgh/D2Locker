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

// Load SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'shirezaks_com.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'shirezaks_com.pem')),
};

// Inject HMR client script
const hmrScript = `
<script>
(function() {
  const ws = new WebSocket('wss://shirezaks.com:443');
  let reconnectInterval;

  function connect() {
    const ws = new WebSocket('wss://shirezaks.com:443');

    ws.onopen = () => {
      console.log('HMR Connected');
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
      console.log('HMR Disconnected');
      // Try to reconnect every 2 seconds
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          connect();
        }, 2000);
      }
    };
  }

  connect();
})();
</script>
`;

// Add debug logging for all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Manual proxy for API requests
app.use('/api', (req, res) => {
  console.log(`Manual proxy handling: ${req.method} ${req.originalUrl}`);

  const targetUrl = `https://localhost:8443${req.originalUrl}`;
  console.log(`Forwarding to: ${targetUrl}`);

  const url = new URL(targetUrl);

  const proxyOptions = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers },
    rejectUnauthorized: false // Accept self-signed certificates
  };

  delete proxyOptions.headers.host; // Remove host header

  const proxyReq = https.request(proxyOptions, (proxyRes) => {
    console.log(`Backend response: ${proxyRes.statusCode} for ${req.originalUrl}`);

    // Copy response headers
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    res.status(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Manual proxy error:', error.message);
    if (!res.headersSent) {
      res.status(500).send('Proxy error: ' + error.message);
    }
  });

  // Forward request body for POST/PUT requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Serve static files from dist with compression support (only for non-API requests)
app.use(expressStaticGzip(path.join(__dirname, 'dist'), {
  enableBrotli: true,
  orderPreference: ['br'],
  customCompressions: [{
    encodingName: 'br',
    fileExtension: 'br'
  }],
  setHeaders: (res, reqPath) => {
    // Set cache headers for the large JSON file
    if (reqPath.includes('rollAppraiserData.json')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      console.log(`📦 HMR Serving ${reqPath} - Content-Encoding: ${res.getHeader('Content-Encoding') || 'none'}`);
    }
  }
}));

// Handle client-side routing - serve index.html with HMR script injected
app.use((req, res, next) => {
  // Skip if it's an API route (already handled by proxy)
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Skip if it's a static file (has extension)
  if (req.path.includes('.')) {
    return next();
  }

  // Read index.html and inject HMR script
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Inject HMR script before closing body tag
  html = html.replace('</body>', `${hmrScript}</body>`);

  res.send(html);
});

const server = https.createServer(options, app);

server.listen(443, () => {
  console.log('HTTPS Server with Simple HMR running on https://shirezaks.com:443');
  console.log('Proxying /api requests to https://localhost:8443');
  console.log('Watching dist/ directory for changes...');
});

// Create WebSocket server for HMR
const wss = new WebSocketServer({
  server: server
});

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('HMR client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('HMR client disconnected');
  });
});

// Watch dist directory for changes
const watcher = chokidar.watch(path.join(__dirname, 'dist'), {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', (filepath) => {
  console.log(`File changed: ${filepath}`);
  // Send reload message to all connected clients
  clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send('reload');
    }
  });
});

console.log('Simple HMR enabled - the page will auto-reload when files in dist/ change');
console.log('Run "pnpm build:light:watch" in another terminal to rebuild on file changes');