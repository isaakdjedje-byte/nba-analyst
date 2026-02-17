#!/usr/bin/env python3
"""
Train NBA ML Model V3
- Excludes seasons without odds: 2016-2018, 2024
- Adds season as feature
- Creates both global and 2025-specific models
"""

import duckdb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler
import joblib
import os
from datetime import datetime

class NBAMLTrainerV3:
    def __init__(self):
        self.db_path = './nba-data/analytics.duckdb'
        self.models_dir = './models'
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Seasons to exclude (no odds)
        self.EXCLUDED_SEASONS = [2016, 2017, 2018, 2024]
        
    def load_data(self):
        """Load data excluding seasons without odds"""
        print('='*70)
        print('NBA ML TRAINER V3')
        print(f'Excluding seasons: {self.EXCLUDED_SEASONS}')
        print('='*70)
        
        conn = duckdb.connect(self.db_path)
        
        # Load games with ELO, excluding seasons without odds
        placeholders = ','.join([str(s) for s in self.EXCLUDED_SEASONS])
        
        games_query = f"""
            SELECT 
                game_id,
                date,
                season,
                home_team,
                away_team,
                home_score,
                away_score,
                winner,
                elo_home_before,
                elo_away_before,
                CASE WHEN home_score > away_score THEN 1 ELSE 0 END as home_win
            FROM github_games
            WHERE elo_home_before IS NOT NULL
            AND season NOT IN ({placeholders})
            ORDER BY date
        """
        
        games_df = conn.execute(games_query).fetchdf()
        print(f'\nLoaded {len(games_df)} games (excluded {self.EXCLUDED_SEASONS})')
        
        # Show distribution by season
        season_dist = games_df.groupby('season').size().reset_index(name='count')
        print('\nGames by season:')
        for _, row in season_dist.iterrows():
            print(f'  {int(row["season"])}: {row["count"]} games')
        
        # Load odds
        odds_query = f"""
            SELECT 
                season,
                date,
                home_team,
                away_team,
                spread,
                over_under,
                ml_home,
                ml_away
            FROM odds_historical
            WHERE season NOT IN ({placeholders})
        """
        
        odds_df = conn.execute(odds_query).fetchdf()
        print(f'\nLoaded {len(odds_df)} odds entries')
        
        conn.close()
        
        return games_df, odds_df
    
    def engineer_features(self, games_df, odds_df):
        """Create features with season as feature"""
        print('\n' + '='*70)
        print('Engineering features...')
        print('='*70)
        
        conn = duckdb.connect(self.db_path)
        mapping_df = conn.execute('SELECT * FROM team_mapping').fetchdf()
        conn.close()
        
        team_map = dict(zip(mapping_df['abbreviation'].str.upper(), 
                           mapping_df['full_name'].str.lower()))
        
        # Map team names for 2010-2015
        def map_team_name(team):
            team = str(team).strip().upper()
            if team in team_map:
                return team_map[team]
            return str(team).lower().strip()
        
        games_df['home_team_mapped'] = games_df['home_team'].apply(map_team_name)
        games_df['away_team_mapped'] = games_df['away_team'].apply(map_team_name)
        
        odds_df['home_team_clean'] = odds_df['home_team'].str.strip().str.lower()
        odds_df['away_team_clean'] = odds_df['away_team'].str.strip().str.lower()
        
        # Merge
        print('Merging games with odds...')
        merged = games_df.merge(
            odds_df[['season', 'home_team_clean', 'away_team_clean', 
                    'spread', 'over_under', 'ml_home', 'ml_away']],
            left_on=['season', 'home_team_mapped', 'away_team_mapped'],
            right_on=['season', 'home_team_clean', 'away_team_clean'],
            how='inner'  # Only keep games with odds
        )
        
        print(f'  Total games with odds: {len(merged)}')
        
        # Calculate features
        print('Calculating features...')
        merged = merged.sort_values('date')
        
        # Rolling form (last 10 games)
        merged['home_last10_wins'] = merged.groupby('home_team')['home_win'].transform(
            lambda x: x.shift(1).rolling(window=10, min_periods=1).mean()
        ).fillna(0.5)
        
        merged['away_last10_wins'] = merged.groupby('away_team')['home_win'].transform(
            lambda x: (1 - x).shift(1).rolling(window=10, min_periods=1).mean()
        ).fillna(0.5)
        
        # ELO features
        merged['elo_diff'] = merged['elo_home_before'] - merged['elo_away_before']
        
        # Normalize ELO to 0-1 range
        merged['elo_diff_norm'] = (merged['elo_diff'] + 400) / 800  # Rough normalization
        
        # Odds features
        merged['spread_num'] = pd.to_numeric(merged['spread'], errors='coerce')
        merged['over_under'] = pd.to_numeric(merged['over_under'], errors='coerce')
        merged['ml_home_prob'] = merged['ml_home'].apply(self.american_odds_to_prob)
        merged['ml_away_prob'] = merged['ml_away'].apply(self.american_odds_to_prob)
        
        # Rest days
        merged['rest_days_home'] = 2
        merged['rest_days_away'] = 2
        
        # SEASON as feature (NEW!)
        merged['season_norm'] = (merged['season'] - 2010) / 15  # Normalize to 0-1
        
        # Features
        feature_cols = [
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
            'season_norm'  # NEW!
        ]
        
        print(f'\nFeatures: {feature_cols}')
        print(f'Training data: {len(merged)} rows')
        
        return merged, feature_cols
    
    def american_odds_to_prob(self, odds):
        """Convert American odds to probability"""
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
    
    def train_model(self, model_data, feature_cols, model_name='global'):
        """Train and save model"""
        print('\n' + '='*70)
        print(f'Training {model_name.upper()} Model')
        print('='*70)
        
        X = model_data[feature_cols]
        y = model_data['home_win']
        
        # Time-based split
        split_date = model_data['date'].quantile(0.8)
        train_data = model_data[model_data['date'] < split_date]
        test_data = model_data[model_data['date'] >= split_date]
        
        X_train = train_data[feature_cols]
        y_train = train_data['home_win']
        X_test = test_data[feature_cols]
        y_test = test_data['home_win']
        
        print(f'Training: {len(X_train)} samples ({train_data["date"].min()} to {train_data["date"].max()})')
        print(f'Test: {len(X_test)} samples ({test_data["date"].min()} to {test_data["date"].max()})')
        
        # Scale
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train
        print('\nTraining Gradient Boosting...')
        model = GradientBoostingClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.08,
            random_state=42
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_pred = model.predict(X_train_scaled)
        test_pred = model.predict(X_test_scaled)
        test_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        
        print('\n' + '-'*70)
        print('Results:')
        print('-'*70)
        print(f'Training Accuracy: {accuracy_score(y_train, train_pred):.4f}')
        print(f'Test Accuracy: {accuracy_score(y_test, test_pred):.4f}')
        print(f'Test ROC-AUC: {roc_auc_score(y_test, test_pred_proba):.4f}')
        
        print('\nClassification Report:')
        print(classification_report(y_test, test_pred, 
                                  target_names=['Away Win', 'Home Win']))
        
        # Feature importance
        print('\nFeature Importance:')
        importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        for _, row in importance.iterrows():
            print(f"  {row['feature']}: {row['importance']:.4f}")
        
        # Save
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_path = f'{self.models_dir}/nba_model_v3_{model_name}_{timestamp}.joblib'
        scaler_path = f'{self.models_dir}/scaler_v3_{model_name}_{timestamp}.joblib'
        
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        
        print(f'\nModel saved: {model_path}')
        print(f'Scaler saved: {scaler_path}')
        
        return model, scaler
    
    def train_2025_model(self, games_df, odds_df, feature_cols):
        """Train model specifically for 2025"""
        print('\n' + '='*70)
        print('Creating 2025-Specific Model')
        print('='*70)
        
        # Filter for seasons similar to 2025 (2019-2023)
        recent_seasons = [2019, 2020, 2021, 2022, 2023]
        
        # Re-merge but only for recent seasons
        conn = duckdb.connect(self.db_path)
        mapping_df = conn.execute('SELECT * FROM team_mapping').fetchdf()
        conn.close()
        
        team_map = dict(zip(mapping_df['abbreviation'].str.upper(), 
                           mapping_df['full_name'].str.lower()))
        
        def map_team_name(team):
            team = str(team).strip().upper()
            if team in team_map:
                return team_map[team]
            return str(team).lower().strip()
        
        games_recent = games_df[games_df['season'].isin(recent_seasons)].copy()
        odds_recent = odds_df[odds_df['season'].isin(recent_seasons)].copy()
        
        games_recent['home_team_mapped'] = games_recent['home_team'].apply(map_team_name)
        games_recent['away_team_mapped'] = games_recent['away_team'].apply(map_team_name)
        odds_recent['home_team_clean'] = odds_recent['home_team'].str.strip().str.lower()
        odds_recent['away_team_clean'] = odds_recent['away_team'].str.strip().str.lower()
        
        merged = games_recent.merge(
            odds_recent[['season', 'home_team_clean', 'away_team_clean', 
                        'spread', 'over_under', 'ml_home', 'ml_away']],
            left_on=['season', 'home_team_mapped', 'away_team_mapped'],
            right_on=['season', 'home_team_clean', 'away_team_clean'],
            how='inner'
        )
        
        print(f'Recent seasons data: {len(merged)} games')
        
        # Calculate same features
        merged = merged.sort_values('date')
        merged['home_last10_wins'] = merged.groupby('home_team')['home_win'].transform(
            lambda x: x.shift(1).rolling(window=10, min_periods=1).mean()
        ).fillna(0.5)
        merged['away_last10_wins'] = merged.groupby('away_team')['home_win'].transform(
            lambda x: (1 - x).shift(1).rolling(window=10, min_periods=1).mean()
        ).fillna(0.5)
        merged['elo_diff'] = merged['elo_home_before'] - merged['elo_away_before']
        merged['elo_diff_norm'] = (merged['elo_diff'] + 400) / 800
        merged['spread_num'] = pd.to_numeric(merged['spread'], errors='coerce')
        merged['over_under'] = pd.to_numeric(merged['over_under'], errors='coerce')
        merged['ml_home_prob'] = merged['ml_home'].apply(self.american_odds_to_prob)
        merged['ml_away_prob'] = merged['ml_away'].apply(self.american_odds_to_prob)
        merged['rest_days_home'] = 2
        merged['rest_days_away'] = 2
        merged['season_norm'] = (merged['season'] - 2019) / 4  # Normalize for recent
        
        # Train
        return self.train_model(merged, feature_cols, '2025')
    
    def run(self):
        """Main execution"""
        games_df, odds_df = self.load_data()
        model_data, feature_cols = self.engineer_features(games_df, odds_df)
        
        if len(model_data) < 1000:
            print(f'ERROR: Only {len(model_data)} samples')
            return
        
        # Train global model
        self.train_model(model_data, feature_cols, 'global')
        
        # Train 2025-specific model
        self.train_2025_model(games_df, odds_df, feature_cols)
        
        print('\n' + '='*70)
        print('TRAINING COMPLETE - Both models saved!')
        print('='*70)

if __name__ == '__main__':
    trainer = NBAMLTrainerV3()
    trainer.run()
