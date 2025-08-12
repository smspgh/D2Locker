# Code Style and Conventions

## TypeScript/React Conventions
- Functional components preferred (enforced by ESLint)
- TypeScript strict mode enabled
- No unused locals/parameters
- Consistent casing enforced
- React 19 with no need for React imports in JSX

## File Naming
- Components: PascalCase (e.g., `App.tsx`, `ItemPopup.tsx`)
- Styles: Component name + `.m.scss` for CSS modules
- Tests: `*.test.ts` or `*.test.tsx`
- TypeScript declaration files generated for CSS modules

## Import Conventions
- Absolute imports using path aliases:
  - `app/*` → `src/app/*`
  - `data/*` → `src/data/*`
  - `images/*` → `src/images/*`
- No importing from test files in regular code
- Specific restrictions on lodash-like imports (use native alternatives)

## Code Style Rules
- Always use curly braces for all blocks
- Prefer `const` and arrow functions where appropriate
- Use template literals over string concatenation
- Strict equality (`===`) required
- No console logs or debugger statements
- Comments use `//` with space after

## CSS/SCSS Conventions
- CSS Modules for component styles
- BEM-like naming within modules
- Variables defined in `_variables.scss`
- Mixins for shared styles