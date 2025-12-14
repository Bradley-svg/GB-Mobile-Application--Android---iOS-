/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'web');
const nodeModulesDir = path.join(webDir, 'node_modules');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

async function ensureWebDependencies() {
  if (fs.existsSync(nodeModulesDir)) {
    console.log('web/node_modules already present; skipping install.');
    return;
  }

  const lockfilePath = path.join(webDir, 'package-lock.json');
  const installArgs = fs.existsSync(lockfilePath) ? ['ci'] : ['install'];

  console.log(`Installing web dependencies with npm ${installArgs.join(' ')}...`);
  await run(npmCmd, installArgs, { cwd: webDir });
}

async function startWeb() {
  await ensureWebDependencies();
  console.log('Starting Next.js dev server on http://localhost:3000 ...');
  await run(npmCmd, ['run', 'dev'], { cwd: webDir });
}

startWeb().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
