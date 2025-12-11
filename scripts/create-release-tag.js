const fs = require('fs');
const path = require('path');

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version || '0.0.0';
const tag = `v${version}`;

console.log(`Suggested tag: ${tag}`);
console.log(`Run: git tag ${tag} && git push origin ${tag}`);
