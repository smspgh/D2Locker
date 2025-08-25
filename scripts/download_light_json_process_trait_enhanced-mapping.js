import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TraitEnhancedMappingGenerator {
  constructor() {
    this.inputPath = path.join(__dirname, '../backend/light/rollAppraiserData.json');
    this.outputPath = path.join(__dirname, '../src/data/d2/trait-to-enhanced-trait.json');
  }

  async generateMapping() {
    try {
      // Check for a command-line flag to skip the Python script
      if (!process.argv.includes('--no-fetch')) {
        const pythonScriptPath = path.join(__dirname, '../backend/get_light.py');
        console.log(`Executing Python script to fetch latest data: ${pythonScriptPath}`);
        execFileSync('C:\\Program Files\\Python313\\python.exe', [pythonScriptPath], {
          stdio: 'inherit',
        });
        console.log('Python script finished successfully.');
      } else {
        console.log('"--no-fetch" flag detected. Skipping Python script execution.');
      }

      console.log('\nGenerating trait-to-enhanced-trait.json mapping...');
      console.log(`Input: ${this.inputPath}`);
      console.log(`Output: ${this.outputPath}`);

      if (!fs.existsSync(this.inputPath)) {
        console.error(`Input file not found: ${this.inputPath}`);
        process.exit(1);
      }

      console.log('Reading rollAppraiserData.json...');
      const rawData = fs.readFileSync(this.inputPath, 'utf8');
      const data = JSON.parse(rawData);

      const mapping = this.extractStandardToEnhancedMapping(data);

      console.log('Writing trait-to-enhanced-trait.json...');
      fs.writeFileSync(this.outputPath, JSON.stringify(mapping, null, 2));

      console.log(`Generated ${Object.keys(mapping).length} standard-to-enhanced perk mappings`);
      console.log('Mapping generation complete!');

      // Compress the rollAppraiserData.json file for production serving
      await this.compressRollAppraiserData();
    } catch (error) {
      console.error('Error generating mapping:', error);
      process.exit(1);
    }
  }

  extractStandardToEnhancedMapping(data) {
    const mapping = {};
    const nameToHashes = new Map();
    let processed = 0;
    let mappingsFound = 0;

    if (!data.Weapons) {
      console.error('No "Weapons" key found in the data file.');
      return mapping;
    }

    console.log(`Found ${Object.keys(data.Weapons).length} weapons to process.`);

    for (const weapon of Object.values(data.Weapons)) {
      if (!weapon.RandomRolls || !Array.isArray(weapon.RandomRolls)) {
        continue;
      }
      processed++;

      for (const socketColumn of weapon.RandomRolls) {
        if (!Array.isArray(socketColumn)) continue;

        for (const perk of socketColumn) {
          if (!perk.ItemHash || !perk.Name) continue;

          const perkName = perk.Name;
          const perkHash = perk.ItemHash;

          if (!nameToHashes.has(perkName)) {
            nameToHashes.set(perkName, []);
          }

          const hashesForName = nameToHashes.get(perkName);
          if (!hashesForName.includes(perkHash)) {
            hashesForName.push(perkHash);
          }
        }
      }
    }

    for (const [perkName, hashes] of nameToHashes.entries()) {
      if (hashes.length === 2) {
        const sortedHashes = hashes.sort((a, b) => a - b);
        const standardHash = sortedHashes[0].toString();
        const enhancedHash = sortedHashes[1].toString();

        mapping[standardHash] = enhancedHash;
        mappingsFound++;
      }
    }

    console.log(`Processed ${processed} weapons with random rolls.`);
    console.log(`Found ${mappingsFound} unique standard-to-enhanced mappings.`);
    return mapping;
  }

  async compressRollAppraiserData() {
    try {
      console.log('\nCompressing rollAppraiserData.json for production serving...');

      const inputFile = this.inputPath;
      const outputFile = inputFile + '.br';

      if (!fs.existsSync(inputFile)) {
        console.warn(`Input file not found for compression: ${inputFile}`);
        return;
      }

      const inputData = fs.readFileSync(inputFile);
      const compressed = zlib.brotliCompressSync(inputData, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5, // Same quality as webpack config
        },
      });

      fs.writeFileSync(outputFile, compressed);

      const originalSize = inputData.length;
      const compressedSize = compressed.length;
      const compressionRatio = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

      console.log(`Compressed ${inputFile} -> ${outputFile}`);
      console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Compression ratio: ${compressionRatio}% reduction`);
    } catch (error) {
      console.error('Error compressing rollAppraiserData.json:', error);
      // Don't fail the entire process for compression errors
    }
  }
}

// Run if called directly
const isMainModule =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || process.argv[1]?.includes('generate-trait-enhanced-mapping.js')) {
  console.log('Starting trait-to-enhanced mapping generation...');
  const generator = new TraitEnhancedMappingGenerator();
  generator.generateMapping().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default TraitEnhancedMappingGenerator;
