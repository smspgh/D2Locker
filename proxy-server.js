import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Load SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'shirezaks_com.key')),
  cert: fs.readFileSync(path.join(__dirname, 'shirezaks_com.pem')),
};

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
  
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers },
    rejectUnauthorized: false // Accept self-signed certificates
  };
  
  delete options.headers.host; // Remove host header
  
  const proxyReq = https.request(options, (proxyRes) => {
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

// Serve static files from dist (only for non-API requests)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing - serve index.html for all non-API routes
app.use((req, res, next) => {
  // Skip if it's an API route (already handled by proxy)
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Skip if it's a static file (has extension)
  if (req.path.includes('.')) {
    return next();
  }
  // Serve index.html for client-side routes
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = https.createServer(options, app);

server.listen(443, () => {
  console.log('HTTPS Server running on https://shirezaks.com:443');
  console.log('Proxying /api requests to https://localhost:8443');
  console.log('Serving static files from dist/');
});