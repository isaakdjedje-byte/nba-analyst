/**
 * XGBoost Model Implementation
 * 
 * Gradient Boosted Decision Trees for NBA game prediction.
 * Implements a simplified XGBoost algorithm in TypeScript.
 * 
 * Algorithm:
 * 1. Initialize predictions with base score (log odds)
 * 2. For each iteration:
 *    - Compute gradients and Hessians
 *    - Build decision tree on residuals
 *    - Update predictions
 * 3. Combine trees with learning rate
 */

import { ModelFeatures } from '@/server/ml/features/types';

// =============================================================================
// TYPES
// =============================================================================

export interface XGBoostConfig {
  nEstimators: number;        // Number of boosting rounds (trees)
  maxDepth: number;           // Max tree depth
  learningRate: number;       // Learning rate (eta)
  subsample: number;          // Row subsample ratio
  colsampleByTree: number;    // Column subsample ratio
  minChildWeight: number;     // Min sum of Hessian in leaf
  regAlpha: number;           // L1 regularization
  regLambda: number;          // L2 regularization
  gamma: number;              // Min loss reduction for split
  earlyStoppingRounds: number; // Stop if no improvement
}

export interface TreeNode {
  isLeaf: boolean;
  featureIndex?: number;
  threshold?: number;
  leftChild?: TreeNode;
  rightChild?: TreeNode;
  value?: number;             // Leaf value (log odds)
  gain?: number;              // Split gain
  cover?: number;             // Sum of Hessians
}

export interface XGBoostModelState {
  config: XGBoostConfig;
  trees: TreeNode[];
  baseScore: number;
  featureNames: string[];
  featureImportance: number[];
}

export interface TrainingExample {
  features: ModelFeatures;
  label: number; // 1 if home won, 0 if away won
  weight?: number;
}

export interface PredictionResult {
  homeWinProbability: number;
  awayWinProbability: number;
  confidence: number;
  predictedWinner: 'HOME' | 'AWAY';
  featureContributions: Record<string, number>;
}

export interface TrainingResult {
  iterations: number;
  trainLosses: number[];
  valLosses: number[];
  bestIteration: number;
  featureImportance: Record<string, number>;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_XGBOOST_CONFIG: XGBoostConfig = {
  nEstimators: 100,
  maxDepth: 4,
  learningRate: 0.1,
  subsample: 0.8,
  colsampleByTree: 0.8,
  minChildWeight: 1,
  regAlpha: 0.1,
  regLambda: 1.0,
  gamma: 0.1,
  earlyStoppingRounds: 10,
};

// =============================================================================
// XGBOOST MODEL
// =============================================================================

export class XGBoostModel {
  private config: XGBoostConfig;
  private trees: TreeNode[] = [];
  private baseScore: number = 0;
  private featureNames: string[] = [];
  private featureImportance: number[] = [];

  constructor(config: Partial<XGBoostConfig> = {}) {
    this.config = { ...DEFAULT_XGBOOST_CONFIG, ...config };
  }

  /**
   * Extract feature vector from ModelFeatures
   */
  private extractFeatureVector(features: ModelFeatures): { vector: number[]; names: string[] } {
    const vector: number[] = [];
    const names: string[] = [];

    const addFeature = (name: string, value: number | undefined) => {
      if (value !== undefined) {
        vector.push(value);
        names.push(name);
      }
    };

    // Home team features
    addFeature('homeWinRate', features.homeWinRate);
    addFeature('homeOffensiveRating', features.homeOffensiveRating);
    addFeature('homeDefensiveRating', features.homeDefensiveRating);
    addFeature('homeForm', features.homeForm);
    addFeature('homeRestAdvantage', features.homeRestAdvantage);

    // Away team features
    addFeature('awayWinRate', features.awayWinRate);
    addFeature('awayOffensiveRating', features.awayOffensiveRating);
    addFeature('awayDefensiveRating', features.awayDefensiveRating);
    addFeature('awayForm', features.awayForm);

    // Matchup features
    addFeature('homeAdvantage', features.homeAdvantage);
    addFeature('h2hAdvantage', features.h2hAdvantage);
    addFeature('matchupStrength', features.matchupStrength);

    // Context
    addFeature('isBackToBack', features.isBackToBack);
    addFeature('daysRestDiff', features.daysRestDiff);
    addFeature('isPlayoff', features.isPlayoff);

    // Optional market features
    addFeature('spreadDiff', features.spreadDiff);
    addFeature('publicBettingPercent', features.publicBettingPercent);

    return { vector, names };
  }

  /**
   * Sigmoid function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  /**
   * Log loss
   */
  private logLoss(pred: number, label: number): number {
    const epsilon = 1e-15;
    const p = Math.max(epsilon, Math.min(1 - epsilon, pred));
    return -label * Math.log(p) - (1 - label) * Math.log(1 - p);
  }

  /**
   * Train the model
   */
  train(
    trainExamples: TrainingExample[],
    valExamples?: TrainingExample[]
  ): TrainingResult {
    if (trainExamples.length === 0) {
      throw new Error('Cannot train on empty dataset');
    }

    // Initialize
    const { names } = this.extractFeatureVector(trainExamples[0].features);
    this.featureNames = names;
    this.featureImportance = new Array(names.length).fill(0);
    
    // Base score (log odds)
    const positiveRatio = trainExamples.filter(e => e.label === 1).length / trainExamples.length;
    this.baseScore = Math.log(positiveRatio / (1 - positiveRatio + 1e-10));

    const trainLosses: number[] = [];
    const valLosses: number[] = [];
    let bestValLoss = Infinity;
    let bestIteration = 0;
    let roundsWithoutImprovement = 0;

    // Current predictions (in log odds space)
    const trainPreds = new Array(trainExamples.length).fill(this.baseScore);
    const valPreds = valExamples ? new Array(valExamples.length).fill(this.baseScore) : null;

    // Boosting iterations
    for (let iteration = 0; iteration < this.config.nEstimators; iteration++) {
      // Build tree on residuals
      const tree = this.buildTree(trainExamples, trainPreds);
      this.trees.push(tree);

      // Update predictions
      for (let i = 0; i < trainExamples.length; i++) {
        const { vector } = this.extractFeatureVector(trainExamples[i].features);
        const leafValue = this.predictTree(tree, vector);
        trainPreds[i] += this.config.learningRate * leafValue;
      }

      // Calculate losses
      const trainLoss = this.calculateLoss(trainPreds, trainExamples);
      trainLosses.push(trainLoss);

      if (valExamples && valPreds) {
        for (let i = 0; i < valExamples.length; i++) {
          const { vector } = this.extractFeatureVector(valExamples[i].features);
          const leafValue = this.predictTree(tree, vector);
          valPreds[i] += this.config.learningRate * leafValue;
        }
        const valLoss = this.calculateLoss(valPreds, valExamples);
        valLosses.push(valLoss);

        // Early stopping
        if (valLoss < bestValLoss) {
          bestValLoss = valLoss;
          bestIteration = iteration;
          roundsWithoutImprovement = 0;
        } else {
          roundsWithoutImprovement++;
          if (roundsWithoutImprovement >= this.config.earlyStoppingRounds) {
            console.log(`Early stopping at iteration ${iteration + 1}`);
            break;
          }
        }
      }
    }

    // Calculate feature importance
    const importance: Record<string, number> = {};
    for (let i = 0; i < this.featureNames.length; i++) {
      importance[this.featureNames[i]] = this.featureImportance[i];
    }

    return {
      iterations: this.trees.length,
      trainLosses,
      valLosses,
      bestIteration,
      featureImportance: importance,
    };
  }

  /**
   * Build a decision tree
   */
  private buildTree(
    examples: TrainingExample[],
    currentPreds: number[]
  ): TreeNode {
    // Subsample rows
    const sampleIndices = this.subsampleIndices(examples.length, this.config.subsample);
    
    // Subsample columns
    const { vector: sampleVector } = this.extractFeatureVector(examples[0].features);
    const featureIndices = this.subsampleIndices(sampleVector.length, this.config.colsampleByTree);

    // Compute gradients and Hessians for sampled examples
    const gradients: number[] = [];
    const hessians: number[] = [];
    
    for (const idx of sampleIndices) {
      const pred = this.sigmoid(currentPreds[idx]);
      const label = examples[idx].label;
      const weight = examples[idx].weight || 1;
      
      // Gradient of log loss: pred - label
      gradients.push((pred - label) * weight);
      // Hessian: pred * (1 - pred)
      hessians.push(pred * (1 - pred) * weight);
    }

    // Build tree recursively
    return this.buildTreeNode(
      examples,
      sampleIndices,
      featureIndices,
      gradients,
      hessians,
      currentPreds,
      0
    );
  }

  /**
   * Recursively build tree node
   */
  private buildTreeNode(
    examples: TrainingExample[],
    sampleIndices: number[],
    featureIndices: number[],
    gradients: number[],
    hessians: number[],
    currentPreds: number[],
    depth: number
  ): TreeNode {
    // Calculate sum of gradients and Hessians for this node
    const sumGrad = gradients.reduce((a, b) => a + b, 0);
    const sumHess = hessians.reduce((a, b) => a + b, 0);
    
    // Leaf value (Newton-Raphson step)
    const leafValue = -sumGrad / (sumHess + this.config.regLambda);

    // Stopping conditions
    if (depth >= this.config.maxDepth || sampleIndices.length < 2 * this.config.minChildWeight) {
      return {
        isLeaf: true,
        value: leafValue,
        cover: sumHess,
      };
    }

    // Find best split
    let bestGain = -Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;

    for (const featureIdx of featureIndices) {
      // Sort by feature value
      const sortedIndices = [...sampleIndices].sort((a, b) => {
        const { vector: vecA } = this.extractFeatureVector(examples[a].features);
        const { vector: vecB } = this.extractFeatureVector(examples[b].features);
        return vecA[featureIdx] - vecB[featureIdx];
      });

      // Try splits
      for (let i = 1; i < sortedIndices.length; i++) {
        const { vector: vecLeft } = this.extractFeatureVector(examples[sortedIndices[i - 1]].features);
        const { vector: vecRight } = this.extractFeatureVector(examples[sortedIndices[i]].features);
        
        if (vecLeft[featureIdx] === vecRight[featureIdx]) continue;

        const threshold = (vecLeft[featureIdx] + vecRight[featureIdx]) / 2;

        // Calculate gain
        let leftGrad = 0, leftHess = 0;
        let rightGrad = 0, rightHess = 0;

        for (let j = 0; j < sortedIndices.length; j++) {
          const idx = sortedIndices[j];
          if (j < i) {
            leftGrad += gradients[sampleIndices.indexOf(idx)];
            leftHess += hessians[sampleIndices.indexOf(idx)];
          } else {
            rightGrad += gradients[sampleIndices.indexOf(idx)];
            rightHess += hessians[sampleIndices.indexOf(idx)];
          }
        }

        // Gain formula with regularization
        const gain = 0.5 * (
          (leftGrad * leftGrad) / (leftHess + this.config.regLambda) +
          (rightGrad * rightGrad) / (rightHess + this.config.regLambda) -
          (sumGrad * sumGrad) / (sumHess + this.config.regLambda)
        ) - this.config.gamma;

        if (gain > bestGain && leftHess >= this.config.minChildWeight && rightHess >= this.config.minChildWeight) {
          bestGain = gain;
          bestFeature = featureIdx;
          bestThreshold = threshold;
        }
      }
    }

    // If no good split, return leaf
    if (bestGain <= 0) {
      return {
        isLeaf: true,
        value: leafValue,
        cover: sumHess,
      };
    }

    // Split data
    const leftIndices: number[] = [];
    const rightIndices: number[] = [];
    const leftGradients: number[] = [];
    const rightGradients: number[] = [];
    const leftHessians: number[] = [];
    const rightHessians: number[] = [];

    for (let i = 0; i < sampleIndices.length; i++) {
      const idx = sampleIndices[i];
      const { vector } = this.extractFeatureVector(examples[idx].features);
      
      if (vector[bestFeature] <= bestThreshold) {
        leftIndices.push(idx);
        leftGradients.push(gradients[i]);
        leftHessians.push(hessians[i]);
      } else {
        rightIndices.push(idx);
        rightGradients.push(gradients[i]);
        rightHessians.push(hessians[i]);
      }
    }

    // Update feature importance
    if (bestFeature >= 0) {
      this.featureImportance[bestFeature] += bestGain;
    }

    // Build children
    return {
      isLeaf: false,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      gain: bestGain,
      cover: sumHess,
      leftChild: this.buildTreeNode(
        examples, leftIndices, featureIndices, leftGradients, leftHessians, currentPreds, depth + 1
      ),
      rightChild: this.buildTreeNode(
        examples, rightIndices, featureIndices, rightGradients, rightHessians, currentPreds, depth + 1
      ),
    };
  }

  /**
   * Predict with a single tree
   */
  private predictTree(tree: TreeNode, features: number[]): number {
    if (tree.isLeaf) {
      return tree.value || 0;
    }

    if (tree.featureIndex === undefined || tree.threshold === undefined) {
      return tree.value || 0;
    }

    if (features[tree.featureIndex] <= tree.threshold) {
      return tree.leftChild ? this.predictTree(tree.leftChild, features) : 0;
    } else {
      return tree.rightChild ? this.predictTree(tree.rightChild, features) : 0;
    }
  }

  /**
   * Subsample indices
   */
  private subsampleIndices(total: number, ratio: number): number[] {
    const n = Math.floor(total * ratio);
    const indices = Array.from({ length: total }, (_, i) => i);
    
    // Fisher-Yates shuffle and take first n
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    return indices.slice(0, n);
  }

  /**
   * Calculate loss
   */
  private calculateLoss(preds: number[], examples: TrainingExample[]): number {
    let loss = 0;
    for (let i = 0; i < examples.length; i++) {
      const prob = this.sigmoid(preds[i]);
      loss += this.logLoss(prob, examples[i].label);
    }
    return loss / examples.length;
  }

  /**
   * Predict for a single example
   */
  predict(features: ModelFeatures): PredictionResult {
    const { vector, names } = this.extractFeatureVector(features);
    
    // Sum contributions from all trees
    let logOdds = this.baseScore;
    const featureContributions: Record<string, number> = {};
    
    for (const tree of this.trees) {
      logOdds += this.config.learningRate * this.predictTree(tree, vector);
    }

    // Calculate feature contributions (simplified)
    for (let i = 0; i < names.length; i++) {
      featureContributions[names[i]] = vector[i] * (this.featureImportance[i] || 0);
    }

    const homeWinProbability = this.sigmoid(logOdds);
    const confidence = Math.abs(homeWinProbability - 0.5) * 2;

    return {
      homeWinProbability,
      awayWinProbability: 1 - homeWinProbability,
      confidence,
      predictedWinner: homeWinProbability >= 0.5 ? 'HOME' : 'AWAY',
      featureContributions,
    };
  }

  /**
   * Get model state
   */
  getState(): XGBoostModelState {
    return {
      config: this.config,
      trees: this.trees,
      baseScore: this.baseScore,
      featureNames: this.featureNames,
      featureImportance: this.featureImportance,
    };
  }

  /**
   * Load model state
   */
  setState(state: XGBoostModelState): void {
    this.config = state.config;
    this.trees = state.trees;
    this.baseScore = state.baseScore;
    this.featureNames = state.featureNames;
    this.featureImportance = state.featureImportance;
  }

  /**
   * Get feature importance
   */
  getFeatureImportance(): Record<string, number> {
    const importance: Record<string, number> = {};
    
    // Normalize
    const total = this.featureImportance.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < this.featureNames.length; i++) {
      importance[this.featureNames[i]] = total > 0 ? this.featureImportance[i] / total : 0;
    }
    
    return importance;
  }

  /**
   * Serialize to JSON
   */
  serialize(): string {
    return JSON.stringify(this.getState());
  }

  /**
   * Deserialize from JSON
   */
  deserialize(json: string): void {
    try {
      const state = JSON.parse(json);
      this.setState(state);
    } catch (error) {
      throw new Error(`Failed to deserialize XGBoost model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createXGBoostModel(config?: Partial<XGBoostConfig>): XGBoostModel {
  return new XGBoostModel(config);
}
