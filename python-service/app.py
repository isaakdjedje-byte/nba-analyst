#!/usr/bin/env python3
"""
NBA ML Python V3 Service
FastAPI microservice for Python sklearn models
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import joblib
import numpy as np
from pathlib import Path
import uvicorn

app = FastAPI(title="NBA ML V3 Service", version="3.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models at startup
MODELS = {}
SCALERS = {}

def load_models():
    """Load all available V3 models"""
    models_dir = Path('../models')
    
    # Find latest models
    for model_type in ['global', '2025']:
        model_files = sorted(
            models_dir.glob(f'nba_model_v3_{model_type}_*.joblib'),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        scaler_files = sorted(
            models_dir.glob(f'scaler_v3_{model_type}_*.joblib'),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        if model_files and scaler_files:
            MODELS[model_type] = joblib.load(model_files[0])
            SCALERS[model_type] = joblib.load(scaler_files[0])
            print(f"Loaded {model_type} model: {model_files[0].name}")

@app.on_event("startup")
async def startup():
    load_models()

# Request/Response models
class PredictRequest(BaseModel):
    model_type: str = "2025"  # "global" or "2025"
    games: List[dict]

class PredictResponse(BaseModel):
    model_type: str
    predictions: List[int]
    probabilities: List[float]
    confidence: List[float]
    latency_ms: float

class GameFeatures(BaseModel):
    elo_diff: float
    elo_diff_norm: float
    home_last10_wins: float
    away_last10_wins: float
    spread_num: float
    over_under: float
    ml_home_prob: float
    ml_away_prob: float
    rest_days_home: float
    rest_days_away: float
    season_norm: float

class SinglePredictRequest(BaseModel):
    model_type: str = "2025"
    features: GameFeatures

class SinglePredictResponse(BaseModel):
    prediction: int
    home_win_probability: float
    confidence: float
    latency_ms: float

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": list(MODELS.keys()),
        "version": "3.0.0"
    }

@app.post("/predict", response_model=PredictResponse)
async def predict_batch(request: PredictRequest):
    """Batch prediction endpoint"""
    import time
    start = time.time()
    
    if request.model_type not in MODELS:
        raise HTTPException(status_code=400, detail=f"Model {request.model_type} not found")
    
    model = MODELS[request.model_type]
    scaler = SCALERS[request.model_type]
    
    # Extract features
    feature_order = [
        'elo_diff', 'elo_diff_norm', 'home_last10_wins', 'away_last10_wins',
        'spread_num', 'over_under', 'ml_home_prob', 'ml_away_prob',
        'rest_days_home', 'rest_days_away', 'season_norm'
    ]
    
    X = np.array([[g['features'][f] for f in feature_order] for g in request.games])
    X_scaled = scaler.transform(X)
    
    # Predict
    predictions = model.predict(X_scaled).tolist()
    probas = model.predict_proba(X_scaled)
    home_probs = probas[:, 1].tolist()
    confidences = [abs(p - 0.5) * 2 for p in home_probs]
    
    latency = (time.time() - start) * 1000
    
    return PredictResponse(
        model_type=request.model_type,
        predictions=predictions,
        probabilities=home_probs,
        confidence=confidences,
        latency_ms=round(latency, 2)
    )

@app.post("/predict/single", response_model=SinglePredictResponse)
async def predict_single(request: SinglePredictRequest):
    """Single game prediction endpoint"""
    import time
    start = time.time()
    
    if request.model_type not in MODELS:
        raise HTTPException(status_code=400, detail=f"Model {request.model_type} not found")
    
    model = MODELS[request.model_type]
    scaler = SCALERS[request.model_type]
    
    # Extract features
    f = request.features
    X = np.array([[
        f.elo_diff, f.elo_diff_norm, f.home_last10_wins, f.away_last10_wins,
        f.spread_num, f.over_under, f.ml_home_prob, f.ml_away_prob,
        f.rest_days_home, f.rest_days_away, f.season_norm
    ]])
    X_scaled = scaler.transform(X)
    
    # Predict
    prediction = int(model.predict(X_scaled)[0])
    proba = model.predict_proba(X_scaled)[0]
    home_prob = float(proba[1])
    confidence = abs(home_prob - 0.5) * 2
    
    latency = (time.time() - start) * 1000
    
    return SinglePredictResponse(
        prediction=prediction,
        home_win_probability=round(home_prob, 4),
        confidence=round(confidence, 4),
        latency_ms=round(latency, 2)
    )

@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "available_models": list(MODELS.keys()),
        "models": {
            k: {
                "n_estimators": v.n_estimators,
                "max_depth": v.max_depth,
                "learning_rate": v.learning_rate
            } for k, v in MODELS.items()
        }
    }

if __name__ == "__main__":
    print("Starting NBA ML V3 Python Service")
    print("API available at: http://localhost:8000")
    print("Docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
