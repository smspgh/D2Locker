import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');

console.log('=== PRODUCTION SERVER STARTING ===');
console.log('PORT:', port);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME);
console.log('Current directory:', __dirname);
console.log('Dist path:', distPath);
console.log('Dist exists:', fs.existsSync(distPath));

if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log('Files in dist:', files.slice(0, 10).join(', '), files.length > 10 ? '...' : '');
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  // Handle health checks immediately
  if (req.url === '/health' || req.url === '/.well-known/health') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      port: port,
      uptime: process.uptime()
    }));
    return;
  }

  // Proxy API requests to backend
  if (req.url.startsWith('/api/')) {
    const backendUrl = `http://localhost:3000${req.url}`;
    console.log(`Proxying ${req.method} ${req.url} to ${backendUrl}`);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: 'localhost:3000'
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend service unavailable' }));
    });

    req.pipe(proxyReq);
    return;
  }

  // Handle static files
  let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);
  
  // For SPA routing, serve index.html for any route that doesn't have a file extension
  if (!path.extname(filePath) && req.url !== '/') {
    filePath = path.join(distPath, 'index.html');
  }

  // Security: prevent directory traversal
  if (!filePath.startsWith(distPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found, serve index.html for SPA
        const indexPath = path.join(distPath, 'index.html');
        fs.readFile(indexPath, (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server error: ${err.code}`);
      }
    } else {
      // Success
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`=== PRODUCTION SERVER STARTED ===`);
  console.log(`Listening on 0.0.0.0:${port}`);
  console.log('Serving files from:', distPath);
  console.log('Ready to handle requests');
  
  // Log every 30 seconds to show server is still alive
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Server still running on port ${port}`);
  }, 30000);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

// Handle other termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

// Log that we're ready for Railway
console.log('=== SERVER INITIALIZATION COMPLETE ===');
console.log(`Server process is ready on port ${port}`);