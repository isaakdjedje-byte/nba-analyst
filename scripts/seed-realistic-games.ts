/**
 * Seed Real Games
 *
 * Pulls real historical NBA data from ESPN and stores it in Postgres.
 * This replaces the old synthetic game generator.
 *
 * Usage:
 *   npx tsx scripts/seed-realistic-games.ts --start-date 2023-10-24 --end-date 2024-04-14
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

function parseArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return fallback;
}

async function main(): Promise<void> {
  const startDate = parseArg('--start-date', '2023-10-24');
  const endDate = parseArg('--end-date', '2024-04-14');

  console.log('Syncing real NBA games from ESPN...');
  console.log(`Range: ${startDate} -> ${endDate}`);

  const scriptPath = path.join(process.cwd(), 'scripts', 'fetch-real-nba-data.js');
  const child = spawn('node', [scriptPath, '--start-date', startDate, '--end-date', endDate], {
    stdio: 'inherit',
    shell: false,
  });

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`fetch-real-nba-data.js exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });

  console.log('Done: only real games were ingested.');
}

main().catch((error) => {
  console.error('Failed to seed real games:', error);
  process.exit(1);
});
