#!/usr/bin/env python3
"""
Benchmark Python V3 Models

Loads sklearn GradientBoosting models and returns predictions via JSON
Usage:
    python scripts/benchmark-python-v3.py < benchmark-input.json
    
Input JSON format:
    {
        "model_type": "global" | "2025",
        "games": [
            {
                "game_id": "...",
                "features": {
                    "elo_diff": 150.0,
                    "elo_diff_norm": 0.6875,
                    ...
                },
                "home_won": true
            }
        ]
    }

Output JSON format:
    {
        "model_type": "global",
        "predictions": [...],
        "probabilities": [...],
        "metrics": {
            "accuracy": 0.65,
            "precision": 0.68,
            "recall": 0.72,
            "f1": 0.70,
            "auc": 0.71,
            "log_loss": 0.62
        },
        "latency_ms": 45.2
    }
"""

import sys
import json
import time
import numpy as np
import joblib
from pathlib import Path
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, log_loss

def find_latest_model(model_type):
    """Find the latest model file for given type"""
    models_dir = Path('./models')
    pattern = f'nba_model_v3_{model_type}_*.joblib'
    files = sorted(models_dir.glob(pattern), key=lambda x: x.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError(f"No model found for type: {model_type}")
    return files[0]

def find_latest_scaler(model_type):
    """Find the latest scaler file for given type"""
    models_dir = Path('./models')
    pattern = f'scaler_v3_{model_type}_*.joblib'
    files = sorted(models_dir.glob(pattern), key=lambda x: x.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError(f"No scaler found for type: {model_type}")
    return files[0]

def load_model_and_scaler(model_type):
    """Load model and scaler from joblib files"""
    model_path = find_latest_model(model_type)
    scaler_path = find_latest_scaler(model_type)
    
    print(f"Loading model: {model_path.name}", file=sys.stderr)
    print(f"Loading scaler: {scaler_path.name}", file=sys.stderr)
    
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    
    return model, scaler

def prepare_features(game_data):
    """Extract features in correct order"""
    feature_order = [
        'elo_diff',
        'elo_diff_norm',
        'home_last10_wins',
        'away_last10_wins',
        'spread_num',
        'over_under',
        'ml_home_prob',
        'ml_away_prob',
        'rest_days_home',
        'rest_days_away',
        'season_norm'
    ]
    
    features = []
    for game in game_data['games']:
        row = [game['features'][f] for f in feature_order]
        features.append(row)
    
    return np.array(features)

def calculate_metrics(y_true, y_pred, y_proba):
    """Calculate all metrics"""
    y_true_binary = np.array([1 if y else 0 for y in y_true])
    
    return {
        'accuracy': accuracy_score(y_true_binary, y_pred),
        'precision': float(precision_score(y_true_binary, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true_binary, y_pred, zero_division=0)),
        'f1': float(f1_score(y_true_binary, y_pred, zero_division=0)),
        'auc': roc_auc_score(y_true_binary, y_proba),
        'log_loss': log_loss(y_true_binary, np.column_stack([1 - y_proba, y_proba]))
    }

def main():
    start_time = time.time()
    
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}), file=sys.stdout)
        sys.exit(1)
    
    model_type = input_data.get('model_type', 'global')
    games = input_data.get('games', [])
    
    if not games:
        print(json.dumps({"error": "No games provided"}), file=sys.stdout)
        sys.exit(1)
    
    # Load model
    try:
        model, scaler = load_model_and_scaler(model_type)
    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}), file=sys.stdout)
        sys.exit(1)
    
    # Prepare features
    X = prepare_features(input_data)
    
    # Scale features
    X_scaled = scaler.transform(X)
    
    # Make predictions
    prediction_start = time.time()
    predictions = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)[:, 1]
    prediction_time = (time.time() - prediction_start) * 1000  # ms
    
    # Calculate metrics
    y_true = [game['home_won'] for game in games]
    metrics = calculate_metrics(y_true, predictions, probabilities)
    
    # Prepare output
    total_time = (time.time() - start_time) * 1000
    
    output = {
        'model_type': model_type,
        'model_file': find_latest_model(model_type).name,
        'num_games': len(games),
        'predictions': predictions.tolist(),
        'probabilities': probabilities.tolist(),
        'metrics': {k: round(v, 4) for k, v in metrics.items()},
        'latency_ms': {
            'total': round(total_time, 2),
            'prediction_only': round(prediction_time, 2)
        }
    }
    
    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
