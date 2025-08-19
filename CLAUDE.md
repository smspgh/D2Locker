# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

D2Locker is a fork of D2L (Destiny Item Manager) - a web application for managing Destiny 2 game inventory. It's built with React, Redux, TypeScript, and uses Webpack for bundling.

## Key Commands

### Development
```bash
# Start development server with hot reloading (uses .dev.env for environment variables)
# Includes light data processing before starting servers
pnpm start

# Install dependencies (uses pnpm)
pnpm install

# Run development server components separately
pnpm serve:frontend  # Frontend proxy server
pnpm serve:api      # Backend API server
```

### Production with Live Reload
```bash
# Run production server with live reload (auto-refresh on file changes)
pnpm prod

# This runs:
# - Light data processing (rollAppraiserData optimization)
# - Backend API server
# - Frontend server with live reload via WebSocket
# - Webpack in watch mode to rebuild on changes

# You can also run components separately:
pnpm serve:hmr         # Frontend with live reload
pnpm serve:api         # Backend API server
pnpm build:prod --watch # Watch mode build
```

### Building
```bash
# Build for production (release)
pnpm build:production
# or
pnpm build:release

# Build beta version
pnpm build:beta

# Build with light data processing
pnpm build:light

# Process light data only
pnpm process-light-data
```

### Testing & Quality
```bash
# Run all tests
pnpm test

# Linting (runs all linters: ESLint, Prettier, Stylelint)
pnpm lint

# Run individual linters
pnpm lint:eslint     # ESLint only
pnpm lint:prettier   # Prettier only
pnpm lint:stylelint  # Stylelint only

# Cached linting (faster for development)
pnpm lintcached

# Fix linting issues
pnpm fix

# Fix individual tools
pnpm fix:eslint      # Fix ESLint issues
pnpm fix:prettier    # Fix Prettier formatting
pnpm fix:stylelint   # Fix Stylelint issues

# Type checking occurs during build - no separate typecheck command
```

### Backend API
```bash
# Start backend API server (inserts API key and starts server)
cd backend && pnpm run api

# Or run from root
pnpm serve:api
```


## Architecture

### Directory Structure
- `/src` - Main application source code
  - `/app` - Core application modules (feature-based organization)
    - `/inventory` - Item management, drag/drop, move operations
    - `/loadout` - Loadout creation, management, and application
    - `/loadout-builder` - Automated loadout optimization with stat constraints
    - `/loadout-drawer` - UI for applying and managing loadouts
    - `/item-popup` - Detailed item view with sockets, perks, stats
    - `/item-actions` - Move, lock, tag, and other item operations
    - `/bungie-api` - Bungie API integration with rate limiting
    - `/d2l-api` - D2L backend sync API integration
    - `/shell` - Application shell (header, routing, error handling)
    - `/search` - Item search with filters and autocomplete
    - `/settings` - User preferences and configuration
    - `/compare` - Side-by-side item comparison
    - `/progress` - Milestones, pursuits, and character progression
    - `/vendors` - Vendor items and purchasing
    - `/records` - Triumphs, collections, and metrics
  - `/data` - Static game data files
  - `/images` - Image assets
  - `/locale` - Internationalization files
- `/backend` - Express.js backend server
  - Uses SQLite database (`d2l.db`) for user data sync
  - HTTPS server with SSL certificates
  - CORS configured for allowed origins
- `/config` - Webpack configurations for different environments
- `/destiny-icons` - Destiny game icons and assets
- `/icons` - Application icons and favicons

### Tech Stack
- **Frontend**: React 19, Redux 5, TypeScript 5
- **Styling**: SCSS with CSS Modules (`.m.scss` files)
- **Build**: Webpack 5, Babel, with environment-specific configs
- **Backend**: Express.js 5, SQLite (better-sqlite3), JWT auth
- **Testing**: Jest, React Testing Library, jsdom environment
- **Package Manager**: pnpm 8.8.0 (required)

### Key Architectural Patterns

1. **Redux Store Structure**:
   - Uses Redux with redux-thunk for async operations
   - Store observers in `/src/app/store/observerMiddleware.ts` handle cross-cutting concerns
   - Feature-based reducers combined in `/src/app/store/reducers.ts`

2. **Routing**:
   - React Router v7 with lazy-loaded route components for code splitting
   - Routes defined in `/src/app/routes.ts`

3. **API Integration**:
   - Bungie API wrapper in `/src/app/bungie-api` with rate limiting and authentication
   - d2l sync API in `/src/app/d2l-api` for user data persistence
   - HTTP client with retry logic and error handling

4. **Component Organization**:
   - Feature-based folder structure with co-located components and styles
   - CSS Modules for styling (`.m.scss` files with `.m.scss.d.ts` type definitions)
   - TypeScript interfaces and types alongside components

5. **Data Flow**:
   - User authentication via Bungie OAuth stored in Redux
   - Game data fetched from Bungie API and cached in Redux store
   - User preferences/loadouts synced via D2L API to backend SQLite database
   - IndexedDB for offline capability and caching

6. **Path Aliases**: Configured in `tsconfig.json`:
   - `app/*` → `src/app/*`
   - `data/*` → `src/data/*`
   - `images/*` → `src/images/*`
   - `destiny-icons/*` → `destiny-icons/*`
   - `locale/*` → `src/locale/*`

### Development Environment

- HTTPS development server with auto-generated SSL certificates (via mkcert)
- Webpack dev server runs on port 443 by default
- Hot module replacement enabled for React components
- TypeScript path aliases resolved by webpack

### Build System

- Webpack 5 with environment-specific configurations
- Build targets: `dev`, `beta`, `release`, `pr`
- Code splitting with dynamic imports for route-based chunking
- CSS extraction and minification for production builds
- Bundle analysis available via webpack-bundle-analyzer

### Testing

- Jest test runner with jsdom environment
- React Testing Library for component testing
- Test files co-located with source files (`.test.ts/.tsx`)
- Global test setup in `/src/testing/jest-setup.cjs`

### Environment Variables

The project uses different environment files for different build targets:
- **Development**: `.dev.env` - Used when running `pnpm start` (dev environment)
- **Production**: `.env` - Used for production builds (release, beta, pr, production-hmr)
- **Template**: `.env.example` - Template showing available environment variables

Environment variables are loaded automatically by webpack based on the build target.

### Important Notes
- **Always use `pnpm`** (not npm or yarn) - enforced by `engines` in package.json
- CSS class names use camelCase due to CSS Modules
- SSL certificates are required and must be placed in `/certs` directory:
  - `d2locker_com.key` - Private key file
  - `d2locker_com.pem` - Certificate file
  - Used by both frontend (webpack dev server, HMR servers) and backend API
- Build artifacts output to `/dist` directory
- Feature flags in `/config/feature-flags.ts` control experimental features