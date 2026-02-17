#!/usr/bin/env python3
"""
Predict NBA Games V2
Uses model trained with and without odds
"""

import duckdb
import pandas as pd
import numpy as np
import joblib
import os
from glob import glob
from datetime import datetime

class NBAPredictorV2:
    def __init__(self):
        self.db_path = './nba-data/analytics.duckdb'
        self.models_dir = './models'
        self.model = None
        self.scaler = None
        self.features = ['elo_diff', 'home_last10_wins', 'away_last10_wins', 
                        'spread_num', 'over_under', 'ml_home_prob', 
                        'ml_away_prob', 'rest_days_home', 'rest_days_away', 'has_odds']
        
    def load_model(self):
        """Load latest V2 model"""
        print('Loading model V2...')
        
        model_files = glob(f'{self.models_dir}/nba_model_v2_*.joblib')
        scaler_files = glob(f'{self.models_dir}/scaler_v2_*.joblib')
        
        if not model_files or not scaler_files:
            raise FileNotFoundError('No V2 model found. Run train-ml-model-v2.py first.')
        
        latest_model = sorted(model_files)[-1]
        latest_scaler = sorted(scaler_files)[-1]
        
        self.model = joblib.load(latest_model)
        self.scaler = joblib.load(latest_scaler)
        
        print(f'Loaded: {os.path.basename(latest_model)}')
        print(f'Scaler: {os.path.basename(latest_scaler)}')
        
    def get_upcoming_games(self):
        """Get upcoming games from The Odds API"""
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
        
        print(f'Found {len(games)} upcoming games')
        return games
    
    def prepare_features(self, games_df):
        """Prepare features with ELO from latest available"""
        conn = duckdb.connect(self.db_path)
        
        # Get latest ELO for each team (from end of 2024 season)
        print('\nFetching latest ELO ratings...')
        elo_data = conn.execute('''
            SELECT 
                home_team,
                AVG(elo_home_after) as avg_elo
            FROM github_games
            WHERE season = 2024
            GROUP BY home_team
        ''').fetchdf()
        
        conn.close()
        
        # Create ELO lookup
        elo_dict = dict(zip(elo_data['home_team'], elo_data['avg_elo']))
        default_elo = 1500
        
        # Add ELO features
        games_df['elo_home'] = games_df['home_team'].map(lambda x: elo_dict.get(x, default_elo))
        games_df['elo_away'] = games_df['away_team'].map(lambda x: elo_dict.get(x, default_elo))
        games_df['elo_diff'] = games_df['elo_home'] - games_df['elo_away']
        
        # Form features (neutral for upcoming games)
        games_df['home_last10_wins'] = 0.5
        games_df['away_last10_wins'] = 0.5
        
        # Odds features
        games_df['spread_num'] = pd.to_numeric(games_df['spread'], errors='coerce').fillna(0)
        games_df['over_under'] = pd.to_numeric(games_df['over_under'], errors='coerce').fillna(220)
        games_df['ml_home_prob'] = games_df['ml_home_prob'].fillna(0.5)
        games_df['ml_away_prob'] = games_df['ml_away_prob'].fillna(0.5)
        
        # Rest days
        games_df['rest_days_home'] = 2
        games_df['rest_days_away'] = 2
        
        # Flag for odds availability
        games_df['has_odds'] = games_df['spread'].notna().astype(int)
        
        return games_df[self.features]
    
    def predict(self):
        """Main prediction"""
        print('='*70)
        print('NBA GAME PREDICTIONS V2')
        print('='*70)
        
        self.load_model()
        games_df = self.get_upcoming_games()
        
        if len(games_df) == 0:
            print('No upcoming games found.')
            return
        
        # Prepare features
        X = self.prepare_features(games_df)
        X_scaled = self.scaler.transform(X)
        
        # Predict
        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)
        
        # Add to dataframe
        games_df['predicted_winner'] = np.where(predictions == 1, 
                                               games_df['home_team'], 
                                               games_df['away_team'])
        games_df['home_win_prob'] = probabilities[:, 1]
        games_df['away_win_prob'] = probabilities[:, 0]
        games_df['confidence'] = np.abs(probabilities[:, 1] - 0.5) * 2
        
        # Display
        print('\n' + '-'*70)
        print(f'{'Date':<12} {'Match':<45} {'Prediction':<25} {'Conf.':<8}')
        print('-'*70)
        
        for _, row in games_df.iterrows():
            match_str = f"{row['away_team']} @ {row['home_team']}"
            conf_str = f"{row['confidence']:.1%}"
            date_str = str(row['commence_time'])[:10]
            
            print(f"{date_str:<12} {match_str:<45} {row['predicted_winner']:<25} {conf_str:<8}")
        
        print('-'*70)
        print(f"\nTotal: {len(games_df)} predictions")
        print(f"High confidence (>60%): {(games_df['confidence'] > 0.6).sum()}")
        print(f"Very high (>70%): {(games_df['confidence'] > 0.7).sum()}")
        print(f"Excellent (>80%): {(games_df['confidence'] > 0.8).sum()}")
        
        # Save
        self.save_predictions(games_df)
        
        print('\n' + '='*70)
    
    def save_predictions(self, predictions_df):
        """Save predictions"""
        conn = duckdb.connect(self.db_path)
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS predictions_v2 (
                game_id VARCHAR,
                date TIMESTAMP,
                home_team VARCHAR,
                away_team VARCHAR,
                predicted_winner VARCHAR,
                home_win_prob FLOAT,
                away_win_prob FLOAT,
                confidence FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        for _, row in predictions_df.iterrows():
            conn.execute(f"""
                INSERT INTO predictions_v2 
                VALUES (
                    '{row['game_id']}',
                    '{row['commence_time']}',
                    '{row['home_team'].replace("'", "''")}',
                    '{row['away_team'].replace("'", "''")}',
                    '{row['predicted_winner'].replace("'", "''")}',
                    {row['home_win_prob']},
                    {row['away_win_prob']},
                    {row['confidence']}
                )
            """)
        
        conn.commit()
        conn.close()
        print(f'\nPredictions saved.')

if __name__ == '__main__':
    predictor = NBAPredictorV2()
    predictor.predict()
