/**
 * Auto-detect and install missing dependencies
 * This script runs the build, captures missing dependency errors, and installs them automatically
 */

import { execSync } from 'child_process';
import fs from 'fs';

function runBuildAndCaptureMissingDeps() {
  try {
    console.log('🔍 Running build to detect missing dependencies...');

    // Run the build and capture both stdout and stderr
    const result = execSync('powershell -Command "pnpm run build:production 2>&1"', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log('✅ Build completed successfully! No missing dependencies found.');
    return [];

  } catch (error) {
    const errorOutput = error.stdout || error.stderr || error.message;
    console.log('📋 Analyzing build errors for missing dependencies...');

    // Extract missing dependency names from webpack error messages
    const missingDeps = [];
    const errorLines = errorOutput.split('\n');

    for (const line of errorLines) {
      // Look for webpack ModuleNotFoundError patterns
      const webpackErrorMatch = line.match(/Can't resolve '([^']+)'/);
      if (webpackErrorMatch) {
        const depName = webpackErrorMatch[1];
        // Filter out relative imports and focus on package names
        if (!depName.startsWith('.') && !depName.startsWith('/')) {
          missingDeps.push(depName);
        }
      }
    }

    // Remove duplicates
    const uniqueDeps = [...new Set(missingDeps)];

    if (uniqueDeps.length > 0) {
      console.log(`🎯 Found ${uniqueDeps.length} missing dependencies:`);
      uniqueDeps.forEach(dep => console.log(`  - ${dep}`));
    } else {
      console.log('❓ No missing dependencies found in error output');
      console.log('Build output (first 1000 chars):', errorOutput.substring(0, 1000));
    }

    return uniqueDeps;
  }
}

function installDependencies(deps) {
  if (deps.length === 0) {
    console.log('✅ No dependencies to install');
    return;
  }

  try {
    const command = `pnpm add ${deps.join(' ')}`;
    console.log(`\n🔧 Installing missing dependencies...`);
    console.log(`Running: ${command}`);

    execSync(command, { stdio: 'inherit', cwd: process.cwd() });

    console.log('\n✅ Successfully installed missing dependencies!');

  } catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Auto-installing missing dependencies...\n');

  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loops

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n--- Attempt ${attempts}/${maxAttempts} ---`);

    const missingDeps = runBuildAndCaptureMissingDeps();

    if (missingDeps.length === 0) {
      console.log('\n🎉 All dependencies resolved! Build should now succeed.');
      break;
    }

    installDependencies(missingDeps);

    console.log('\n⏳ Checking for additional missing dependencies...');
  }

  if (attempts >= maxAttempts) {
    console.log('\n⚠️  Reached maximum attempts. You may need to manually resolve remaining issues.');
  } else {
    console.log('\n🏁 Process complete! Try running your build again.');
  }
}

main().catch(error => {
  console.error('💥 Script failed:', error.message);
  process.exit(1);
});