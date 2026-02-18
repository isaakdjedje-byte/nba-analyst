/**
 * Legacy entrypoint kept for backward compatibility.
 *
 * This script now delegates to the real training pipeline.
 * No synthetic metrics are produced.
 */

import { spawn } from 'child_process';

function normalizeArgs(args: string[]): string[] {
  const normalized: string[] = [];

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

async function main(): Promise<void> {
  const forwardedArgs = normalizeArgs(process.argv.slice(2));
  const commandArgs = ['tsx', 'scripts/train-ml-model.ts', ...forwardedArgs];

  console.log('[train-ml-model-full] Delegating to real training pipeline...');

  const child = spawn('npx', commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('Failed to launch real training pipeline:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
