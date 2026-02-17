#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const scriptsDir = path.join(rootDir, 'scripts');
const packageJsonPath = path.join(rootDir, 'package.json');
const governanceDocPath = path.join(rootDir, 'docs', 'ml-canonical-workflow.md');

const trackedTrainingScripts = new Set([
  'train-ml-model.ts',
  'train-ml-model-full.ts',
  'train-ml-model.py',
  'train-ml-model-v2.py',
  'train-ml-model-v3.py',
  'ml-legacy-wrapper.js',
]);

const requiredScriptCommands = {
  'ml': 'node scripts/ml-cli.js',
  'ml:train': 'npm run ml train -- --activate',
  'ml:legacy:train-py': 'node scripts/ml-legacy-wrapper.js train-ml-model.py',
  'ml:legacy:train-v2': 'node scripts/ml-legacy-wrapper.js train-ml-model-v2.py',
  'ml:legacy:train-v3': 'node scripts/ml-legacy-wrapper.js train-ml-model-v3.py',
};

function fail(message) {
  console.error(`ML governance check failed: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run() {
  if (!fs.existsSync(scriptsDir)) {
    fail('scripts directory is missing');
  }

  if (!fs.existsSync(packageJsonPath)) {
    fail('package.json is missing');
  }

  if (!fs.existsSync(governanceDocPath)) {
    fail('docs/ml-canonical-workflow.md is missing');
  }

  const packageJson = readJson(packageJsonPath);
  const npmScripts = packageJson.scripts || {};
  const governanceDoc = fs.readFileSync(governanceDocPath, 'utf8');

  for (const [key, expected] of Object.entries(requiredScriptCommands)) {
    if (npmScripts[key] !== expected) {
      fail(`package.json script '${key}' must be exactly: ${expected}`);
    }
  }

  const scriptFiles = fs.readdirSync(scriptsDir);
  const trainingScripts = scriptFiles.filter((name) => /^train-ml-model.*\.(py|ts)$/.test(name));

  for (const scriptName of trainingScripts) {
    if (!trackedTrainingScripts.has(scriptName)) {
      fail(`new training script '${scriptName}' detected. Update governance allowlist and docs before merge.`);
    }
  }

  for (const scriptName of trackedTrainingScripts) {
    if (!scriptFiles.includes(scriptName)) {
      fail(`tracked training script '${scriptName}' is missing from scripts/`);
    }

    if (!governanceDoc.includes(scriptName)) {
      fail(`governance doc must reference '${scriptName}'`);
    }
  }

  console.log('ML governance check passed.');
}

run();
