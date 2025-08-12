#!/usr/bin/env node

/**
 * Simplified approach: Run webpack directly and capture missing deps
 */

import { execSync, spawn } from 'child_process';

function runWebpackAndCaptureMissingDeps() {
  return new Promise((resolve) => {
    console.log('🔍 Running webpack to detect missing dependencies...');
    
    const missingDeps = [];
    
    // Run webpack directly
    const webpack = spawn('npx', ['webpack', '--config', './config/webpack.ts', '--env=release', '--node-env=production'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });
    
    let output = '';
    
    webpack.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text); // Show output in real-time
    });
    
    webpack.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text); // Show errors in real-time
      
      // Parse for missing dependencies
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(/Can't resolve '([^']+)'/);
        if (match) {
          const depName = match[1];
          if (!depName.startsWith('.') && !depName.startsWith('/')) {
            missingDeps.push(depName);
          }
        }
      }
    });
    
    webpack.on('close', (code) => {
      const uniqueDeps = [...new Set(missingDeps)];
      
      if (uniqueDeps.length > 0) {
        console.log(`\n🎯 Found ${uniqueDeps.length} missing dependencies:`);
        uniqueDeps.forEach(dep => console.log(`  - ${dep}`));
      } else if (code === 0) {
        console.log('\n✅ Build completed successfully!');
      } else {
        console.log('\n❓ Build failed but no missing dependencies detected in output');
      }
      
      resolve(uniqueDeps);
    });
  });
}

function installDependencies(deps) {
  if (deps.length === 0) return;
  
  try {
    const command = `pnpm add ${deps.join(' ')}`;
    console.log(`\n🔧 Installing missing dependencies: ${deps.join(', ')}`);
    
    execSync(command, { stdio: 'inherit' });
    console.log('\n✅ Successfully installed missing dependencies!');
    
  } catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Auto-detecting and installing missing dependencies...\n');
  
  const missingDeps = await runWebpackAndCaptureMissingDeps();
  
  if (missingDeps.length > 0) {
    installDependencies(missingDeps);
    console.log('\n🔄 Try running the script again to check for additional missing dependencies.');
  } else {
    console.log('\n🎉 No missing dependencies found or build succeeded!');
  }
}

main().catch(error => {
  console.error('💥 Script failed:', error.message);
  process.exit(1);
});