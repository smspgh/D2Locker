# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## D2Locker Project Overview

D2Locker is a fork of DIM (Destiny Item Manager) - a web application for managing Destiny game inventory. It consists of a React/TypeScript frontend and a Node.js/Express backend.

## Essential Commands

### Development
```bash
# Install dependencies (uses pnpm package manager)
pnpm install

# Start development server with hot reload
pnpm start

# Run backend API server (in separate terminal)
cd backend && pnpm run api

# Run both frontend and backend together
pnpm serve:production
```

### Testing & Quality
```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- path/to/test.test.ts

# Lint all code (ESLint, Prettier, Stylelint)
pnpm lint

# Auto-fix linting issues
pnpm fix

# Check for unused exports
pnpm dead-code
```

### Building
```bash
# Development build
pnpm build:dev

# Production build
pnpm build:production

# Beta build
pnpm build:beta

# Build with light data processing
pnpm build:light
```

## Architecture Overview

### State Management
The application uses Redux with TypeScript for state management. The root state is defined in `src/app/store/types.ts`:

```typescript
interface RootState {
  accounts: AccountsState;      // User accounts and authentication
  inventory: InventoryState;    // Items and character inventory
  loadouts: LoadoutsState;      // Equipment loadout configurations
  manifest: ManifestState;      // Destiny game data definitions
  dimApi: DimApiState;         // DIM API synchronization
  vendors: VendorsState;       // In-game vendor data
  // ... other slices
}
```

### Key Application Flows

1. **Authentication Flow**
   - Entry: `src/app/App.tsx` checks `needsLogin` state
   - Auth handled via Bungie OAuth in `src/app/bungie-api/oauth.ts`
   - Tokens stored and managed in `src/app/bungie-api/oauth-tokens.ts`

2. **Data Loading Pipeline**
   - Manifest data loaded via `src/app/manifest/manifest-service-json.ts`
   - Character/inventory data via `src/app/inventory/d2-stores.ts`
   - API calls through `src/app/bungie-api/destiny2-api.ts`

3. **Loadout System**
   - Types defined in `src/app/loadout/loadout-types.ts`
   - Application logic in `src/app/loadout-drawer/loadout-apply.ts`
   - Mod assignment in `src/app/loadout/mod-assignment-utils.ts`

4. **Item Management**
   - Item definitions in `src/app/inventory/item-types.ts`
   - Move service in `src/app/inventory/item-move-service.ts`
   - Drag/drop handled by `@hello-pangea/dnd` library

### API Integration

**DIM API** (`src/app/dim-api/`)
- Profile sync, loadout sharing, user settings
- Updates batched and synced via `postUpdates()`

**Bungie API** (`src/app/bungie-api/`)
- Game data, inventory, character info
- Rate limiting in `src/app/bungie-api/rate-limiter.ts`
- Error handling in `src/app/bungie-api/bungie-service-helper.ts`

### Routing Structure
- `/:membershipId/:destinyVersion/*` - Character-specific routes
- `/armory/*` - Armory/collections views
- `/settings`, `/about`, `/whats-new` - Static pages
- Routing handled by React Router v7

### CSS Architecture
- CSS Modules with `.m.scss` extension
- TypeScript definitions auto-generated
- Global styles in `src/app/main.scss`
- Component styles colocated with components

### Backend Architecture
The backend (`/backend`) provides:
- SQLite database for local data storage
- JWT authentication for API requests
- CORS-enabled Express server
- SSL support for local development

## Development Guidelines

### File Conventions
- React components: PascalCase `.tsx` files
- Styles: `ComponentName.m.scss`
- Tests: `*.test.ts` or `*.test.tsx`
- Type definitions often in separate `*-types.ts` files

### Import Paths
Use configured aliases instead of relative paths:
- `app/*` → `src/app/*`
- `data/*` → `src/data/*`
- `testing/*` → `src/testing/*`

### Common Patterns
- Redux actions use `typesafe-actions` library
- Selectors use `reselect` for memoization
- API calls return promises and handle errors consistently
- Components use hooks over class components

### Windows Development Notes
- Use backslashes for Windows paths
- `where` command instead of `which`
- `dir` instead of `ls`
- `type` instead of `cat`

## Task Completion Checklist
Before completing any coding task:
1. Run `pnpm lint` - must pass all checks
2. Run `pnpm fix` if there are auto-fixable issues
3. Verify TypeScript compilation (shown by linter)
4. Test the feature manually if UI-related
5. Run `pnpm build:dev` to ensure build succeeds