#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcoFiles() {
  console.log('Generating favicon.ico files...');
  
  const VERSIONS = ['release', 'beta', 'dev', 'pr'];
  
  for (const version of VERSIONS) {
    const dir = path.join(__dirname, version);
    const favicon32Path = path.join(dir, 'favicon-32x32.png');
    const faviconIcoPath = path.join(dir, 'favicon.ico');
    
    try {
      // Create a simple .ico by copying the 32x32 PNG and renaming it
      // This isn't a true multi-size ICO but works for most browsers
      if (fs.existsSync(favicon32Path)) {
        fs.copyFileSync(favicon32Path, faviconIcoPath);
        console.log(`✅ Generated favicon.ico for ${version}`);
      } else {
        console.log(`❌ Could not find favicon-32x32.png for ${version}`);
      }
    } catch (error) {
      console.error(`❌ Error generating favicon.ico for ${version}:`, error.message);
    }
  }
  
  console.log('\\n🎉 Favicon.ico generation complete!');
}

generateIcoFiles().catch(console.error);