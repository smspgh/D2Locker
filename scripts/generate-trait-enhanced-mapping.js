#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TraitEnhancedMappingGenerator {
  constructor() {
    this.inputPath = path.join(__dirname, '../backend/light/rollAppraiserData.json');
    this.outputPath = path.join(__dirname, '../src/data/d2/trait-to-enhanced-trait.json');
  }

  async generateMapping() {
    console.log('Generating trait-to-enhanced-trait.json mapping...');
    console.log(`Input: ${this.inputPath}`);
    console.log(`Output: ${this.outputPath}`);

    try {
      // Check if input file exists
      if (!fs.existsSync(this.inputPath)) {
        console.error(`Input file not found: ${this.inputPath}`);
        process.exit(1);
      }

      // Read and parse JSON
      console.log('Reading rollAppraiserData.json...');
      const rawData = fs.readFileSync(this.inputPath, 'utf8');
      const data = JSON.parse(rawData);

      // Extract standard-to-enhanced mappings
      const mapping = this.extractStandardToEnhancedMapping(data);

      // Write output to final location
      console.log('Writing trait-to-enhanced-trait.json...');
      fs.writeFileSync(this.outputPath, JSON.stringify(mapping, null, 2));

      console.log(`Generated ${Object.keys(mapping).length} standard-to-enhanced perk mappings`);
      console.log(`Updated trait-to-enhanced-trait.json with complete mappings`);
      console.log('Mapping generation complete!');

    } catch (error) {
      console.error('Error generating mapping:', error);
      process.exit(1);
    }
  }

  extractStandardToEnhancedMapping(data) {
    const mapping = {};
    const nameToHashes = new Map(); // Track names and their hashes in order
    let processed = 0;
    let mappingsFound = 0;

    // Ensure we're only processing the Weapons section
    if (!data.Weapons) {
      console.error('No Weapons section found in data');
      return mapping;
    }

    console.log(`Found ${Object.keys(data.Weapons).length} weapons in data.Weapons`);

    // Iterate through all weapons in the Weapons key only
    for (const [weaponHash, weapon] of Object.entries(data.Weapons)) {
      if (!weapon.RandomRolls || !Array.isArray(weapon.RandomRolls)) {
        continue;
      }

      processed++;

      // Iterate through each socket column (barrel, magazine, perks, etc.)
      for (const socketColumn of weapon.RandomRolls) {
        if (!Array.isArray(socketColumn)) {
          continue;
        }

        // Process each perk in this socket column
        for (const perk of socketColumn) {
          if (!perk.ItemHash || !perk.Name) {
            continue;
          }

          const perkName = perk.Name;
          const perkHash = perk.ItemHash;

          // Track this name-hash combination
          if (!nameToHashes.has(perkName)) {
            nameToHashes.set(perkName, []);
          }
          
          const hashesForName = nameToHashes.get(perkName);
          
          // Only add if we haven't seen this exact hash for this name before
          if (!hashesForName.includes(perkHash)) {
            hashesForName.push(perkHash);
          }
        }
      }
    }

    // Now process the collected names to find standard->enhanced mappings
    for (const [perkName, hashes] of nameToHashes.entries()) {
      if (hashes.length === 2) {
        // Based on feedback: Second hash is actually standard (in ranking data), first is enhanced (from manifest)
        const standardHash = hashes[1].toString();
        const enhancedHash = hashes[0].toString();
        
        mapping[standardHash] = enhancedHash;
        mappingsFound++;
        
        // Log some examples for verification
        if (mappingsFound <= 10) {
          console.log(`Mapping: ${perkName} - ${standardHash} (standard) → ${enhancedHash} (enhanced)`);
        }
      } else if (hashes.length > 2) {
        console.warn(`Warning: Found ${hashes.length} versions of "${perkName}" - expected 2. Hashes: ${hashes.join(', ')}`);
      }
    }

    console.log(`Processed ${processed} weapons`);
    console.log(`Found ${mappingsFound} unique standard-to-enhanced mappings`);
    console.log(`Total unique perk names: ${nameToHashes.size}`);

    return mapping;
  }
}

// Run if called directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || process.argv[1]?.includes('generate-trait-enhanced-mapping.js')) {
  console.log('Starting trait-to-enhanced mapping generation...');
  const generator = new TraitEnhancedMappingGenerator();
  generator.generateMapping().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default TraitEnhancedMappingGenerator;