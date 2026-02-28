/**
 * ML Model Training Script
 * 
 * Usage:
 *   npx ts-node scripts/train-ml-model.ts [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]
 * 
 * Example:
 *   npx ts-node scripts/train-ml-model.ts --start-date 2023-01-01 --end-date 2024-01-01
 */

import { createFeatureEngineeringService } from '@/server/ml/features/feature-engineering';
import { createTrainingService, DEFAULT_TRAINING_CONFIG } from '@/server/ml/training/training-service';

interface TrainOptions {
  startDate: Date;
  endDate: Date;
  activate: boolean;
  algorithm?: 'logistic-regression' | 'xgboost' | 'auto';
}

function parseArgs(): TrainOptions {
  const args = process.argv.slice(2);
  const options: TrainOptions = {
    startDate: new Date('2014-10-01T00:00:00.000Z'), // Default: full historical window
    endDate: new Date(), // Default: now
    activate: false,
    algorithm: 'auto',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start-date':
        options.startDate = new Date(args[++i]);
        break;
      case '--end-date':
        options.endDate = new Date(args[++i]);
        break;
      case '--activate':
        options.activate = true;
        break;
      case '--algorithm': {
        const value = args[++i] as TrainOptions['algorithm'];
        if (value === 'logistic-regression' || value === 'xgboost' || value === 'auto') {
          options.algorithm = value;
        }
        break;
      }
    }
  }

  return options;
}

async function trainModel(): Promise<void> {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('NBA Analyst - ML Model Training');
  console.log('='.repeat(60));
  console.log();
  console.log('Configuration:');
  console.log(`  Start Date: ${options.startDate.toISOString().split('T')[0]}`);
  console.log(`  End Date: ${options.endDate.toISOString().split('T')[0]}`);
  console.log(`  Auto-activate: ${options.activate}`);
  console.log(`  Algorithm: ${options.algorithm}`);
  console.log(`  Learning Rate: ${DEFAULT_TRAINING_CONFIG.learningRate}`);
  console.log(`  Max Iterations: ${DEFAULT_TRAINING_CONFIG.maxIterations}`);
  console.log(`  Min Training Samples: ${DEFAULT_TRAINING_CONFIG.minTrainingSamples}`);
  console.log();
  console.log('='.repeat(60));
  console.log();

  // Initialize services
  const featureService = createFeatureEngineeringService();
  const trainingServiceWithAlgo = createTrainingService(featureService, {
    algorithm: options.algorithm,
  });

  // Set up progress monitoring
    // Simple progress logging without stdout manipulation
    let lastProgress = 0;
    const progressInterval = setInterval(() => {
      const job = trainingServiceWithAlgo.getJobStatus();
      if (job && job.status === 'running' && job.progress.current !== lastProgress) {
        lastProgress = job.progress.current;
        console.log(`Progress: Step ${job.progress.current}/${job.progress.total} - ${job.progress.currentStep}`);
      }
    }, 1000);

  try {
    // Start training
    console.log('Starting training job...');
    console.log();

    const job = await trainingServiceWithAlgo.startTraining(options.startDate, options.endDate);

    clearInterval(progressInterval);
    console.log();

    if (job.status === 'completed' && job.result) {
      const { modelVersion, trainingResult } = job.result;

      console.log('='.repeat(60));
      console.log('Training Complete!');
      console.log('='.repeat(60));
      console.log();
      console.log('Model Version:');
      console.log(`  ID: ${modelVersion.id}`);
      console.log(`  Version: ${modelVersion.version}`);
      console.log(`  Algorithm: ${modelVersion.algorithm}`);
      console.log(`  Created: ${modelVersion.createdAt.toISOString()}`);
      console.log();
      console.log('Training Stats:');
      console.log(`  Selected Algorithm: ${job.result.selectedAlgorithm}`);
      if ('converged' in trainingResult) {
        console.log(`  Iterations: ${trainingResult.iterations}`);
        console.log(`  Converged: ${trainingResult.converged ? 'Yes' : 'No'}`);
        console.log(`  Final Loss: ${trainingResult.finalLoss.toFixed(6)}`);
        console.log(`  Training Accuracy: ${(trainingResult.accuracy * 100).toFixed(2)}%`);
      } else {
        console.log(`  Iterations: ${trainingResult.iterations}`);
        const bestVal = trainingResult.valLosses.length > 0
          ? Math.min(...trainingResult.valLosses)
          : Math.min(...trainingResult.trainLosses);
        console.log(`  Best Validation Loss: ${bestVal.toFixed(6)}`);
      }
      console.log();
      console.log('Test Metrics:');
      console.log(`  Accuracy: ${(modelVersion.metrics.accuracy * 100).toFixed(2)}%`);
      console.log(`  Precision: ${(modelVersion.metrics.precision * 100).toFixed(2)}%`);
      console.log(`  Recall: ${(modelVersion.metrics.recall * 100).toFixed(2)}%`);
      console.log(`  F1 Score: ${modelVersion.metrics.f1Score.toFixed(4)}`);
      console.log(`  Log Loss: ${modelVersion.metrics.logLoss.toFixed(6)}`);
      console.log(`  AUC-ROC: ${modelVersion.metrics.auc.toFixed(4)}`);
      console.log(`  Calibration Error: ${modelVersion.metrics.calibrationError.toFixed(4)}`);
      console.log();

      if (options.activate) {
        console.log('Activating model...');
        await trainingServiceWithAlgo.activateModel(modelVersion.id);
        console.log('Model activated successfully!');
        console.log();
        console.log('The model is now active and will be used for predictions.');
      } else {
        console.log('To activate this model, run:');
        console.log(`  npx ts-node scripts/activate-model.ts ${modelVersion.id}`);
      }

      console.log();
      console.log('='.repeat(60));
    } else {
      console.error('Training failed:', job.error);
      process.exit(1);
    }
  } catch (error) {
    clearInterval(progressInterval);
    console.error();
    console.error('Training failed:', error);
    process.exit(1);
  }
}

trainModel().then(() => {
  console.log();
  console.log('Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
