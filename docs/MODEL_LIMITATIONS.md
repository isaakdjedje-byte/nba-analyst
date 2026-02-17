# NBA ML Model V3 - Documentation

## Resume
Modele V3 avec exclusions et feature saison

## Modeles
1. Global: 20,361 matchs, 62.3% accuracy
2. 2025: 8,431 matchs, 64.8% accuracy

## Saisons Exclues
2016, 2017, 2018, 2024 (pas d'odds disponibles)

## Features
- elo_diff (26%)
- elo_diff_norm (17%)
- home_last10_wins (12%)
- ml_home_prob (9%)
- season_norm (6%)

## Predictions 2026-02-20
- Cleveland Cavaliers: 88.6% confiance
- Orlando Magic: 76.2%
- Toronto Raptors: 69.3%
- Denver Nuggets: 66.9%

## Commandes
python scripts/predict-games-v3.py
python scripts/train-ml-model-v3.py
