# Railway Deployment Guide

## Overview
This application is configured to run on Railway with custom domain SSL certificates for https://www.shirezaks.com.

## Environment Variables

Set these environment variables in your Railway project:

### Required Variables
- `NODE_ENV`: Set to `production`
- `SSL_KEY`: Your SSL private key content (the contents of shirezaks_com.key file)
- `SSL_CERT`: Your SSL certificate content (the contents of shirezaks_com.pem file)

### How to Add SSL Certificates to Railway

1. **Copy the certificate contents**:
   ```bash
   # Copy the private key
   cat certs/shirezaks_com.key
   
   # Copy the certificate
   cat certs/shirezaks_com.pem
   ```

2. **Add to Railway environment variables**:
   - Go to your Railway project settings
   - Navigate to Variables
   - Add `SSL_KEY` with the entire content of shirezaks_com.key (including BEGIN/END lines)
   - Add `SSL_CERT` with the entire content of shirezaks_com.pem (including BEGIN/END lines)

## Deployment Steps

1. Set up environment variables in Railway as described above
2. Push your changes to GitHub
3. Railway will automatically detect changes and rebuild
4. The application will:
   - Load SSL certificates from environment variables
   - Run HTTPS server on port 443
   - Serve your application securely on https://www.shirezaks.com

## Local Development vs Railway

- **Local Development**: Uses SSL certificates from `/certs` directory
- **Railway Production**: Uses SSL certificates from environment variables

## Port Configuration

The application uses these ports:
- Backend API: 8443 (HTTPS)
- Frontend HMR: 443 (HTTPS)

## Troubleshooting

If you see SSL certificate errors:
1. Ensure `SSL_KEY` and `SSL_CERT` environment variables are properly set
2. Verify the certificate content includes the full PEM format with BEGIN/END lines
3. Check Railway logs for specific error messages
4. Ensure your custom domain is properly configured in Railway

### Certificate Format Example

Your environment variables should look like this:

**SSL_KEY**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
[rest of key content]
-----END PRIVATE KEY-----
```

**SSL_CERT**:
```
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIUJZkM1s9rp1L2C0Z8qNLcMKC5QiYwDQYJ...
[rest of certificate content]
-----END CERTIFICATE-----
```