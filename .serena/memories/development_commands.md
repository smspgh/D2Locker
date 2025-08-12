# Development Commands

## Build Commands
- `pnpm build:production` - Production build
- `pnpm build:release` - Release build  
- `pnpm build:beta` - Beta build
- `pnpm build:dev` - Development build
- `pnpm build:light` - Build with light data processing

## Development Server
- `pnpm start` - Start dev server with hot reload and i18n watch
- `pnpm serve:frontend` - Run frontend proxy server
- `pnpm serve:api` - Run backend API server  
- `pnpm serve:production` - Run both frontend and backend
- `pnpm production` - Build and serve production

## Quality Checks
- `pnpm lint` - Run all linters (ESLint, Prettier, Stylelint)
- `pnpm lintcached` - Run linters with cache
- `pnpm fix` - Auto-fix all linting issues
- `pnpm test` - Run Jest tests

## Specific Linters
- `pnpm lint:eslint` - ESLint only
- `pnpm lint:prettier` - Prettier check
- `pnpm lint:stylelint` - Stylelint only

## Utility Commands
- `pnpm i18n` - Generate i18n translations
- `pnpm dead-code` - Find unused exports
- `pnpm deps:stale` - Check outdated dependencies
- `pnpm deps:update` - Update dependencies interactively