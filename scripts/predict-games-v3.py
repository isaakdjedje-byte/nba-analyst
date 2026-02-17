#!/usr/bin/env python3
"""
Predict NBA Games V3
Uses V3 models with season feature and exclusions
"""

import duckdb
import pandas as pd
import numpy as np
import joblib
import os
from glob import glob

class NBAPredictorV3:
    def __init__(self, model_type='2025'):
        self.db_path = './nba-data/analytics.duckdb'
        self.models_dir = './models'
        self.model_type = model_type
        self.model = None
        self.scaler = None
        self.features = [
            'elo_diff', 'elo_diff_norm', 'home_last10_wins', 'away_last10_wins',
            'spread_num', 'over_under', 'ml_home_prob', 'ml_away_prob',
            'rest_days_home', 'rest_days_away', 'season_norm'
        ]
        
    def load_model(self):
        """Load V3 model"""
        print(f'Loading V3 {self.model_type.upper()} Model...')
        
        pattern = f'nba_model_v3_{self.model_type}_*.joblib'
        model_files = glob(f'{self.models_dir}/{pattern}')
        
        if not model_files:
            print(f'No {self.model_type} model found. Using global.')
            pattern = 'nba_model_v3_global_*.joblib'
            model_files = glob(f'{self.models_dir}/{pattern}')
        
        if not model_files:
            raise FileNotFoundError('No V3 model found')
        
        latest_model = sorted(model_files)[-1]
        latest_scaler = latest_model.replace('nba_model_', 'scaler_')
        
        self.model = joblib.load(latest_model)
        self.scaler = joblib.load(latest_scaler)
        
        print(f'Loaded: {os.path.basename(latest_model)}')
        
    def get_upcoming_games(self):
        """Get upcoming games"""
        print('\nFetching upcoming games...')
        conn = duckdb.connect(self.db_path)
        
        games = conn.execute('''
            SELECT 
                game_id,
                home_team,
                away_team,
                commence_time,
                MAX(CASE WHEN market = 'spreads' THEN close_line END) as spread,
                MAX(CASE WHEN market = 'totals' THEN close_line END) as over_under,
                MAX(CASE WHEN market = 'h2h' THEN home_implied_prob END) as ml_home_prob,
                MAX(CASE WHEN market = 'h2h' THEN away_implied_prob END) as ml_away_prob
            FROM odds_api_2025
            WHERE commence_time >= CURRENT_DATE
            GROUP BY game_id, home_team, away_team, commence_time
            ORDER BY commence_time
        ''').fetchdf()
        
        conn.close()
        print(f'Found {len(games)} games')
        return games
    
    def prepare_features(self, games_df):
        """Prepare features"""
        conn = duckdb.connect(self.db_path)
        
        # Get latest ELO (2024)
        print('\nFetching latest ELO...')
        elo_data = conn.execute('''
            SELECT home_team, AVG(elo_home_after) as elo
            FROM github_games
            WHERE season = 2024
            GROUP BY home_team
        ''').fetchdf()
        conn.close()
        
        elo_dict = dict(zip(elo_data['home_team'], elo_data['elo']))
        
        # Add ELO
        games_df['elo_home'] = games_df['home_team'].map(lambda x: elo_dict.get(x, 1500))
        games_df['elo_away'] = games_df['away_team'].map(lambda x: elo_dict.get(x, 1500))
        games_df['elo_diff'] = games_df['elo_home'] - games_df['elo_away']
        games_df['elo_diff_norm'] = (games_df['elo_diff'] + 400) / 800
        
        # Form
        games_df['home_last10_wins'] = 0.5
        games_df['away_last10_wins'] = 0.5
        
        # Odds
        games_df['spread_num'] = pd.to_numeric(games_df['spread'], errors='coerce').fillna(0)
        games_df['over_under'] = pd.to_numeric(games_df['over_under'], errors='coerce').fillna(220)
        games_df['ml_home_prob'] = games_df['ml_home_prob'].fillna(0.5)
        games_df['ml_away_prob'] = games_df['ml_away_prob'].fillna(0.5)
        
        # Rest
        games_df['rest_days_home'] = 2
        games_df['rest_days_away'] = 2
        
        # SEASON (normalized for 2025)
        games_df['season_norm'] = (2025 - 2010) / 15  # or (2025-2019)/4 for 2025 model
        if self.model_type == '2025':
            games_df['season_norm'] = (2025 - 2019) / 4
        
        return games_df[self.features]
    
    def predict(self):
        """Main prediction"""
        print('='*70)
        print(f'NBA PREDICTIONS V3 - {self.model_type.upper()} MODEL')
        print('='*70)
        
        self.load_model()
        games_df = self.get_upcoming_games()
        
        if len(games_df) == 0:
            print('No games found')
            return
        
        X = self.prepare_features(games_df)
        X_scaled = self.scaler.transform(X)
        
        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)
        
        games_df['predicted_winner'] = np.where(predictions == 1,
                                               games_df['home_team'],
                                               games_df['away_team'])
        games_df['home_win_prob'] = probabilities[:, 1]
        games_df['confidence'] = np.abs(probabilities[:, 1] - 0.5) * 2
        
        # Display
        print('\n' + '-'*70)
        print(f'{"Date":<12} {"Match":<45} {"Prediction":<25} {"Conf.":<8}')
        print('-'*70)
        
        for _, row in games_df.iterrows():
            match = f"{row['away_team']} @ {row['home_team']}"
            print(f"{str(row['commence_time'])[:10]:<12} {match:<45} "
                  f"{row['predicted_winner']:<25} {row['confidence']:.1%}")
        
        print('-'*70)
        print(f"\nTotal: {len(games_df)}")
        print(f">60%: {(games_df['confidence'] > 0.6).sum()}")
        print(f">70%: {(games_df['confidence'] > 0.7).sum()}")
        print(f">80%: {(games_df['confidence'] > 0.8).sum()}")

if __name__ == '__main__':
    # Use 2025 model by default
    predictor = NBAPredictorV3(model_type='2025')
    predictor.predict()
