#!/usr/bin/env node
/**
 * Import Real NBA History (2014 -> today)
 *
 * Runs season-by-season ingestion using fetch-real-nba-data.js.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

function runNodeScript(script, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script, ...args], {
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ...env },
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(script)} exited with code ${code}`));
    });
  });
}

function buildSeasonWindows(startYear = 2014) {
  const now = new Date();
  const windows = [];

  for (let y = startYear; y <= now.getUTCFullYear(); y++) {
    const start = `${y}-10-01`;
    const endYear = y + 1;
    const seasonEnd = `${endYear}-06-30`;
    const seasonEndDate = new Date(`${seasonEnd}T23:59:59.000Z`);
    const end = seasonEndDate > now ? now.toISOString().slice(0, 10) : seasonEnd;
    if (new Date(`${start}T00:00:00.000Z`) <= new Date(`${end}T23:59:59.000Z`)) {
      windows.push({ start, end });
    }
  }

  return windows;
}

async function main() {
  const fetchScript = path.join(process.cwd(), 'scripts', 'fetch-real-nba-data.js');
  const windows = buildSeasonWindows(2014);

  console.log(`Importing ${windows.length} seasons of real data...`);
  for (const [index, window] of windows.entries()) {
    console.log(`\n[${index + 1}/${windows.length}] ${window.start} -> ${window.end}`);
    await runNodeScript(fetchScript, ['--start-date', window.start, '--end-date', window.end], {
      RATE_LIMIT_MS: process.env.RATE_LIMIT_MS || '120',
    });
  }

  console.log('\nDone importing real historical seasons.');
}

main().catch((error) => {
  console.error('Historical import failed:', error);
  process.exit(1);
});
