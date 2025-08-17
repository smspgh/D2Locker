# Multi-stage build for D2Locker

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.8.0 --activate

# Install dependencies for building (python, make, g++ for node-gyp)
RUN apk add --no-cache python3 python3-dev py3-pip make g++ git

# Install Python dependencies
RUN pip3 install --break-system-packages cloudscraper

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create necessary directories for light data
RUN mkdir -p backend/light

# Process light data - check for NO_FILTER env var
ARG NO_FILTER=false
RUN if [ "$NO_FILTER" = "true" ]; then \
      pnpm util:light-data-nf; \
    else \
      pnpm util:light-data; \
    fi

# Build the application
RUN pnpm build:prod

# Stage 2: Production stage
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.8.0 --activate

# Install runtime dependencies including Python
RUN apk add --no-cache python3 python3-dev py3-pip make g++

# Install Python dependencies for runtime
RUN pip3 install --break-system-packages cloudscraper

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Install backend dependencies
WORKDIR /app/backend
RUN pnpm install --prod
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/src ./src
COPY --from=builder /app/destiny-icons ./destiny-icons
COPY --from=builder /app/icons ./icons

# Copy necessary config files and scripts
COPY config ./config
COPY scripts ./scripts
COPY simple-hmr-server.js ./
COPY proxy-server.js ./
COPY docker-hmr-server.js ./
# Copy SSL certificates if they exist
RUN mkdir -p /app/certs

# Copy TypeScript and other config files that exist
COPY tsconfig.json ./
COPY babel.config.cjs ./
COPY eslint.config.js ./
COPY jest.config.js ./
COPY src/postcss.config.cjs ./src/

# Copy ALL node_modules from builder (needed for webpack)
COPY --from=builder /app/node_modules ./node_modules

# Create necessary directories and ensure database is available
RUN mkdir -p /app/backend/db

# Copy database to both locations to handle different mount scenarios
RUN if [ -f /app/backend/d2l.db ]; then \
      cp /app/backend/d2l.db /app/backend/db/d2l.db; \
      echo "Database copied to volume mount location"; \
    else \
      echo "Warning: d2l.db not found in backend directory"; \
    fi

# Expose ports
EXPOSE 443 3000

# Start the application
CMD ["pnpm", "prod"]