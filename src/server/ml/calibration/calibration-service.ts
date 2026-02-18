/**
 * Calibration Service
 * 
 * Post-training calibration using Platt scaling and Isotonic regression.
 * Improves probability reliability without changing predictions.
 */

import { ModelFeatures } from '@/server/ml/features/types';

export interface CalibrationParams {
  method: 'platt' | 'isotonic';
  temperature?: number; // For temperature scaling
}

export interface CalibratedModel {
  basePredict: (features: ModelFeatures) => { homeWinProbability: number };
  calibrate: (rawProb: number) => number;
  params: PlattParams | IsotonicParams;
}

interface PlattParams {
  method: 'platt';
  a: number;
  b: number;
}

interface IsotonicParams {
  method: 'isotonic';
  thresholds: number[]; // Sorted x values
  calibrated: number[]; // Corresponding calibrated y values
}

/**
 * Platt Scaling (Sigmoid Calibration)
 * Fits a sigmoid: p_calibrated = 1 / (1 + exp(a * p_raw + b))
 */
function trainPlattScaling(
  predictions: { prob: number; actual: number }[]
): PlattParams {
  // Implementation of Platt scaling using Newton-Raphson
  // Simplified: use gradient descent on validation set
  
  let a = 0;
  let b = 0;
  const learningRate = 0.1;
  const iterations = 100;
  
  for (let iter = 0; iter < iterations; iter++) {
    let gradA = 0;
    let gradB = 0;
    
    for (const { prob, actual } of predictions) {
      // Sigmoid: p = 1 / (1 + exp(-z)) where z = a*prob + b
      const z = a * prob + b;
      const pCalibrated = 1 / (1 + Math.exp(-z));
      const error = pCalibrated - actual;
      
      // Gradients
      gradA += error * prob * pCalibrated * (1 - pCalibrated);
      gradB += error * pCalibrated * (1 - pCalibrated);
    }
    
    // Average gradients
    gradA /= predictions.length;
    gradB /= predictions.length;
    
    // Update
    a -= learningRate * gradA;
    b -= learningRate * gradB;
  }
  
  return { method: 'platt', a, b };
}

function applyPlattScaling(prob: number, params: PlattParams): number {
  const z = params.a * prob + params.b;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Isotonic Regression (Piecewise constant calibration)
 * Fits a monotonic piecewise constant function
 */
function trainIsotonicRegression(
  predictions: { prob: number; actual: number }[]
): IsotonicParams {
  // Sort by raw probability
  const sorted = [...predictions].sort((a, b) => a.prob - b.prob);
  
  // PAVA (Pool Adjacent Violators Algorithm)
  // Simplified: bucket into 10 bins and compute average actual for each
  const numBins = 10;
  const bins: { sum: number; count: number; avg: number }[] = [];
  
  for (let i = 0; i < numBins; i++) {
    const startIdx = Math.floor((i * sorted.length) / numBins);
    const endIdx = Math.floor(((i + 1) * sorted.length) / numBins);
    
    let sum = 0;
    let count = 0;
    for (let j = startIdx; j < endIdx && j < sorted.length; j++) {
      sum += sorted[j].actual;
      count++;
    }
    
    bins.push({
      sum,
      count,
      avg: count > 0 ? sum / count : i / numBins,
    });
  }
  
  // Ensure monotonicity
  for (let i = 1; i < bins.length; i++) {
    if (bins[i].avg < bins[i - 1].avg) {
      // Pool
      const pooledAvg = (bins[i - 1].sum + bins[i].sum) / (bins[i - 1].count + bins[i].count);
      bins[i - 1].avg = pooledAvg;
      bins[i].avg = pooledAvg;
    }
  }
  
  // Build lookup table
  const thresholds: number[] = [];
  const calibrated: number[] = [];
  
  for (let i = 0; i < numBins; i++) {
    const threshold = (i + 1) / numBins;
    thresholds.push(threshold);
    calibrated.push(bins[i].avg);
  }
  
  return { method: 'isotonic', thresholds, calibrated };
}

function applyIsotonicRegression(prob: number, params: IsotonicParams): number {
  // Find the bucket
  for (let i = 0; i < params.thresholds.length; i++) {
    if (prob <= params.thresholds[i]) {
      return params.calibrated[i];
    }
  }
  return params.calibrated[params.calibrated.length - 1];
}

/**
 * Expected Calibration Error (ECE)
 */
export function calculateECE(
  predictions: { prob: number; actual: number }[],
  numBins: number = 10
): number {
  const bins = new Array(numBins).fill(0).map(() => ({ count: 0, sumProb: 0, sumActual: 0 }));
  
  for (const pred of predictions) {
    const binIdx = Math.min(Math.floor(pred.prob * numBins), numBins - 1);
    bins[binIdx].count++;
    bins[binIdx].sumProb += pred.prob;
    bins[binIdx].sumActual += pred.actual;
  }
  
  let ece = 0;
  const total = predictions.length;
  
  for (const bin of bins) {
    if (bin.count > 0) {
      const avgProb = bin.sumProb / bin.count;
      const avgActual = bin.sumActual / bin.count;
      ece += (bin.count / total) * Math.abs(avgProb - avgActual);
    }
  }
  
  return ece;
}

/**
 * Calibrate a model's probabilities
 */
export function calibrateModel(
  predictions: { prob: number; actual: number }[],
  method: 'platt' | 'isotonic' = 'platt'
): CalibratedModel {
  const params = method === 'platt' 
    ? trainPlattScaling(predictions)
    : trainIsotonicRegression(predictions);
  
  return {
    basePredict: (_features: ModelFeatures) => ({ homeWinProbability: 0.5 }), // Placeholder
    calibrate: (rawProb: number) => {
      if (method === 'platt') {
        return applyPlattScaling(rawProb, params as PlattParams);
      } else {
        return applyIsotonicRegression(rawProb, params as IsotonicParams);
      }
    },
    params,
  };
}

/**
 * Evaluate calibration before and after
 */
export function evaluateCalibration(
  rawPredictions: { prob: number; actual: number }[],
  calibratedPredictions: { prob: number; actual: number }[]
): {
  before: { ece: number; reliability: number };
  after: { ece: number; reliability: number };
  improvement: number;
} {
  const beforeECE = calculateECE(rawPredictions);
  const afterECE = calculateECE(calibratedPredictions);
  
  // Reliability: 1 - ECE (higher is better)
  const beforeRel = 1 - beforeECE;
  const afterRel = 1 - afterECE;
  
  return {
    before: { ece: beforeECE, reliability: beforeRel },
    after: { ece: afterECE, reliability: afterRel },
    improvement: (afterRel - beforeRel) / beforeRel,
  };
}

export function applyCalibrationToPrediction(
  rawProb: number,
  calibration: CalibrationParams & { params: PlattParams | IsotonicParams }
): number {
  if (calibration.method === 'platt') {
    return applyPlattScaling(rawProb, calibration.params as PlattParams);
  } else {
    return applyIsotonicRegression(rawProb, calibration.params as IsotonicParams);
  }
}
