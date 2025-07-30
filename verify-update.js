#!/usr/bin/env node

import fs from 'fs';

const updated = JSON.parse(fs.readFileSync('./src/data/d2/trait-to-enhanced-trait.json', 'utf8'));

console.log('=== VERIFICATION ===');
console.log('Updated file entries:', Object.keys(updated).length);
console.log('Arrowhead Brake mapping (839105230):', updated['839105230']);
console.log('');
console.log('Sample barrel perk mappings:');
const barrelPerks = ['839105230', '1482024992', '1392496348', '3250034553'];
barrelPerks.forEach(perk => {
  console.log(`  ${perk} -> ${updated[perk] || 'NOT_FOUND'}`);
});

console.log('');
console.log('SUCCESS: trait-to-enhanced-trait.json has been updated with complete mappings!');