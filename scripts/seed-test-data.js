#!/usr/bin/env node
/**
 * Seed Real Data Script
 *
 * Kept for backward compatibility with existing commands.
 * This script now ingests only real NBA data from ESPN.
 *
 * Usage: node scripts/seed-test-data.js --start-date 2023-10-24 --end-date 2024-04-14
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

function parseArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return fallback;
}

async function main() {
  const startDate = parseArg('--start-date', '2023-10-24');
  const endDate = parseArg('--end-date', '2024-04-14');

  console.log('Syncing real NBA data (legacy seed command)...');
  console.log(`Range: ${startDate} -> ${endDate}`);

  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch-real-nba-data.js');
  const child = spawn('node', [scriptPath, '--start-date', startDate, '--end-date', endDate], {
    stdio: 'inherit',
    shell: false,
  });

  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`fetch-real-nba-data.js exited with code ${code}`));
    });
    child.on('error', reject);
  });

  console.log('Done: no synthetic test data inserted.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
