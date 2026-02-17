/**
 * Activate ML Model Script
 * 
 * Usage:
 *   npx ts-node scripts/activate-model.ts <model-id>
 * 
 * Example:
 *   npx ts-node scripts/activate-model.ts model-1234567890
 */

import { prisma } from '@/server/db/client';
import { createTrainingService } from '@/server/ml/training/training-service';
import { createFeatureEngineeringService } from '@/server/ml/features/feature-engineering';

async function activateModel(): Promise<void> {
  const modelId = process.argv[2];
  
  if (!modelId) {
    console.error('Usage: npx ts-node scripts/activate-model.ts <model-id>');
    console.error();
    console.error('Available models:');
    
    // List available models
    const models = await prisma.$queryRaw`
      SELECT id, version, algorithm, accuracy, is_active, created_at
      FROM ml_models
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    if (Array.isArray(models) && models.length > 0) {
      for (const model of models) {
        const active = model.is_active ? ' [ACTIVE]' : '';
        console.error(`  ${model.id} - v${model.version} - ${(model.accuracy * 100).toFixed(1)}%${active}`);
      }
    } else {
      console.error('  No models found. Train a model first with: npx ts-node scripts/train-ml-model.ts');
    }
    
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('NBA Analyst - Activate ML Model');
  console.log('='.repeat(60));
  console.log();
  console.log(`Activating model: ${modelId}`);
  console.log();

  // Initialize services
  const featureService = createFeatureEngineeringService();
  const trainingService = createTrainingService(featureService);

  try {
    // Verify model exists
    const model = await prisma.$queryRaw`
      SELECT id, version, algorithm, accuracy, created_at
      FROM ml_models
      WHERE id = ${modelId}
    `;

    if (!Array.isArray(model) || model.length === 0) {
      console.error('Model not found:', modelId);
      process.exit(1);
    }

    const modelData = model[0];
    console.log('Model details:');
    console.log(`  ID: ${modelData.id}`);
    console.log(`  Version: ${modelData.version}`);
    console.log(`  Algorithm: ${modelData.algorithm}`);
    console.log(`  Accuracy: ${(modelData.accuracy * 100).toFixed(2)}%`);
    console.log(`  Created: ${new Date(modelData.created_at).toISOString()}`);
    console.log();

    // Confirm activation
    console.log('Deactivating current active model (if any)...');
    
    // Activate new model
    await trainingService.activateModel(modelId);
    
    console.log();
    console.log('='.repeat(60));
    console.log('Model activated successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log('This model is now active and will be used for predictions.');
    console.log('Run "npm run daily-run" to generate predictions.');
    console.log();

  } catch (error) {
    console.error();
    console.error('Activation failed:', error);
    process.exit(1);
  }
}

activateModel().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
