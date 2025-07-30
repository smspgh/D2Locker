#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building icons for Windows...');

// Check if sharp is installed
try {
  require('sharp');
  console.log('Sharp is available, using it for PNG conversion');
  buildWithSharp();
} catch (e) {
  console.log('Sharp not found. Please install it with: npm install sharp');
  console.log('Alternatively, you can use online SVG to PNG converters');
  showManualInstructions();
}

async function buildWithSharp() {
  const sharp = require('sharp');
  
  const CACHEBREAKER = '6-2018';
  const VERSIONS = ['release', 'beta', 'dev', 'pr'];
  
  for (const version of VERSIONS) {
    console.log(`Processing ${version} icons...`);
    
    // Create directory
    const dir = path.join(__dirname, version);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
    
    // Favicon sizes
    for (const size of [16, 32, 96]) {
      const inputFile = path.join(__dirname, `favicon-${version}.svg`);
      const outputFile = path.join(dir, `favicon-${size}x${size}.png`);
      
      try {
        await sharp(inputFile)
          .resize(size, size)
          .png()
          .toFile(outputFile);
        console.log(`Generated: favicon-${size}x${size}.png`);
      } catch (error) {
        console.error(`Error generating ${outputFile}:`, error.message);
      }
    }
    
    // Apple touch icons
    const appleInputFile = path.join(__dirname, `apple-touch-icon-${version}.svg`);
    
    try {
      await sharp(appleInputFile)
        .resize(180, 180)
        .png()
        .toFile(path.join(dir, 'apple-touch-icon.png'));
      
      await sharp(appleInputFile)
        .resize(180, 180)
        .png()
        .toFile(path.join(dir, `apple-touch-icon-${CACHEBREAKER}.png`));
      
      console.log('Generated: Apple touch icons');
    } catch (error) {
      console.error('Error generating Apple touch icons:', error.message);
    }
    
    // Android icons
    const androidInputFile = path.join(__dirname, `android-icon-${version}.svg`);
    
    try {
      await sharp(androidInputFile)
        .resize(192, 192)
        .png()
        .toFile(path.join(dir, `android-chrome-192x192-${CACHEBREAKER}.png`));
      
      await sharp(androidInputFile)
        .resize(512, 512)
        .png()
        .toFile(path.join(dir, `android-chrome-512x512-${CACHEBREAKER}.png`));
      
      // Maskable version with background color
      const colors = {
        release: '#ee6d0d',
        beta: '#5bb1ce',
        dev: '#172025',
        pr: '#FF64E7',
      };
      
      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: colors[version]
        }
      })
      .composite([{ input: androidInputFile, gravity: 'center' }])
      .png()
      .toFile(path.join(dir, `android-chrome-mask-512x512-${CACHEBREAKER}.png`));
      
      console.log('Generated: Android icons');
    } catch (error) {
      console.error('Error generating Android icons:', error.message);
    }
  }
  
  console.log('✅ Icon generation complete!');
}

function showManualInstructions() {
  console.log(`
📋 Manual Steps to Generate Icons:

1. Install Sharp (recommended):
   npm install sharp
   
   Then run this script again.

2. OR use online converters:
   - Go to https://convertio.co/svg-png/
   - Upload each SVG file and convert to required sizes:
   
   For each version (release, beta, dev, pr):
   
   Favicon sizes needed:
   - favicon-16x16.png
   - favicon-32x32.png  
   - favicon-96x96.png
   
   Apple touch icons:
   - apple-touch-icon.png (180x180)
   - apple-touch-icon-6-2018.png (180x180)
   
   Android icons:
   - android-chrome-192x192-6-2018.png (192x192)
   - android-chrome-512x512-6-2018.png (512x512)
   - android-chrome-mask-512x512-6-2018.png (512x512 with background)

3. Place the generated PNG files in the respective folders:
   icons/release/, icons/beta/, icons/dev/, icons/pr/
`);
}