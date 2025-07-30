#!/usr/bin/env node

import fs from 'fs';

const test = JSON.parse(fs.readFileSync('./test.json', 'utf8'));
const existing = JSON.parse(fs.readFileSync('./src/data/d2/trait-to-enhanced-trait.json', 'utf8'));

console.log('=== DETAILED ANALYSIS ===');

// Check if the differences are just reversed mappings
console.log('\nChecking Arrowhead Brake specifically:');
const testKey = '839105230';
const testValue = test[testKey];
console.log(`Test: ${testKey} -> ${testValue}`);
console.log(`Existing has ${testKey}?: ${existing[testKey] !== undefined}`);
console.log(`Existing has ${testValue}?: ${existing[testValue] !== undefined}`);
if (existing[testValue]) {
  console.log(`Existing: ${testValue} -> ${existing[testValue]}`);
}

// Check a few barrel perks specifically
const barrelPerks = ['839105230', '1482024992', '1392496348', '3250034553'];
console.log('\nBarrel perk mappings:');
barrelPerks.forEach(perk => {
  console.log(`${perk}: test=${test[perk] || 'NOT_FOUND'}, existing=${existing[perk] || 'NOT_FOUND'}`);
});

// Look for pattern - are the existing mappings reversed?
console.log('\nChecking if existing file might have different direction:');
let reversedCount = 0;
for (const [key, value] of Object.entries(test).slice(0, 10)) {
  if (existing[value] === key) {
    console.log(`REVERSED: test ${key}->${value}, existing ${value}->${key}`);
    reversedCount++;
  }
}
console.log(`Found ${reversedCount} potential reversed mappings in first 10 entries`);