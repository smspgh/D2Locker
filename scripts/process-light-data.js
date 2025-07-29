#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TraitEnhancedMappingGenerator from './generate-trait-enhanced-mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RollAppraiserProcessor {
  constructor() {
    this.inputPath = path.join(__dirname, '../backend/light/rollAppraiserData.json');
    this.outputPath = path.join(__dirname, '../backend/light/rollAppraiserData.light.json');
  }

  async processFile() {
    console.log('Processing roll appraiser data...');
    console.log(`Input: ${this.inputPath}`);
    console.log(`Output: ${this.outputPath}`);

    try {
      // Check if input file exists
      if (!fs.existsSync(this.inputPath)) {
        console.error(`Input file not found: ${this.inputPath}`);
        process.exit(1);
      }

      // Get file size
      const stats = fs.statSync(this.inputPath);
      console.log(`Input file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Read and parse JSON
      console.log('Reading and parsing JSON...');
      const rawData = fs.readFileSync(this.inputPath, 'utf8');
      const data = JSON.parse(rawData);

      // Generate trait-to-enhanced mapping first
      console.log('\n=== Generating trait-to-enhanced mapping ===');
      const mappingGenerator = new TraitEnhancedMappingGenerator();
      await mappingGenerator.generateMapping();

      // Extract only required keys
      const lightData = this.extractRequiredKeys(data);

      // Write output
      console.log('Writing processed data...');
      fs.writeFileSync(this.outputPath, JSON.stringify(lightData, null, 2));

      const outputStats = fs.statSync(this.outputPath);
      console.log(`Output file size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Size reduction: ${((1 - outputStats.size / stats.size) * 100).toFixed(1)}%`);
      console.log('Processing complete!');

    } catch (error) {
      console.error('Error processing file:', error);
      process.exit(1);
    }
  }

  extractRequiredKeys(data) {
    return {
      PerkStats: data.PerkStats || {},
      TraitStats: data.TraitStats || {},
      MWStats: data.MWStats || {},
      ReviewSummary: data.ReviewSummary || {}
    };
  }
}

// Run if called directly  
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || process.argv[1]?.includes('process-light-data.js')) {
  console.log('Starting roll appraiser data processing...');
  const processor = new RollAppraiserProcessor();
  processor.processFile().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default RollAppraiserProcessor;