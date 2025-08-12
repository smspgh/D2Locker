#!/usr/bin/env node

import fs from 'fs';

const test = JSON.parse(fs.readFileSync('./test.json', 'utf8'));
const existing = JSON.parse(fs.readFileSync('./src/data/d2/trait-to-enhanced-trait.json', 'utf8'));

console.log('=== FILE COMPARISON ===');
console.log('Test file entries:', Object.keys(test).length);
console.log('Existing file entries:', Object.keys(existing).length);

const testKeys = new Set(Object.keys(test));
const existingKeys = new Set(Object.keys(existing));

const onlyInTest = [...testKeys].filter(k => !existingKeys.has(k));
const onlyInExisting = [...existingKeys].filter(k => !testKeys.has(k));
const inBoth = [...testKeys].filter(k => existingKeys.has(k));

console.log('\n=== KEY DIFFERENCES ===');
console.log('Only in test file:', onlyInTest.length);
console.log('Only in existing file:', onlyInExisting.length);
console.log('In both files:', inBoth.length);

if (onlyInTest.length > 0) {
  console.log('\nFirst 10 keys only in test:', onlyInTest.slice(0, 10));
}

if (onlyInExisting.length > 0) {
  console.log('\nFirst 10 keys only in existing:', onlyInExisting.slice(0, 10));
}

// Check for value differences in common keys
let valueDifferences = 0;
for (const key of inBoth) {
  if (test[key] !== existing[key]) {
    valueDifferences++;
    if (valueDifferences <= 5) {
      console.log(`Value diff for ${key}: test=${test[key]}, existing=${existing[key]}`);
    }
  }
}

console.log('\n=== VALUE DIFFERENCES ===');
console.log('Common keys with different values:', valueDifferences);

// Check the specific Arrowhead Brake mapping
console.log('\n=== ARROWHEAD BRAKE CHECK ===');
console.log('Test file - 839105230 maps to:', test['839105230']);
console.log('Existing file - 839105230 maps to:', existing['839105230']);

// Show some sample mappings from each file
console.log('\n=== SAMPLE MAPPINGS ===');
console.log('Test file samples:');
Object.keys(test).slice(0, 5).forEach(key => {
  console.log(`  ${key} -> ${test[key]}`);
});

console.log('Existing file samples:');
Object.keys(existing).slice(0, 5).forEach(key => {
  console.log(`  ${key} -> ${existing[key]}`);
});