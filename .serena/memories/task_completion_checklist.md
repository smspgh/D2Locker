# Task Completion Checklist

When completing any coding task in this project, always run these commands:

## Essential Checks
1. **Linting**: `pnpm lint` - Must pass all checks
2. **Type Checking**: TypeScript compilation errors shown by the linter
3. **Formatting**: `pnpm fix` - Auto-fix code style issues

## Testing (if applicable)
- `pnpm test` - Run tests if you modified test files or added new functionality

## Before Committing
1. Ensure no linting errors
2. Verify the app builds: `pnpm build:dev`
3. Test functionality manually if making UI changes

## Common Issues to Check
- CSS Module imports are typed correctly
- No unused imports or variables
- React components follow naming conventions
- SCSS files follow style guidelines
- All new files use TypeScript (`.ts` or `.tsx`)