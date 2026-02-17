#!/usr/bin/env python3
"""
Train NBA ML Model
Uses historical game data + odds to predict winners
"""

import duckdb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler
import joblib
import os
from datetime import datetime

class NBAMLTrainer:
    def __init__(self):
        self.db_path = './nba-data/analytics.duckdb'
        self.models_dir = './models'
        os.makedirs(self.models_dir, exist_ok=True)
        
    def load_data(self):
        """Load and merge all data sources"""
        print('Loading data...')
        conn = duckdb.connect(self.db_path)
        
        # Load games with ELO ratings
        games_query = """
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
                elo_home_after,
                elo_away_before,
                elo_away_after,
                CASE WHEN home_score > away_score THEN 1 ELSE 0 END as home_win
            FROM github_games
            WHERE season >= 2010
            ORDER BY date
        """
        
        games_df = conn.execute(games_query).fetchdf()
        print(f'Loaded {len(games_df)} games')
        
        # Load historical odds
        odds_query = """
            SELECT 
                season,
                date,
                home_team,
                away_team,
                over_under,
                spread,
                ml_home,
                ml_away,
                total_points
            FROM odds_historical
            WHERE season >= 2010
        """
        
        odds_df = conn.execute(odds_query).fetchdf()
        print(f'Loaded {len(odds_df)} odds entries')
        
        conn.close()
        
        return games_df, odds_df
    
    def engineer_features(self, games_df, odds_df):
        """Create ML features with team name mapping"""
        print('\nEngineering features...')
        
        # Load team mapping
        print('Loading team name mapping...')
        conn = duckdb.connect(self.db_path)
        mapping_df = conn.execute('SELECT * FROM team_mapping').fetchdf()
        conn.close()
        
        # Create mapping dictionary
        team_map = dict(zip(mapping_df['abbreviation'].str.upper(), mapping_df['full_name'].str.lower()))
        
        # Map games team names from abbreviations to full names
        games_df['home_team_mapped'] = games_df['home_team'].map(team_map)
        games_df['away_team_mapped'] = games_df['away_team'].map(team_map)
        
        # Normalize odds team names
        odds_df['home_team_clean'] = odds_df['home_team'].str.strip().str.lower()
        odds_df['away_team_clean'] = odds_df['away_team'].str.strip().str.lower()
        
        # Merge using mapped names
        print('Merging games with odds...')
        merged = games_df.merge(
            odds_df[['season', 'home_team_clean', 'away_team_clean', 'spread', 'over_under', 'ml_home', 'ml_away']],
            left_on=['season', 'home_team_mapped', 'away_team_mapped'],
            right_on=['season', 'home_team_clean', 'away_team_clean'],
            how='left'
        )
        
        print(f'Merged data: {len(merged)} rows')
        print(f'With odds: {merged["spread"].notna().sum()} rows')
        
        # Calculate rolling features (last 10 games)
        merged = merged.sort_values('date')
        
        # Home team form
        merged['home_last10_wins'] = merged.groupby('home_team')['home_win'].transform(
            lambda x: x.shift(1).rolling(window=10, min_periods=1).mean()
        )
        
        # Away team form (need to calculate from when they were home)
        away_form = merged.copy()
        away_form['away_win'] = 1 - away_form['home_win']
        away_form['team'] = away_form['away_team']
        
        merged['away_last10_wins'] = merged.groupby('away_team')['home_win'].transform(
            lambda x: (1 - x).shift(1).rolling(window=10, min_periods=1).mean()
        )
        
        # ELO difference
        merged['elo_diff'] = merged['elo_home_before'] - merged['elo_away_before']
        
        # Convert spread to numeric
        merged['spread_num'] = pd.to_numeric(merged['spread'], errors='coerce')
        
        # Convert moneyline to implied probability
        merged['ml_home_prob'] = merged['ml_home'].apply(self.american_odds_to_prob)
        merged['ml_away_prob'] = merged['ml_away'].apply(self.american_odds_to_prob)
        
        # Rest days (simplified - assume 2 days if not in odds data)
        merged['rest_days_home'] = 2
        merged['rest_days_away'] = 2
        
        # Features for model
        feature_cols = [
            'elo_diff',
            'home_last10_wins',
            'away_last10_wins',
            'spread_num',
            'over_under',
            'ml_home_prob',
            'ml_away_prob',
            'rest_days_home',
            'rest_days_away'
        ]
        
        # Drop rows with missing features
        model_data = merged[feature_cols + ['home_win']].dropna()
        
        print(f'Training data: {len(model_data)} rows')
        print(f'Features: {feature_cols}')
        
        return model_data, feature_cols
    
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
    
    def train_model(self, model_data, feature_cols):
        """Train ML model"""
        print('\n' + '='*65)
        print('Training NBA ML Model')
        print('='*65)
        
        X = model_data[feature_cols]
        y = model_data['home_win']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f'Training set: {len(X_train)} samples')
        print(f'Test set: {len(X_test)} samples')
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train Gradient Boosting model
        print('\nTraining Gradient Boosting Classifier...')
        model = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_pred = model.predict(X_train_scaled)
        test_pred = model.predict(X_test_scaled)
        test_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        
        print('\n' + '-'*65)
        print('Training Results:')
        print('-'*65)
        print(f'Training Accuracy: {accuracy_score(y_train, train_pred):.4f}')
        print(f'Test Accuracy: {accuracy_score(y_test, test_pred):.4f}')
        print(f'Test ROC-AUC: {roc_auc_score(y_test, test_pred_proba):.4f}')
        print('\nClassification Report:')
        print(classification_report(y_test, test_pred, target_names=['Away Win', 'Home Win']))
        
        # Feature importance
        print('\nFeature Importance:')
        importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        for _, row in importance.iterrows():
            print(f"  {row['feature']}: {row['importance']:.4f}")
        
        # Save model
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_path = f'{self.models_dir}/nba_model_{timestamp}.joblib'
        scaler_path = f'{self.models_dir}/scaler_{timestamp}.joblib'
        
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        
        print(f'\nModel saved to: {model_path}')
        print(f'Scaler saved to: {scaler_path}')
        
        return model, scaler, feature_cols
    
    def run(self):
        """Main training pipeline"""
        games_df, odds_df = self.load_data()
        model_data, feature_cols = self.engineer_features(games_df, odds_df)
        
        if len(model_data) < 1000:
            print(f'\n⚠️ Warning: Only {len(model_data)} samples available. Need more data.')
            return
        
        model, scaler, features = self.train_model(model_data, feature_cols)
        
        print('\n' + '='*65)
        print('Training Complete!')
        print('='*65)

if __name__ == '__main__':
    trainer = NBAMLTrainer()
    trainer.run()
