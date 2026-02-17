#!/usr/bin/env ts-node
/**
 * ML System Installation Script
 * 
 * Automated setup of the complete ML pipeline.
 * Usage: npx ts-node scripts/install-ml-system.ts [--with-data]
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/server/db/client';
import { createHistoricalDataService } from '@/server/ml/data/historical-data-service';
import { createTrainingService } from '@/server/ml/training/training-service';
import { createFeatureEngineeringService } from '@/server/ml/features/feature-engineering';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}]`;
  
  switch (type) {
    case 'success':
      console.log(`${colors.green}${prefix} ✓ ${message}${colors.reset}`);
      break;
    case 'warning':
      console.log(`${colors.yellow}${prefix} ⚠ ${message}${colors.reset}`);
      break;
    case 'error':
      console.log(`${colors.red}${prefix} ✗ ${message}${colors.reset}`);
      break;
    default:
      console.log(`${colors.cyan}${prefix} ℹ ${message}${colors.reset}`);
  }
}

function printBanner() {
  console.clear();
  console.log(`
${colors.magenta}${colors.bright}
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          NBA Analyst - ML System Installation                  ║
║                                                                ║
║  Automated setup of Machine Learning prediction pipeline       ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}
`);
}

function printProgress(step: number, total: number, message: string) {
  const percentage = Math.round((step / total) * 100);
  const barLength = 30;
  const filled = Math.round((step / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(
    `${colors.dim}[${bar}]${colors.reset} ${colors.bright}${percentage}%${colors.reset} ${message}`
  );
}

async function checkPrerequisites(): Promise<boolean> {
  log('Checking prerequisites...', 'info');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 20) {
    log(`Node.js ${nodeVersion} detected. Version 20+ required.`, 'error');
    return false;
  }
  log(`Node.js ${nodeVersion} ✓`, 'success');
  
  // Check if .env exists
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    log('.env file not found', 'warning');
    log('Creating .env with default values...', 'info');
    
    const envContent = `# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nba_analyst"

# API Configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# NBA Data APIs (optional but recommended)
NBA_API_URL="https://cdn.nba.com"
ESPN_API_URL="https://site.api.espn.com/apis/site/v2/sports"

# ML Configuration
ML_DEFAULT_ALGORITHM="xgboost"
ML_MIN_TRAINING_SAMPLES="100"
`;
    writeFileSync(envPath, envContent);
    log('.env file created. Please update with your actual values.', 'warning');
  } else {
    log('.env file ✓', 'success');
  }
  
  return true;
}

async function setupDatabase(): Promise<boolean> {
  log('Setting up database...', 'info');
  
  try {
    // Generate Prisma client
    log('Generating Prisma client...', 'info');
    execSync('npx prisma generate', { stdio: 'inherit' });
    log('Prisma client generated ✓', 'success');
    
    // Check if migrations are needed
    log('Checking database status...', 'info');
    
    // Test connection
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    log('Database connection ✓', 'success');
    
    return true;
  } catch (error) {
    log(`Database setup failed: ${error}`, 'error');
    return false;
  }
}

async function checkTables(): Promise<{
  games: number;
  boxScores: number;
  mlModels: number;
  featureStore: number;
}> {
  try {
    const games = await prisma.$queryRaw`SELECT COUNT(*) as count FROM games`;
    const boxScores = await prisma.$queryRaw`SELECT COUNT(*) as count FROM box_scores`;
    const mlModels = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ml_models`;
    const featureStore = await prisma.$queryRaw`SELECT COUNT(*) as count FROM feature_store`;
    
    return {
      games: parseInt((games as any)[0]?.count || 0),
      boxScores: parseInt((boxScores as any)[0]?.count || 0),
      mlModels: parseInt((mlModels as any)[0]?.count || 0),
      featureStore: parseInt((featureStore as any)[0]?.count || 0),
    };
  } catch (error) {
    // Tables might not exist yet
    return { games: 0, boxScores: 0, mlModels: 0, featureStore: 0 };
  }
}

async function fetchHistoricalData(): Promise<boolean> {
  log('Fetching historical NBA data...', 'info');
  
  const dataService = createHistoricalDataService();
  const stats = await dataService.getTrainingStats();
  
  if (stats.totalGames >= 100) {
    log(`Found ${stats.totalGames} games in database ✓`, 'success');
    return true;
  }
  
  log(`Only ${stats.totalGames} games found. Need at least 100.`, 'warning');
  log('Fetching data from APIs...', 'info');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6); // Last 6 months
    
    let lastProgress = 0;
    const result = await dataService.fetchHistoricalGames(
      {
        startDate,
        endDate,
        onlyCompleted: true,
      },
      (progress) => {
        if (progress.fetchedGames > lastProgress) {
          printProgress(
            progress.fetchedGames,
            progress.totalGames,
            `Fetched ${progress.fetchedGames}/${progress.totalGames} games`
          );
          lastProgress = progress.fetchedGames;
        }
      }
    );
    
    console.log(); // New line after progress
    log(`Fetched ${result.gamesFetched} games ✓`, 'success');
    
    return result.gamesFetched >= 100;
  } catch (error) {
    log(`Failed to fetch data: ${error}`, 'error');
    return false;
  }
}

async function trainModel(): Promise<boolean> {
  log('Training ML model...', 'info');
  
  const featureService = createFeatureEngineeringService();
  const trainingService = createTrainingService(featureService);
  
  // Check if we already have an active model
  const existingModel = await prisma.$queryRaw`
    SELECT id FROM ml_models WHERE is_active = true LIMIT 1
  `;
  
  if ((existingModel as any[]).length > 0) {
    log('Active model already exists', 'warning');
    const shouldRetrain = process.argv.includes('--retrain');
    if (!shouldRetrain) {
      log('Skipping training. Use --retrain to force retraining.', 'info');
      return true;
    }
  }
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    log('Starting training... (this may take a few minutes)', 'info');
    
    const job = await trainingService.startTraining(startDate, endDate);
    
    if (job.status === 'completed' && job.result) {
      const { modelVersion, trainingResult } = job.result;
      
      console.log();
      log('Training Complete!', 'success');
      log(`Model Version: ${modelVersion.version}`, 'info');
      log(`Algorithm: ${modelVersion.algorithm}`, 'info');
      log(`Accuracy: ${(modelVersion.metrics.accuracy * 100).toFixed(1)}%`, 'success');
      log(`AUC-ROC: ${modelVersion.metrics.auc.toFixed(3)}`, 'success');
      
      // Activate the model
      await trainingService.activateModel(modelVersion.id);
      log('Model activated ✓', 'success');
      
      return true;
    } else {
      log(`Training failed: ${job.error}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Training failed: ${error}`, 'error');
    return false;
  }
}

async function verifyInstallation(): Promise<boolean> {
  log('Verifying installation...', 'info');
  
  const stats = await checkTables();
  
  console.log();
  console.log(`${colors.bright}Installation Status:${colors.reset}`);
  console.log(`  Games: ${stats.games} ${stats.games >= 100 ? '✓' : '✗'}`);
  console.log(`  Box Scores: ${stats.boxScores} ${stats.boxScores >= 50 ? '✓' : '✗'}`);
  console.log(`  ML Models: ${stats.mlModels} ${stats.mlModels >= 1 ? '✓' : '✗'}`);
  console.log(`  Feature Store: ${stats.featureStore} entries`);
  
  // Check for active model
  const activeModel = await prisma.$queryRaw`
    SELECT version, accuracy FROM ml_models WHERE is_active = true LIMIT 1
  `;
  
  if ((activeModel as any[]).length > 0) {
    const model = (activeModel as any)[0];
    console.log(`  Active Model: ${model.version} (${(model.accuracy * 100).toFixed(1)}% accuracy) ✓`);
  } else {
    console.log(`  Active Model: None ✗`);
    return false;
  }
  
  return stats.games >= 100 && stats.mlModels >= 1;
}

async function printSummary() {
  console.log();
  console.log(`${colors.green}${colors.bright}`);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                   Installation Complete!                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  console.log();
  console.log(`${colors.bright}Next Steps:${colors.reset}`);
  console.log('  1. Start development server:');
  console.log('     npm run dev');
  console.log();
  console.log('  2. View ML Dashboard:');
  console.log('     http://localhost:3000/admin/ml');
  console.log();
  console.log('  3. Run daily predictions:');
  console.log('     npx ts-node scripts/trigger-real-daily-run.ts');
  console.log();
  console.log('  4. Monitor model performance:');
  console.log('     GET /api/admin/ml/dashboard');
  console.log();
  console.log(`${colors.dim}For more information, see docs/ML_SETUP_GUIDE.md${colors.reset}`);
  console.log();
}

async function main() {
  printBanner();
  
  const startTime = Date.now();
  const steps = 5;
  let currentStep = 0;
  
  // Step 1: Prerequisites
  currentStep++;
  printProgress(currentStep, steps, 'Checking prerequisites...');
  if (!(await checkPrerequisites())) {
    process.exit(1);
  }
  
  // Step 2: Database Setup
  currentStep++;
  printProgress(currentStep, steps, 'Setting up database...');
  if (!(await setupDatabase())) {
    process.exit(1);
  }
  
  // Step 3: Fetch Data
  currentStep++;
  printProgress(currentStep, steps, 'Fetching historical data...');
  if (!(await fetchHistoricalData())) {
    log('Insufficient data for training', 'warning');
    log('You can fetch more data later with:', 'info');
    log('  npx ts-node scripts/fetch-historical-data.ts', 'info');
  }
  
  // Step 4: Train Model
  currentStep++;
  printProgress(currentStep, steps, 'Training ML model...');
  if (!(await trainModel())) {
    log('Training failed', 'error');
    log('You can retry later with:', 'info');
    log('  npx ts-node scripts/train-ml-model.ts --activate', 'info');
  }
  
  // Step 5: Verify
  currentStep++;
  printProgress(currentStep, steps, 'Verifying installation...');
  const verified = await verifyInstallation();
  
  console.log(); // Clear progress line
  
  if (verified) {
    await printSummary();
  } else {
    log('Installation incomplete. Some components failed.', 'warning');
    log('Check the logs above for details.', 'info');
    process.exit(1);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Installation completed in ${duration}s`, 'success');
}

main().catch((error) => {
  console.error();
  log(`Unexpected error: ${error}`, 'error');
  process.exit(1);
});
