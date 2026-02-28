#!/usr/bin/env node
/**
 * Legacy entrypoint for training.
 * Delegates to the real TypeScript training pipeline.
 */

const { spawn } = require('node:child_process');

function normalizeArgs(args) {
  const normalized = [];

  for (const arg of args) {
    if (arg.startsWith('--start-date=')) {
      normalized.push('--start-date', arg.slice('--start-date='.length));
      continue;
    }

    if (arg.startsWith('--end-date=')) {
      normalized.push('--end-date', arg.slice('--end-date='.length));
      continue;
    }

    normalized.push(arg);
  }

  return normalized;
}

const forwardedArgs = normalizeArgs(process.argv.slice(2));
const cmdArgs = ['tsx', 'scripts/train-ml-model.ts', ...forwardedArgs];

console.log('[train-model.js] Delegating to scripts/train-ml-model.ts');

const child = spawn('npx', cmdArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to launch training pipeline:', error);
  process.exit(1);
});
