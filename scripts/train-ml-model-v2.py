#!/usr/bin/env python3
"""
Train NBA ML Model V2
Handles seasons with and without odds
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

class NBAMLTrainerV2:
    def __init__(self):
        self.db_path = './nba-data/analytics.duckdb'
        self.models_dir = './models'
        os.makedirs(self.models_dir, exist_ok=True)
        
    def load_data(self):
        """Load all data"""
        print('Loading data...')
        conn = duckdb.connect(self.db_path)
        
        # Load all games with ELO
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
                elo_away_before,
                CASE WHEN home_score > away_score THEN 1 ELSE 0 END as home_win
            FROM github_games
            WHERE elo_home_before IS NOT NULL
            ORDER BY date
        """
        
        games_df = conn.execute(games_query).fetchdf()
        print(f'Loaded {len(games_df)} games with ELO')
        
        # Load odds - separate query to check availability
        odds_query = """
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
        """
        
        odds_df = conn.execute(odds_query).fetchdf()
        print(f'Loaded {len(odds_df)} odds entries')
        
        conn.close()
        
        return games_df, odds_df
    
    def engineer_features(self, games_df, odds_df):
        """Create features with fallback for missing odds"""
        print('\nEngineering features...')
        
        # Map team names
        conn = duckdb.connect(self.db_path)
        mapping_df = conn.execute('SELECT * FROM team_mapping').fetchdf()
        conn.close()
        
        team_map = dict(zip(mapping_df['abbreviation'].str.upper(), 
                           mapping_df['full_name'].str.lower()))
        
        # Map games team names
        games_df['home_team_mapped'] = games_df['home_team'].map(team_map)
        games_df['away_team_mapped'] = games_df['away_team'].map(team_map)
        
        # Normalize odds team names
        odds_df['home_team_clean'] = odds_df['home_team'].str.strip().str.lower()
        odds_df['away_team_clean'] = odds_df['away_team'].str.strip().str.lower()
        
        # Merge games with odds
        print('Merging games with odds...')
        merged = games_df.merge(
            odds_df[['season', 'home_team_clean', 'away_team_clean', 'spread', 'over_under', 'ml_home', 'ml_away']],
            left_on=['season', 'home_team_mapped', 'away_team_mapped'],
            right_on=['season', 'home_team_clean', 'away_team_clean'],
            how='left'
        )
        
        print(f'  Total games: {len(merged)}')
        print(f'  With odds: {merged["spread"].notna().sum()} ({merged["spread"].notna().sum()/len(merged)*100:.1f}%)')
        print(f'  Without odds: {merged["spread"].isna().sum()}')
        
        # Check by season
        print('\n  Odds availability by season:')
        for season in sorted(merged['season'].unique()):
            season_data = merged[merged['season'] == season]
            with_odds = season_data['spread'].notna().sum()
            total = len(season_data)
            print(f'    {season}: {with_odds}/{total} ({with_odds/total*100:.1f}%)')
        
        # Calculate rolling features
        print('\nCalculating rolling features...')
        merged = merged.sort_values('date')
        
        # Form features (last 10 games)
        merged['home_last10_wins'] = merged.groupby('home_team')['home_win'].transform(
            lambda x: x.shift(1).rolling(window=10, min_periods=1).mean()
        ).fillna(0.5)
        
        merged['away_last10_wins'] = merged.groupby('away_team')['home_win'].transform(
            lambda x: (1 - x).shift(1).rolling(window=10, min_periods=1).mean()
        ).fillna(0.5)
        
        # ELO features
        merged['elo_diff'] = merged['elo_home_before'] - merged['elo_away_before']
        
        # Odds features (with fallback)
        merged['spread_num'] = pd.to_numeric(merged['spread'], errors='coerce')
        merged['over_under'] = pd.to_numeric(merged['over_under'], errors='coerce')
        merged['ml_home_prob'] = merged['ml_home'].apply(self.american_odds_to_prob)
        merged['ml_away_prob'] = merged['ml_away'].apply(self.american_odds_to_prob)
        
        # Fill missing odds with defaults
        merged['spread_num'] = merged['spread_num'].fillna(0)
        merged['over_under'] = merged['over_under'].fillna(220)
        merged['ml_home_prob'] = merged['ml_home_prob'].fillna(0.5)
        merged['ml_home_prob'] = merged['ml_home_prob'].fillna(0.5)
        merged['ml_away_prob'] = merged['ml_away_prob'].fillna(0.5)
        
        # Flag for odds availability
        merged['has_odds'] = merged['spread'].notna().astype(int)
        
        # Rest days (simplified)
        merged['rest_days_home'] = 2
        merged['rest_days_away'] = 2
        
        # All features
        feature_cols = [
            'elo_diff',
            'home_last10_wins',
            'away_last10_wins',
            'spread_num',
            'over_under',
            'ml_home_prob',
            'ml_away_prob',
            'rest_days_home',
            'rest_days_away',
            'has_odds'
        ]
        
        # Drop rows with missing target
        model_data = merged[merged['home_win'].notna()].copy()
        
        print(f'\nTraining data: {len(model_data)} rows')
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
        """Train model"""
        print('\n' + '='*70)
        print('Training NBA ML Model V2')
        print('='*70)
        
        X = model_data[feature_cols]
        y = model_data['home_win']
        
        # Split by date to avoid data leakage
        split_date = model_data['date'].quantile(0.8)
        train_data = model_data[model_data['date'] < split_date]
        test_data = model_data[model_data['date'] >= split_date]
        
        X_train = train_data[feature_cols]
        y_train = train_data['home_win']
        X_test = test_data[feature_cols]
        y_test = test_data['home_win']
        
        print(f'Training set: {len(X_train)} samples')
        print(f'Test set: {len(X_test)} samples')
        print(f'Test date range: {test_data["date"].min()} to {test_data["date"].max()}')
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        print('\nTraining Gradient Boosting Classifier...')
        model = GradientBoostingClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.08,
            random_state=42,
            subsample=0.8
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
        print(classification_report(y_test, test_pred, target_names=['Away Win', 'Home Win']))
        
        # Feature importance
        print('\nFeature Importance:')
        importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        for _, row in importance.iterrows():
            print(f"  {row['feature']}: {row['importance']:.4f}")
        
        # Performance by odds availability
        print('\nPerformance by odds availability:')
        for has_odds in [0, 1]:
            subset = test_data[test_data['has_odds'] == has_odds]
            if len(subset) > 0:
                acc = accuracy_score(subset['home_win'], test_pred[test_data['has_odds'] == has_odds])
                print(f"  {'With' if has_odds else 'Without'} odds: {len(subset)} games, {acc:.2%} accuracy")
        
        # Save model
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_path = f'{self.models_dir}/nba_model_v2_{timestamp}.joblib'
        scaler_path = f'{self.models_dir}/scaler_v2_{timestamp}.joblib'
        
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        
        print(f'\nModel saved: {model_path}')
        print(f'Scaler saved: {scaler_path}')
        
        return model, scaler, feature_cols
    
    def run(self):
        """Main execution"""
        games_df, odds_df = self.load_data()
        model_data, feature_cols = self.engineer_features(games_df, odds_df)
        
        if len(model_data) < 1000:
            print(f'ERROR: Only {len(model_data)} samples. Need more data.')
            return
        
        model, scaler, features = self.train_model(model_data, feature_cols)
        
        print('\n' + '='*70)
        print('TRAINING COMPLETE')
        print('='*70)

if __name__ == '__main__':
    trainer = NBAMLTrainerV2()
    trainer.run()
