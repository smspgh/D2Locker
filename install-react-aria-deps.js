#!/usr/bin/env node

/**
 * Script to install all common @react-aria dependencies
 * This resolves the issue where react-aria requires many peer dependencies
 * that aren't automatically installed
 */

import { execSync } from 'child_process';

// List of common @react-aria packages that are typically needed
const reactAriaPackages = [
  '@react-aria/breadcrumbs',
  '@react-aria/button',
  '@react-aria/calendar',
  '@react-aria/checkbox',
  '@react-aria/color',
  '@react-aria/combobox',
  '@react-aria/datepicker',
  '@react-aria/dialog',
  '@react-aria/disclosure',
  '@react-aria/dnd',
  '@react-aria/focus',
  '@react-aria/form',
  '@react-aria/grid',
  '@react-aria/gridlist',
  '@react-aria/i18n',
  '@react-aria/interactions',
  '@react-aria/label',
  '@react-aria/landmark',
  '@react-aria/link',
  '@react-aria/listbox',
  '@react-aria/menu',
  '@react-aria/meter',
  '@react-aria/numberfield',
  '@react-aria/overlays',
  '@react-aria/progress',
  '@react-aria/radio',
  '@react-aria/searchfield',
  '@react-aria/select',
  '@react-aria/selection',
  '@react-aria/separator',
  '@react-aria/slider',
  '@react-aria/spinbutton',
  '@react-aria/ssr',
  '@react-aria/switch',
  '@react-aria/table',
  '@react-aria/tabs',
  '@react-aria/tag',
  '@react-aria/textfield',
  '@react-aria/toggle',
  '@react-aria/tooltip',
  '@react-aria/tree',
  '@react-aria/utils',
  '@react-aria/visually-hidden',
];

console.log('Installing @react-aria dependencies...');
console.log(`Installing ${reactAriaPackages.length} packages`);

try {
  // Install all packages at once
  const command = `pnpm add ${reactAriaPackages.join(' ')}`;
  console.log('Running:', command);

  execSync(command, { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n✅ All @react-aria dependencies installed successfully!');
  console.log('You can now run your build command.');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}
