#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const script = process.argv[2];
const passthroughArgs = process.argv.slice(3);

if (!script) {
  console.error('Missing legacy script path.');
  process.exit(1);
}

if (process.env.LEGACY_ML_SCRIPTS !== 'true') {
  console.error('Legacy ML scripts are disabled by default.');
  console.error('Set LEGACY_ML_SCRIPTS=true to run this command intentionally.');
  process.exit(1);
}

const scriptPath = path.resolve(__dirname, script);
const result = spawnSync('python', [scriptPath, ...passthroughArgs], {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
