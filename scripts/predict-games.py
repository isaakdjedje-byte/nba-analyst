#!/usr/bin/env python3
"""
Predict NBA Games
Uses trained model to predict upcoming games
"""

import duckdb
import pandas as pd
import numpy as np
import joblib
import os
from glob import glob
from datetime import datetime, timedelta

class NBAPredictor:
    def __init__(self):
        self.db_path = './nba-data/analytics.duckdb'
        self.models_dir = './models'
        self.model = None
        self.scaler = None
        self.features = ['elo_diff', 'home_last10_wins', 'away_last10_wins', 
                        'spread_num', 'over_under', 'ml_home_prob', 
                        'ml_away_prob', 'rest_days_home', 'rest_days_away']
        
    def load_model(self):
        """Load latest trained model"""
        print('Loading model...')
        
        # Find latest model files
        model_files = glob(f'{self.models_dir}/nba_model_*.joblib')
        scaler_files = glob(f'{self.models_dir}/scaler_*.joblib')
        
        if not model_files or not scaler_files:
            raise FileNotFoundError('No trained model found. Run train-ml-model.py first.')
        
        # Load latest
        latest_model = sorted(model_files)[-1]
        latest_scaler = sorted(scaler_files)[-1]
        
        self.model = joblib.load(latest_model)
        self.scaler = joblib.load(latest_scaler)
        
        print(f'Loaded model: {os.path.basename(latest_model)}')
        print(f'Loaded scaler: {os.path.basename(latest_scaler)}')
        
    def get_upcoming_games(self):
        """Get games from odds_api_2025 (upcoming games)"""
        print('\nFetching upcoming games...')
        conn = duckdb.connect(self.db_path)
        
        # Pivot data: one row per game with all markets
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
        """Prepare features for prediction"""
        conn = duckdb.connect(self.db_path)
        
        # Get team ELO ratings
        elo_data = conn.execute('''
            SELECT 
                home_team,
                AVG(elo_home_after) as avg_elo
            FROM github_games
            WHERE season >= 2024
            GROUP BY home_team
        ''').fetchdf()
        
        conn.close()
        
        # Create ELO lookup
        elo_dict = dict(zip(elo_data['home_team'], elo_data['avg_elo']))
        default_elo = 1500
        
        # Map team names
        conn = duckdb.connect(self.db_path)
        mapping = conn.execute('SELECT * FROM team_mapping').fetchdf()
        conn.close()
        
        team_map = dict(zip(mapping['full_name'].str.lower(), 
                           mapping['abbreviation'].str.upper()))
        
        # Add ELO features
        games_df['elo_home'] = games_df['home_team'].str.lower().map(team_map).map(elo_dict).fillna(default_elo)
        games_df['elo_away'] = games_df['away_team'].str.lower().map(team_map).map(elo_dict).fillna(default_elo)
        games_df['elo_diff'] = games_df['elo_home'] - games_df['elo_away']
        
        # Form features (use neutral values for upcoming games)
        games_df['home_last10_wins'] = 0.5
        games_df['away_last10_wins'] = 0.5
        
        # Odds features
        games_df['spread_num'] = pd.to_numeric(games_df['spread'], errors='coerce').fillna(0)
        games_df['over_under'] = pd.to_numeric(games_df['over_under'], errors='coerce').fillna(220)
        
        # ML probabilities already in data
        games_df['ml_home_prob'] = games_df['ml_home_prob'].fillna(0.5)
        games_df['ml_away_prob'] = games_df['ml_away_prob'].fillna(0.5)
        
        # Rest days
        games_df['rest_days_home'] = 2
        games_df['rest_days_away'] = 2
        
        return games_df[self.features]
    
    def american_odds_to_prob(self, odds):
        """Convert American odds to implied probability"""
        if pd.isna(odds):
            return 0.5
        try:
            odds = float(odds)
            if odds > 0:
                return 100 / (odds + 100)
            else:
                return abs(odds) / (abs(odds) + 100)
        except:
            return 0.5
    
    def predict(self):
        """Main prediction function"""
        print('='*70)
        print('NBA GAME PREDICTIONS')
        print('='*70)
        print()
        
        self.load_model()
        games_df = self.get_upcoming_games()
        
        if len(games_df) == 0:
            print('No upcoming games found.')
            return
        
        # Prepare features
        X = self.prepare_features(games_df)
        X_scaled = self.scaler.transform(X)
        
        # Make predictions
        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)
        
        # Add predictions to dataframe
        games_df['predicted_winner'] = np.where(predictions == 1, 
                                               games_df['home_team'], 
                                               games_df['away_team'])
        games_df['home_win_prob'] = probabilities[:, 1]
        games_df['away_win_prob'] = probabilities[:, 0]
        games_df['confidence'] = np.abs(probabilities[:, 1] - 0.5) * 2
        
        # Display predictions
        print('\n' + '-'*70)
        print(f'{'Date':<12} {'Match':<40} {'Prediction':<20} {'Conf.':<8}')
        print('-'*70)
        
        for _, row in games_df.iterrows():
            match_str = f"{row['away_team']} @ {row['home_team']}"
            prob_str = f"{row['home_win_prob']:.0%}"
            conf_str = f"{row['confidence']:.1%}"
            date_str = str(row['commence_time'])[:10]
            
            print(f"{date_str:<12} {match_str:<40} {row['predicted_winner']:<20} {conf_str:<8}")
        
        print('-'*70)
        print(f"\nTotal predictions: {len(games_df)}")
        print(f"High confidence (>60%): {(games_df['confidence'] > 0.6).sum()}")
        print(f"Very high confidence (>70%): {(games_df['confidence'] > 0.7).sum()}")
        
        # Save predictions
        self.save_predictions(games_df)
        
        print('\n' + '='*70)
    
    def save_predictions(self, predictions_df):
        """Save predictions to database"""
        conn = duckdb.connect(self.db_path)
        
        # Create table
        conn.execute('''
            DROP TABLE IF EXISTS predictions;
            CREATE TABLE predictions (
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
        
        # Insert data
        for _, row in predictions_df.iterrows():
            conn.execute(f"""
                INSERT INTO predictions 
                (game_id, date, home_team, away_team, predicted_winner, 
                 home_win_prob, away_win_prob, confidence)
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
        print(f'\nPredictions saved to database.')

if __name__ == '__main__':
    predictor = NBAPredictor()
    predictor.predict()
