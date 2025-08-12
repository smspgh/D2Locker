# Docker Setup for D2Locker

This guide explains how to run D2Locker using Docker while maintaining your existing development workflow.

## Prerequisites

- Docker and Docker Compose installed
- SSL certificates (required for HTTPS)
- Environment variables configured

## Quick Start

### 1. Prepare SSL Certificates

Place your SSL certificates in the `certs` directory:
```bash
mkdir -p certs
# Copy your certificates:
# - shirezaks_com.pem
# - shirezaks_com.key
```

### 2. Set Up Environment Variables

Copy the environment template:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

For Docker-specific configuration, you can also use:
```bash
cp .env.docker .env
```

### 3. Build and Run

#### Development Mode
```bash
# Build the development image
pnpm docker:build:dev

# Run in development mode (with hot reloading)
pnpm docker:dev

# For no-filter mode
pnpm docker:build:dev-nf
pnpm docker:dev-nf
```

#### Production Mode
```bash
# Build the production image
pnpm docker:build:prod

# Run production build with live reload
pnpm docker:prod

# For no-filter mode
pnpm docker:build:prod-nf
pnpm docker:prod-nf

# Run only the backend API
pnpm docker:api
```

## Available Docker Commands

All Docker commands are available as npm scripts:

```bash
# Building
pnpm docker:build          # Build all images
pnpm docker:build:dev      # Build development image
pnpm docker:build:prod     # Build production image
pnpm docker:build:dev-nf   # Build development no-filter image
pnpm docker:build:prod-nf  # Build production no-filter image

# Running
pnpm docker:dev            # Run development environment
pnpm docker:prod           # Run production with HMR
pnpm docker:dev-nf         # Run development no-filter environment
pnpm docker:prod-nf        # Run production no-filter with HMR
pnpm docker:api            # Run backend API only

# Management
pnpm docker:down           # Stop all containers
pnpm docker:logs           # View container logs
pnpm docker:shell          # Access development container shell
pnpm docker:shell:prod     # Access production container shell
pnpm docker:shell:dev-nf   # Access development no-filter container shell
pnpm docker:shell:prod-nf  # Access production no-filter container shell
pnpm docker:clean          # Remove containers, volumes, and images
```

## Traditional Commands (Non-Docker)

Your existing workflow continues to work without Docker:
```bash
pnpm install
pnpm dev                   # Development server
pnpm prod                  # Production with HMR
pnpm dev-nf                # Development server (no-filter)
pnpm prod-nf               # Production with HMR (no-filter)
pnpm build:prod            # Production build
```

## Docker Services

### Development Setup (d2locker-dev)
- Webpack dev server with hot reloading
- Backend API server
- Source code mounted for live editing
- All development dependencies included

### Development No-Filter Setup (d2locker-dev-nf)
- Same as development but with no-filter mode
- Uses `pnpm dev-nf` command
- Processes light data without filters

### Production Setup (d2locker-prod)
- Optimized production build
- Live reload capability via HMR
- Minimal image size
- Health checks enabled

### Production No-Filter Setup (d2locker-prod-nf)
- Same as production but with no-filter mode
- Uses `pnpm prod-nf` command
- Processes light data without filters

### Backend API Only (backend-api)
- Standalone API server
- Can be deployed separately
- Uses production build

## Volume Mounts

### Development
- `./:/app` - Full source code (for hot reloading)
- `./certs:/app/certs:ro` - SSL certificates (read-only)
- `backend-db:/app/backend/db` - SQLite database persistence

### Production
- `./certs:/app/certs:ro` - SSL certificates (read-only)
- `backend-db:/app/backend/db` - SQLite database persistence
- `./dist:/app/dist` - Build output (for live reload)

## Ports

- `443`: HTTPS frontend
- `3000`: Backend API
- `8080`: Webpack dev server (development only)

## Environment Variables

The following environment variables are used:

- `NODE_ENV`: Set to `development` or `production`
- `DOCKER`: Set to `true` when running in Docker
- `NO_FILTER`: Set to `true` for no-filter builds
- `WEB_API_KEY`: Bungie API key
- `WEB_OAUTH_CLIENT_ID`: Bungie OAuth client ID
- `WEB_OAUTH_CLIENT_SECRET`: Bungie OAuth client secret
- `D2L_API_KEY`: D2L API key

## Troubleshooting

### Certificate Issues
- Ensure certificates are in the `certs/` directory
- Check file permissions: certificates should be readable
- Verify certificate names match configuration

### Database Persistence
- SQLite database is stored in Docker volume `backend-db`
- Database persists between container restarts
- To reset database: `docker volume rm d2locker_backend-db`

### Port Conflicts
If ports are already in use:
- Stop conflicting services, or
- Modify port mappings in `docker-compose.yml`

### Build Issues
- Clear Docker cache: `docker system prune -a`
- Rebuild without cache: `docker-compose build --no-cache`

### Performance
- Ensure Docker has adequate resources allocated
- On Windows/Mac, check Docker Desktop memory settings
- Consider using WSL2 on Windows for better performance

## Advanced Usage

### Custom Docker Compose
```bash
# Use multiple compose files
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Override specific services
docker-compose up -d backend-api
```

### Debugging
```bash
# View real-time logs
pnpm docker:logs

# Access container shell for debugging
pnpm docker:shell

# Inspect running containers
docker ps

# Check container health
docker inspect d2locker-prod | grep -A 5 Health
```

## Security Notes

- SSL certificates are mounted read-only
- Database is isolated in a Docker volume
- Environment variables are injected at runtime
- Production images exclude development dependencies