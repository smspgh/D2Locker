#!/usr/bin/env node

/**
 * Script to install all common @react-stately dependencies
 * These are state management companions to @react-aria packages
 */

import { execSync } from 'child_process';

// List of common @react-stately packages that are typically needed
const reactStatelyPackages = [
  '@react-stately/calendar',
  '@react-stately/checkbox',
  '@react-stately/collections',
  '@react-stately/color',
  '@react-stately/combobox',
  '@react-stately/data',
  '@react-stately/datepicker',
  '@react-stately/dnd',
  '@react-stately/form',
  '@react-stately/grid',
  '@react-stately/list',
  '@react-stately/menu',
  '@react-stately/numberfield',
  '@react-stately/overlays',
  '@react-stately/radio',
  '@react-stately/searchfield',
  '@react-stately/select',
  '@react-stately/selection',
  '@react-stately/slider',
  '@react-stately/table',
  '@react-stately/tabs',
  '@react-stately/toggle',
  '@react-stately/tooltip',
  '@react-stately/tree',
  '@react-stately/utils',
];

console.log('Installing @react-stately dependencies...');
console.log(`Installing ${reactStatelyPackages.length} packages`);

try {
  // Install all packages at once
  const command = `pnpm add ${reactStatelyPackages.join(' ')}`;
  console.log('Running:', command);

  execSync(command, { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n✅ All @react-stately dependencies installed successfully!');
  console.log('You can now run your build command.');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}
