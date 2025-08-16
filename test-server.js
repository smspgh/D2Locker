import http from 'http';

const port = process.env.PORT || 3000;

console.log('Starting test server...');
console.log('PORT:', port);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME);

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port, timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Test Server</title></head>
      <body>
        <h1>Test Server Running</h1>
        <p>Port: ${port}</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p>Environment: ${process.env.NODE_ENV || 'not set'}</p>
      </body>
      </html>
    `);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Test server listening on 0.0.0.0:${port}`);
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

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});