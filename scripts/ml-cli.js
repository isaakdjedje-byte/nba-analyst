#!/usr/bin/env node
/**
 * ML CLI - Command Line Interface for ML Operations
 * 
 * Usage:
 *   node scripts/ml-cli.js <command> [options]
 * 
 * Commands:
 *   install       - Install and setup ML system
 *   train         - Train a new model
 *   activate      - Activate a model
 *   fetch-data    - Fetch historical NBA data
 *   status        - Check ML system status
 *   dashboard     - Open monitoring dashboard
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  switch (type) {
    case 'success':
      console.log(`${colors.green}[${timestamp}] ✓ ${message}${colors.reset}`);
      break;
    case 'warning':
      console.log(`${colors.yellow}[${timestamp}] ⚠ ${message}${colors.reset}`);
      break;
    case 'error':
      console.log(`${colors.red}[${timestamp}] ✗ ${message}${colors.reset}`);
      break;
    default:
      console.log(`${colors.cyan}[${timestamp}] ℹ ${message}${colors.reset}`);
  }
}

function printBanner() {
  console.log(`
${colors.magenta}${colors.bright}
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║              NBA Analyst - ML Command Line Interface           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}
`);
}

function printHelp() {
  console.log(`
${colors.bright}Usage:${colors.reset} node scripts/ml-cli.js <command> [options]

${colors.bright}Commands:${colors.reset}
  install         Full ML system installation
  train           Train a new model (--start-date, --end-date, --activate)
  activate        Activate a specific model
  fetch-data      Fetch historical NBA data (--start-date, --end-date)
  status          Check system status
  dashboard       Open web dashboard (starts dev server)

${colors.bright}Examples:${colors.reset}
  node scripts/ml-cli.js install
  node scripts/ml-cli.js train --activate
  node scripts/ml-cli.js fetch-data --start-date 2023-10-01
  node scripts/ml-cli.js status

${colors.bright}Options:${colors.reset}
  --start-date <date>    Start date (YYYY-MM-DD)
  --end-date <date>      End date (YYYY-MM-DD)
  --activate             Activate model after training
  --quick                Quick mode (less data)
  --yes                  Skip confirmations
`);
}

function runTsNode(script, args = []) {
  const tsNodePath = path.join(__dirname, '..', 'node_modules', '.bin', 'ts-node');
  const projectPath = path.join(__dirname, '..', 'tsconfig.scripts.json');
  const scriptPath = path.join(__dirname, script);
  
  const cmd = `node "${tsNodePath}" --project "${projectPath}" "${scriptPath}" ${args.join(' ')}`;
  
  log(`Running: ${script}`, 'info');
  
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    return true;
  } catch (error) {
    log(`Failed to run ${script}`, 'error');
    return false;
  }
}

function checkPrerequisites() {
  log('Checking prerequisites...', 'info');
  
  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 20) {
    log(`Node.js ${nodeVersion} detected. Version 20+ required.`, 'error');
    return false;
  }
  log(`Node.js ${nodeVersion} ✓`, 'success');
  
  // Check if node_modules exists
  const fs = require('fs');
  if (!fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
    log('node_modules not found. Run: npm install', 'error');
    return false;
  }
  log('node_modules ✓', 'success');
  
  return true;
}

function checkDatabase() {
  log('Checking database...', 'info');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    log('Prisma client initialized ✓', 'success');
    return true;
  } catch (error) {
    log('Failed to initialize Prisma. Run: npx prisma generate', 'error');
    return false;
  }
}

async function install() {
  printBanner();
  
  if (!checkPrerequisites()) {
    process.exit(1);
  }
  
  if (!checkDatabase()) {
    log('Attempting to generate Prisma client...', 'warning');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      log('Prisma client generated ✓', 'success');
    } catch (error) {
      log('Failed to generate Prisma client', 'error');
      process.exit(1);
    }
  }
  
  log('Starting ML system installation...', 'info');
  log('This will:', 'info');
  log('  1. Check database tables', 'info');
  log('  2. Fetch historical NBA data', 'info');
  log('  3. Train ML model', 'info');
  log('  4. Activate the model', 'info');
  console.log();
  
  const success = runTsNode('install-ml-system.ts');
  
  if (success) {
    console.log();
    log('Installation complete!', 'success');
    log('Next steps:', 'info');
    log('  npm run dev', 'info');
    log('  Open http://localhost:3000/admin/ml', 'info');
  } else {
    log('Installation failed', 'error');
    process.exit(1);
  }
}

function train(args) {
  printBanner();
  
  if (!checkPrerequisites() || !checkDatabase()) {
    process.exit(1);
  }
  
  runTsNode('train-ml-model.ts', args);
}

function activate(args) {
  printBanner();
  
  if (!checkPrerequisites() || !checkDatabase()) {
    process.exit(1);
  }
  
  runTsNode('activate-model.ts', args);
}

function fetchData(args) {
  printBanner();
  
  if (!checkPrerequisites() || !checkDatabase()) {
    process.exit(1);
  }
  
  runTsNode('fetch-historical-data.ts', args);
}

async function status() {
  printBanner();
  
  if (!checkPrerequisites() || !checkDatabase()) {
    process.exit(1);
  }
  
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // Check tables
    const games = await prisma.$queryRaw`SELECT COUNT(*) as count FROM games`;
    const boxScores = await prisma.$queryRaw`SELECT COUNT(*) as count FROM box_scores`;
    const mlModels = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ml_models`;
    const activeModel = await prisma.$queryRaw`
      SELECT version, accuracy, algorithm 
      FROM ml_models 
      WHERE is_active = true 
      LIMIT 1
    `;
    
    console.log();
    console.log(`${colors.bright}ML System Status${colors.reset}`);
    console.log('='.repeat(50));
    console.log();
    
    console.log(`${colors.bright}Data:${colors.reset}`);
    console.log(`  Games: ${games[0]?.count || 0}`);
    console.log(`  Box Scores: ${boxScores[0]?.count || 0}`);
    console.log();
    
    console.log(`${colors.bright}Models:${colors.reset}`);
    console.log(`  Total: ${mlModels[0]?.count || 0}`);
    
    if (activeModel.length > 0) {
      console.log();
      console.log(`${colors.bright}Active Model:${colors.reset}`);
      console.log(`  Version: ${activeModel[0]?.version}`);
      console.log(`  Algorithm: ${activeModel[0]?.algorithm}`);
      console.log(`  Accuracy: ${(activeModel[0]?.accuracy * 100).toFixed(1)}%`);
      console.log(`${colors.green}  ✓ Model is active and ready for predictions${colors.reset}`);
    } else {
      console.log();
      console.log(`${colors.yellow}  ⚠ No active model found${colors.reset}`);
      console.log(`     Run: node scripts/ml-cli.js train --activate`);
    }
    
    console.log();
    console.log('='.repeat(50));
    
  } catch (error) {
    log(`Failed to fetch status: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function dashboard() {
  printBanner();
  log('Starting development server...', 'info');
  log('Dashboard will be available at: http://localhost:3000/admin/ml', 'info');
  console.log();
  
  try {
    execSync('npm run dev', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (error) {
    // Server was stopped
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === '--help' || command === '-h') {
    printBanner();
    printHelp();
    process.exit(0);
  }
  
  const remainingArgs = args.slice(1);
  
  switch (command) {
    case 'install':
      await install();
      break;
    case 'train':
      train(remainingArgs);
      break;
    case 'activate':
      activate(remainingArgs);
      break;
    case 'fetch-data':
      fetchData(remainingArgs);
      break;
    case 'status':
      await status();
      break;
    case 'dashboard':
      dashboard();
      break;
    default:
      log(`Unknown command: ${command}`, 'error');
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  log(`Unexpected error: ${error.message}`, 'error');
  process.exit(1);
});
