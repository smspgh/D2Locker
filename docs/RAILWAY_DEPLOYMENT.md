# Railway Deployment Guide

## Overview
This application is configured to run on Railway with automatic HTTPS termination. Railway provides SSL certificates and handles HTTPS traffic, so the application runs on HTTP internally.

## Environment Variables

Set these environment variables in your Railway project:

### Required Variables
- `RAILWAY_ENVIRONMENT`: Set to `production` (automatically set by Railway)
- `PORT`: Railway will automatically set this
- `NODE_ENV`: Set to `production`

### Optional SSL Certificate Variables (if not using Railway's HTTPS termination)
If you need custom SSL certificates:
- `SSL_KEY`: Your SSL private key content (base64 encoded)
- `SSL_CERT`: Your SSL certificate content (base64 encoded)

To encode your certificates:
```bash
# On Linux/Mac
base64 -i certs/shirezaks_com.key
base64 -i certs/shirezaks_com.pem

# On Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("certs\shirezaks_com.key"))
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("certs\shirezaks_com.pem"))
```

## Deployment Steps

1. Push your changes to GitHub
2. Railway will automatically detect changes and rebuild
3. The application will:
   - Check for Railway environment
   - Skip SSL certificate loading (Railway handles HTTPS)
   - Run on HTTP internally on the PORT provided by Railway
   - Railway will handle HTTPS termination and provide SSL

## Local Development vs Railway

- **Local Development**: Uses SSL certificates from `/certs` directory
- **Railway Production**: Uses Railway's HTTPS termination, no certificates needed

## Troubleshooting

If you see SSL certificate errors:
1. Ensure `RAILWAY_ENVIRONMENT` is set to `production`
2. Check that the application is running on the PORT provided by Railway
3. Verify Railway's HTTPS domain is properly configured