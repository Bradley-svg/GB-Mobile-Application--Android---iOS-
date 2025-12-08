#!/usr/bin/env node
const fs = require('fs');

const args = process.argv.slice(2);
const filePath = args[args.length - 1];
const flags = args.slice(0, -1);

if (!filePath) {
  console.error('missing file path');
  process.exit(2);
}

const mode = flags.find((arg) => arg === '--infected' || arg === '--error') || 'clean';

if (mode === '--error') {
  console.error('simulated scanner error');
  process.exit(2);
}

if (mode === '--infected') {
  console.log('FOUND');
  process.exit(1);
}

try {
  fs.accessSync(filePath, fs.constants.R_OK);
} catch (err) {
  console.error('file unreadable');
  process.exit(2);
}

console.log('OK');
process.exit(0);
