# NBA Analyst - ML Architecture

## Overview

This document describes the Machine Learning architecture for NBA game predictions.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        ML PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Data Sources │───▶│   Feature    │───▶│    ML Model  │     │
│  │   (NBA CDN)  │    │ Engineering│    │  (Logistic    │     │
│  │   (ESPN API) │    │              │    │  Regression)  │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                               │                     │          │
│                               ▼                     ▼          │
│                        ┌──────────────┐    ┌──────────────┐     │
│                        │ Feature Store│    │  Prediction  │     │
│                        │   (Cache)    │    │   Service    │     │
│                        └──────────────┘    └──────────────┘     │
│                                                     │          │
│                                                     ▼          │
│                                            ┌──────────────┐     │
│                                            │   Policy     │     │
│                                            │   Engine     │     │
│                                            └──────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Feature Engineering Service

**File**: `src/server/ml/features/feature-engineering.ts`

Transforms raw NBA data into model-ready features.

#### Team Features
- Season record (wins, losses, win rate)
- Offensive stats (points, FG%, 3P%, assists, offensive rating)
- Defensive stats (points allowed, rebounds, steals, blocks, defensive rating)
- Form (last 5 games)
- Home/Away splits
- Rest days, back-to-back indicators

#### Matchup Features
- Head-to-head history
- Previous meeting results
- Average point differential

#### Context Features
- Playoff status
- Day of week, month
- Market data (spread, odds) - optional

### 2. ML Model

**File**: `src/server/ml/models/logistic-regression.ts`

Implements logistic regression with:
- Sigmoid activation
- Binary cross-entropy loss
- L2 regularization
- Gradient descent optimization

#### Model Features (Normalized -1 to 1)
```typescript
interface ModelFeatures {
  // Home team
  homeWinRate: number;
  homeOffensiveRating: number;
  homeDefensiveRating: number;
  homeForm: number;          // Last 5 games
  homeRestAdvantage: number; // Days of rest vs opponent
  
  // Away team
  awayWinRate: number;
  awayOffensiveRating: number;
  awayDefensiveRating: number;
  awayForm: number;
  
  // Matchup
  homeAdvantage: number;     // Historical home performance
  h2hAdvantage: number;      // Recent H2H results
  matchupStrength: number;   // Relative team strength
  
  // Context
  isBackToBack: number;      // 0 or 1
  daysRestDiff: number;
  isPlayoff: number;         // 0 or 1
}
```

### 3. Training Service

**File**: `src/server/ml/training/training-service.ts`

Manages the model training lifecycle:
- Fetches historical game results
- Computes features for training data
- Splits data into train/test sets
- Trains the model
- Evaluates performance metrics
- Saves model artifacts

#### Training Metrics
- **Accuracy**: Overall correct predictions
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1 Score**: Harmonic mean of precision and recall
- **Log Loss**: Cross-entropy loss
- **AUC-ROC**: Area under ROC curve
- **Calibration Error**: Expected Calibration Error (ECE)

### 4. Prediction Service

**File**: `src/server/ml/prediction/prediction-service.ts`

Makes real-time predictions for upcoming games:
- Loads active model
- Fetches historical data for feature computation
- Computes features (or uses cached)
- Runs inference
- Formats prediction output

#### Prediction Output
```typescript
interface PredictionOutput {
  matchId: string;
  prediction: {
    winner: 'HOME' | 'AWAY';
    confidence: number;        // 0-1
    homeWinProbability: number;
    awayWinProbability: number;
  };
  score: {
    predictedHomeScore: number;
    predictedAwayScore: number;
    totalPoints: number;
  };
  overUnder: {
    line: number;
    prediction: 'OVER' | 'UNDER';
    confidence: number;
  };
  model: {
    version: string;
    algorithm: string;
    featureCount: number;
    featureQuality: number;
  };
}
```

### 5. Feature Store

**Database Table**: `feature_store`

Caches computed features to:
- Reduce redundant computation
- Enable feature reuse across predictions
- Track feature freshness

## Usage

### Training a New Model

```bash
# Train with default settings (last year of data)
npx ts-node scripts/train-ml-model.ts

# Train with specific date range
npx ts-node scripts/train-ml-model.ts \
  --start-date 2023-01-01 \
  --end-date 2024-01-01 \
  --activate
```

### Activating a Model

```bash
# List available models and activate one
npx ts-node scripts/activate-model.ts model-1234567890
```

### Running Daily Predictions

The ML model is automatically used in the daily run pipeline:

```bash
npm run daily-run
```

Or programmatically:

```typescript
import { getPredictionService } from '@/server/ml/prediction/prediction-service';

const predictionService = getPredictionService();

const prediction = await predictionService.predict({
  gameId: 12345,
  homeTeamId: 1,
  awayTeamId: 2,
  homeTeamName: 'Lakers',
  awayTeamName: 'Warriors',
  scheduledAt: new Date('2024-02-20T20:00:00'),
});

console.log(prediction.prediction.winner); // 'HOME' or 'AWAY'
console.log(prediction.prediction.confidence); // 0.0 - 1.0
```

## Data Flow

### Training Pipeline

1. **Fetch Historical Games**
   - Query completed games from database
   - Filter by date range

2. **Compute Features**
   - For each game:
     - Fetch team box scores (last 20 games)
     - Fetch H2H games (last 5 meetings)
     - Compute TeamFeatures, MatchupFeatures, ContextFeatures
     - Normalize into ModelFeatures

3. **Train Model**
   - Split data (80% train, 20% test)
   - Train logistic regression
   - Monitor convergence

4. **Evaluate**
   - Calculate accuracy, precision, recall, F1
   - Compute AUC-ROC
   - Measure calibration

5. **Save Model**
   - Serialize weights
   - Store in `ml_models` table
   - Track version and metrics

### Prediction Pipeline

1. **Load Active Model**
   - Query `ml_models` table for `is_active = true`
   - Deserialize weights

2. **Fetch Historical Data**
   - Get team box scores (last 20 games)
   - Get H2H history (last 5 meetings)

3. **Compute Features**
   - Calculate all feature types
   - Normalize to -1 to 1 range
   - Validate feature quality

4. **Run Inference**
   - Apply logistic regression
   - Get probability of home win

5. **Format Output**
   - Calculate predicted scores
   - Generate over/under line
   - Include feature breakdown

## Fallback Strategy

If the ML model fails or is unavailable, the system falls back to a baseline algorithm:

```
confidence = 0.65 + home_advantage (0.08)
winner = 'HOME' (if confidence > 0.5)
```

This ensures the system continues functioning even without trained models.

## Monitoring

### Feature Quality

The feature engineering service calculates a quality score (0-1) based on:
- Data completeness (are all features present?)
- Data freshness (how recent is the data?)
- Data validity (are values within expected ranges?)

### Model Performance

Track in production:
- Prediction accuracy
- Calibration error
- Feature importance drift
- Prediction latency

## Database Schema

### ml_models

```sql
CREATE TABLE ml_models (
  id TEXT PRIMARY KEY,
  version TEXT UNIQUE NOT NULL,
  algorithm TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  training_data_start TIMESTAMP NOT NULL,
  training_data_end TIMESTAMP NOT NULL,
  num_training_samples INTEGER NOT NULL,
  num_test_samples INTEGER NOT NULL,
  accuracy FLOAT NOT NULL,
  precision FLOAT NOT NULL,
  recall FLOAT NOT NULL,
  f1_score FLOAT NOT NULL,
  log_loss FLOAT NOT NULL,
  auc FLOAT NOT NULL,
  calibration_error FLOAT NOT NULL,
  weights_hash TEXT NOT NULL,
  weights JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at TIMESTAMP,
  
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_algorithm (algorithm)
);
```

### feature_store

```sql
CREATE TABLE feature_store (
  id TEXT PRIMARY KEY,
  match_id TEXT UNIQUE NOT NULL,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  match_date TIMESTAMP NOT NULL,
  features JSONB NOT NULL,
  features_hash TEXT NOT NULL,
  freshness_score FLOAT NOT NULL,
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  data_version TEXT NOT NULL,
  
  UNIQUE INDEX idx_match_id (match_id),
  INDEX idx_match_date (match_date),
  INDEX idx_teams (home_team_id, away_team_id),
  INDEX idx_computed_at (computed_at)
);
```

## Future Enhancements

1. **Model Types**
   - XGBoost for better performance
   - Neural networks for complex patterns
   - Ensemble of multiple models

2. **Features**
   - Player-level features (injuries, form)
   - Weather conditions
   - Travel distance
   - Social media sentiment

3. **Training**
   - Online learning (update model daily)
   - Automated retraining when performance degrades
   - Hyperparameter optimization

4. **Monitoring**
   - Data drift detection
   - Model performance dashboards
   - A/B testing framework

## References

- Logistic Regression: https://en.wikipedia.org/wiki/Logistic_regression
- AUC-ROC: https://en.wikipedia.org/wiki/Receiver_operating_characteristic
- Calibration: https://en.wikipedia.org/wiki/Calibration_(statistics)
