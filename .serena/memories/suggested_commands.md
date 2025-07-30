# Suggested Commands for D2Locker Development

## Windows System Commands
- `dir` - List directory contents (Windows equivalent of `ls`)
- `type <file>` - Display file contents (Windows equivalent of `cat`)
- `findstr` - Search within files (Windows equivalent of `grep`)
- `where <command>` - Find executable location
- `cd` - Change directory (use backslashes on Windows)

## Git Commands
- `git status` - Check current changes
- `git diff` - View unstaged changes
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit changes
- `git log --oneline -10` - View recent commits

## Project-Specific Commands
- `pnpm install` - Install dependencies
- `pnpm start` - Start development server
- `pnpm lint` - Run all linters
- `pnpm fix` - Auto-fix linting issues
- `pnpm test` - Run tests
- `pnpm build:dev` - Development build

## Backend Commands
- `cd backend && pnpm install` - Install backend dependencies
- `cd backend && pnpm run api` - Start API server

## Useful Development Commands
- `pnpm i18n` - Update translations
- `pnpm dead-code` - Find unused exports
- `pnpm deps:stale` - Check outdated packages