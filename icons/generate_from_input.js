#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  console.log('Generating PNG icons from input.svg...');
  
  const inputSvg = path.join(__dirname, 'input.svg');
  const CACHEBREAKER = '6-2018';
  const VERSIONS = ['release', 'beta', 'dev', 'pr'];
  
  // Colors for maskable icons
  const colors = {
    release: '#ee6d0d',
    beta: '#5bb1ce', 
    dev: '#172025',
    pr: '#FF64E7',
  };
  
  for (const version of VERSIONS) {
    console.log(`\\nGenerating ${version} icons...`);
    
    const dir = path.join(__dirname, version);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    try {
      // Favicon sizes (16, 32, 96)
      for (const size of [16, 32, 96]) {
        await sharp(inputSvg)
          .resize(size, size)
          .png()
          .toFile(path.join(dir, `favicon-${size}x${size}.png`));
        console.log(`✅ favicon-${size}x${size}.png`);
      }
      
      // Apple touch icons (180x180)
      await sharp(inputSvg)
        .resize(180, 180)
        .png()
        .toFile(path.join(dir, 'apple-touch-icon.png'));
      
      await sharp(inputSvg)
        .resize(180, 180)
        .png()
        .toFile(path.join(dir, `apple-touch-icon-${CACHEBREAKER}.png`));
      console.log(`✅ Apple touch icons`);
      
      // Android icons
      await sharp(inputSvg)
        .resize(192, 192)
        .png()
        .toFile(path.join(dir, `android-chrome-192x192-${CACHEBREAKER}.png`));
      
      await sharp(inputSvg)
        .resize(512, 512)
        .png()
        .toFile(path.join(dir, `android-chrome-512x512-${CACHEBREAKER}.png`));
      
      // Maskable version with background color
      await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: colors[version]
        }
      })
      .composite([{
        input: await sharp(inputSvg).resize(400, 400).png().toBuffer(),
        gravity: 'center'
      }])
      .png()
      .toFile(path.join(dir, `android-chrome-mask-512x512-${CACHEBREAKER}.png`));
      
      console.log(`✅ Android icons`);
      
    } catch (error) {
      console.error(`❌ Error generating ${version} icons:`, error.message);
    }
  }
  
  console.log('\\n🎉 Icon generation complete!');
  console.log('\\nGenerated icons in:');
  VERSIONS.forEach(v => console.log(`  icons/${v}/`));
}

generateIcons().catch(console.error);