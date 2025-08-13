#!/bin/sh

# Setup SSL certificates from environment variables for Railway deployment
# Falls back to volume-mounted certificates if env vars not present

CERT_DIR="/app/certs"

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Check if certificates are provided via environment variables
if [ ! -z "$SSL_KEY" ] && [ ! -z "$SSL_CERT" ]; then
    echo "Setting up SSL certificates from environment variables..."
    echo "$SSL_KEY" > "$CERT_DIR/shirezaks_com.key"
    echo "$SSL_CERT" > "$CERT_DIR/shirezaks_com.pem"
    chmod 600 "$CERT_DIR/shirezaks_com.key"
    chmod 644 "$CERT_DIR/shirezaks_com.pem"
    echo "SSL certificates configured from environment variables"
elif [ -f "$CERT_DIR/shirezaks_com.key" ] && [ -f "$CERT_DIR/shirezaks_com.pem" ]; then
    echo "Using existing SSL certificates from volume mount"
else
    echo "WARNING: No SSL certificates found. HTTPS will not work."
    echo "Please provide SSL_KEY and SSL_CERT environment variables or mount certificates to $CERT_DIR"
fi