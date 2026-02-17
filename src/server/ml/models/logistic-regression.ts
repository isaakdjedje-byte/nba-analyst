/**
 * Logistic Regression Model
 * 
 * Simple logistic regression implementation for NBA game prediction.
 * Predicts probability of home team winning.
 */

import { ModelFeatures } from '@/server/ml/features/types';

// =============================================================================
// TYPES
// =============================================================================

export interface LogisticRegressionConfig {
  learningRate: number;
  maxIterations: number;
  convergenceThreshold: number;
  regularizationLambda: number; // L2 regularization
}

export interface ModelWeights {
  bias: number;
  weights: number[];
  featureNames: string[];
}

export interface TrainingExample {
  features: ModelFeatures;
  label: number; // 1 if home team won, 0 if away team won
}

export interface PredictionResult {
  homeWinProbability: number;
  awayWinProbability: number;
  confidence: number; // |prob - 0.5| * 2, 0-1
  predictedWinner: 'HOME' | 'AWAY';
  featureContributions: Record<string, number>;
}

export interface TrainingResult {
  weights: ModelWeights;
  iterations: number;
  finalLoss: number;
  accuracy: number;
  converged: boolean;
}

// =============================================================================
// LOGISTIC REGRESSION MODEL
// =============================================================================

export class LogisticRegressionModel {
  private weights: ModelWeights | null = null;
  private config: LogisticRegressionConfig;

  constructor(config: Partial<LogisticRegressionConfig> = {}) {
    this.config = {
      learningRate: 0.01,
      maxIterations: 1000,
      convergenceThreshold: 1e-6,
      regularizationLambda: 0.01,
      ...config,
    };
  }

  /**
   * Extract feature vector from ModelFeatures
   */
  private extractFeatureVector(features: ModelFeatures): { vector: number[]; names: string[] } {
    const vector: number[] = [];
    const names: string[] = [];

    // Home team features
    vector.push(features.homeWinRate);
    names.push('homeWinRate');
    
    vector.push(features.homeOffensiveRating);
    names.push('homeOffensiveRating');
    
    vector.push(features.homeDefensiveRating);
    names.push('homeDefensiveRating');
    
    vector.push(features.homeForm);
    names.push('homeForm');
    
    vector.push(features.homeRestAdvantage);
    names.push('homeRestAdvantage');

    // Away team features
    vector.push(features.awayWinRate);
    names.push('awayWinRate');
    
    vector.push(features.awayOffensiveRating);
    names.push('awayOffensiveRating');
    
    vector.push(features.awayDefensiveRating);
    names.push('awayDefensiveRating');
    
    vector.push(features.awayForm);
    names.push('awayForm');

    // Matchup features
    vector.push(features.homeAdvantage);
    names.push('homeAdvantage');
    
    vector.push(features.h2hAdvantage);
    names.push('h2hAdvantage');
    
    vector.push(features.matchupStrength);
    names.push('matchupStrength');

    // Context features
    vector.push(features.isBackToBack);
    names.push('isBackToBack');
    
    vector.push(features.daysRestDiff);
    names.push('daysRestDiff');
    
    vector.push(features.isPlayoff);
    names.push('isPlayoff');

    // Optional market features
    if (features.spreadDiff !== undefined) {
      vector.push(features.spreadDiff);
      names.push('spreadDiff');
    }
    
    if (features.publicBettingPercent !== undefined) {
      vector.push(features.publicBettingPercent);
      names.push('publicBettingPercent');
    }

    return { vector, names };
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(z: number): number {
    // Clip z to prevent overflow
    const clippedZ = Math.max(-500, Math.min(500, z));
    return 1 / (1 + Math.exp(-clippedZ));
  }

  /**
   * Predict probability for a single example
   */
  private predictProbability(features: number[]): number {
    if (!this.weights) {
      throw new Error('Model not trained. Call train() first.');
    }

    // Compute weighted sum
    let z = this.weights.bias;
    for (let i = 0; i < features.length; i++) {
      z += features[i] * this.weights.weights[i];
    }

    return this.sigmoid(z);
  }

  /**
   * Compute binary cross-entropy loss with L2 regularization
   */
  private computeLoss(examples: TrainingExample[]): number {
    if (!this.weights) return Infinity;

    let loss = 0;
    for (const example of examples) {
      const { vector } = this.extractFeatureVector(example.features);
      const prob = this.predictProbability(vector);
      
      // Binary cross-entropy with numerical stability
      const epsilon = 1e-15;
      loss -= example.label * Math.log(prob + epsilon) + 
              (1 - example.label) * Math.log(1 - prob + epsilon);
    }
    
    loss /= examples.length;

    // L2 regularization
    const regLoss = this.config.regularizationLambda * 
      this.weights.weights.reduce((sum, w) => sum + w * w, 0);
    
    return loss + regLoss;
  }

  /**
   * Compute gradients
   */
  private computeGradients(examples: TrainingExample[]): { biasGrad: number; weightGrads: number[] } {
    if (!this.weights) {
      throw new Error('Model not initialized');
    }

    const numFeatures = this.weights.weights.length;
    let biasGrad = 0;
    const weightGrads = new Array(numFeatures).fill(0);

    for (const example of examples) {
      const { vector } = this.extractFeatureVector(example.features);
      const prob = this.predictProbability(vector);
      const error = prob - example.label;

      // Update gradients
      biasGrad += error;
      for (let i = 0; i < numFeatures; i++) {
        weightGrads[i] += error * vector[i];
      }
    }

    // Average gradients
    const n = examples.length;
    const avgBiasGrad = biasGrad / n;
    const avgWeightGrads = weightGrads.map(grad => grad / n);

    // Add L2 regularization gradient (excluding bias)
    for (let i = 0; i < numFeatures; i++) {
      avgWeightGrads[i] += 2 * this.config.regularizationLambda * this.weights.weights[i];
    }

    return { biasGrad: avgBiasGrad, weightGrads: avgWeightGrads };
  }

  /**
   * Train the model
   */
  train(examples: TrainingExample[]): TrainingResult {
    if (examples.length === 0) {
      throw new Error('Cannot train on empty dataset');
    }

    // Initialize weights
    const { vector, names } = this.extractFeatureVector(examples[0].features);
    const numFeatures = vector.length;
    
    this.weights = {
      bias: 0,
      weights: new Array(numFeatures).fill(0).map(() => Math.random() * 0.01),
      featureNames: names,
    };

    let prevLoss = Infinity;
    let converged = false;
    let iteration = 0;

    // Gradient descent
    for (iteration = 0; iteration < this.config.maxIterations; iteration++) {
      // Compute gradients
      const { biasGrad, weightGrads } = this.computeGradients(examples);

      // Update weights
      this.weights.bias -= this.config.learningRate * biasGrad;
      for (let i = 0; i < numFeatures; i++) {
        this.weights.weights[i] -= this.config.learningRate * weightGrads[i];
      }

      // Check convergence every 100 iterations
      if (iteration % 100 === 0) {
        const loss = this.computeLoss(examples);
        const lossDiff = Math.abs(prevLoss - loss);
        
        if (lossDiff < this.config.convergenceThreshold) {
          converged = true;
          break;
        }
        
        prevLoss = loss;
      }
    }

    // Final evaluation
    const finalLoss = this.computeLoss(examples);
    const accuracy = this.computeAccuracy(examples);

    return {
      weights: this.weights,
      iterations: iteration + 1,
      finalLoss,
      accuracy,
      converged,
    };
  }

  /**
   * Compute accuracy on training data
   */
  private computeAccuracy(examples: TrainingExample[]): number {
    let correct = 0;
    
    for (const example of examples) {
      const { vector } = this.extractFeatureVector(example.features);
      const prob = this.predictProbability(vector);
      const prediction = prob >= 0.5 ? 1 : 0;
      
      if (prediction === example.label) {
        correct++;
      }
    }
    
    return correct / examples.length;
  }

  /**
   * Predict winner for a new game
   */
  predict(features: ModelFeatures): PredictionResult {
    if (!this.weights) {
      throw new Error('Model not trained. Call train() first.');
    }

    const { vector, names } = this.extractFeatureVector(features);
    const homeWinProbability = this.predictProbability(vector);
    const awayWinProbability = 1 - homeWinProbability;

    // Calculate confidence (distance from 0.5, scaled to 0-1)
    const confidence = Math.abs(homeWinProbability - 0.5) * 2;

    // Calculate feature contributions
    const featureContributions: Record<string, number> = {};
    for (let i = 0; i < names.length; i++) {
      featureContributions[names[i]] = vector[i] * this.weights.weights[i];
    }

    return {
      homeWinProbability,
      awayWinProbability,
      confidence,
      predictedWinner: homeWinProbability >= 0.5 ? 'HOME' : 'AWAY',
      featureContributions,
    };
  }

  /**
   * Get current weights
   */
  getWeights(): ModelWeights | null {
    return this.weights;
  }

  /**
   * Set pre-trained weights
   */
  setWeights(weights: ModelWeights): void {
    this.weights = weights;
  }

  /**
   * Get feature importance (absolute weight values)
   */
  getFeatureImportance(): Record<string, number> {
    if (!this.weights) {
      throw new Error('Model not trained');
    }

    const importance: Record<string, number> = {};
    for (let i = 0; i < this.weights.weights.length; i++) {
      importance[this.weights.featureNames[i]] = Math.abs(this.weights.weights[i]);
    }

    return importance;
  }

  /**
   * Serialize model to JSON
   */
  serialize(): string {
    if (!this.weights) {
      throw new Error('Model not trained');
    }

    return JSON.stringify({
      weights: this.weights,
      config: this.config,
    });
  }

  /**
   * Deserialize model from JSON
   */
  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.weights = data.weights;
    this.config = { ...this.config, ...data.config };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createLogisticRegressionModel(
  config?: Partial<LogisticRegressionConfig>
): LogisticRegressionModel {
  return new LogisticRegressionModel(config);
}
