# Railway Deployment Guide

## Overview
This application is configured to run on Railway with automatic HTTPS termination. Railway handles SSL certificates and HTTPS traffic at their edge, so the application runs on HTTP internally.

## Environment Variables

Set these environment variables in your Railway project:

### Required Variables
- `NODE_ENV`: Set to `production`

### Automatically Set by Railway
- `RAILWAY_ENVIRONMENT_NAME`: Railway sets this automatically
- `RAILWAY_DEPLOYMENT_ID`: Railway sets this automatically
- `PORT`: Railway assigns a port automatically

### Custom Domain Setup

1. **Configure your custom domain in Railway**:
   - Go to your Railway project settings
   - Navigate to Settings > Domains
   - Add your custom domain (e.g., www.shirezaks.com)
   - Configure your DNS to point to Railway's servers

2. **Railway handles SSL automatically**:
   - Railway provides automatic SSL certificates via Let's Encrypt
   - No need to upload your own certificates
   - HTTPS is handled at Railway's edge

## Deployment Steps

1. Set up environment variables in Railway as described above
2. Configure your custom domain in Railway
3. Push your changes to GitHub
4. Railway will automatically detect changes and rebuild
5. The application will:
   - Detect Railway environment
   - Run HTTP servers internally
   - Railway provides HTTPS termination at the edge
   - Your site is accessible via https://www.shirezaks.com

## Local Development vs Railway

- **Local Development**: 
  - Uses SSL certificates from `/certs` directory
  - Runs HTTPS servers directly
  - Backend API: https://localhost:8443
  - Frontend: https://localhost:443

- **Railway Production**: 
  - No SSL certificates needed (Railway handles HTTPS)
  - Runs HTTP servers internally
  - Railway provides HTTPS termination
  - Accessible via your custom domain with HTTPS

## Troubleshooting

If you see 502 errors:
1. Check that your application is running on the PORT provided by Railway
2. Ensure the application is using HTTP (not HTTPS) internally
3. Check Railway logs for startup errors
4. Verify your custom domain is properly configured in Railway

If you see connection errors:
1. The application should detect Railway environment automatically
2. Check logs for "Running on Railway - using HTTP"
3. Ensure no SSL certificate errors are preventing startup

### How It Works

1. **Your Domain** → **Railway Edge (HTTPS)** → **Your App (HTTP)**
2. Railway handles all SSL/TLS termination
3. Your app runs on HTTP internally on the PORT Railway provides
4. Users always see HTTPS in their browser