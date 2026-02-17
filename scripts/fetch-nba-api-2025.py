#!/usr/bin/env python3
"""
Fetch NBA Games 2024-2026 via NBA.com API
Uses nba_api to get official NBA data
"""

import subprocess
import sys

# Install nba_api if not present
try:
    from nba_api.stats.endpoints import leaguegamefinder
    from nba_api.stats.library.parameters import Season
except ImportError:
    print('Installing nba_api...')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'nba_api', '--quiet'])
    from nba_api.stats.endpoints import leaguegamefinder
    from nba_api.stats.library.parameters import Season

import duckdb
import pandas as pd
from datetime import datetime
import time

class NBAAPIDataFetcher:
    def __init__(self):
        self.db_path = './nba-data/analytics.duckdb'
        
    def fetch_season(self, season_str):
        """Fetch games for a specific season"""
        print(f'\nFetching season {season_str}...')
        
        try:
            # Get all games for the season
            gamefinder = leaguegamefinder.LeagueGameFinder(
                season_nullable=season_str,
                league_id_nullable='00'  # NBA
            )
            
            games_df = gamefinder.get_data_frames()[0]
            
            print(f'  Raw games fetched: {len(games_df)}')
            
            # Filter for regular season games only
            games_df = games_df[games_df['SEASON_ID'].str.contains('2')]
            print(f'  Regular season games: {len(games_df)}')
            
            return games_df
            
        except Exception as e:
            print(f'  Error: {e}')
            return pd.DataFrame()
    
    def process_games(self, games_df, season_year):
        """Process games into standard format"""
        print(f'\nProcessing games for {season_year}...')
        
        # Group by game_id to get both teams
        games_list = []
        
        for game_id in games_df['GAME_ID'].unique():
            game_teams = games_df[games_df['GAME_ID'] == game_id]
            
            if len(game_teams) != 2:
                continue
            
            # Identify home and away
            home_team = game_teams[game_teams['MATCHUP'].str.contains('vs.')]
            away_team = game_teams[game_teams['MATCHUP'].str.contains('@')]
            
            if len(home_team) != 1 or len(away_team) != 1:
                continue
            
            home = home_team.iloc[0]
            away = away_team.iloc[0]
            
            games_list.append({
                'game_id': game_id,
                'date': pd.to_datetime(home['GAME_DATE']).strftime('%Y-%m-%d'),
                'season': season_year,
                'home_team': home['TEAM_NAME'],
                'away_team': away['TEAM_NAME'],
                'home_score': home['PTS'],
                'away_score': away['PTS'],
                'winner': home['TEAM_NAME'] if home['PTS'] > away['PTS'] else away['TEAM_NAME'],
                'home_win': 1 if home['PTS'] > away['PTS'] else 0,
                'source': 'nba_api'
            })
        
        result_df = pd.DataFrame(games_list)
        print(f'  Processed {len(result_df)} games')
        return result_df
    
    def save_to_db(self, games_df, season_year):
        """Save games to database"""
        print(f'\nSaving {season_year} games to database...')
        conn = duckdb.connect(self.db_path)
        
        # Create table if not exists
        conn.execute('''
            CREATE TABLE IF NOT EXISTS nba_api_games (
                game_id VARCHAR PRIMARY KEY,
                date DATE,
                season INTEGER,
                home_team VARCHAR,
                away_team VARCHAR,
                home_score INTEGER,
                away_score INTEGER,
                winner VARCHAR,
                source VARCHAR DEFAULT 'nba_api',
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Delete existing data for this season
        conn.execute(f"DELETE FROM nba_api_games WHERE season = {season_year}")
        
        # Insert new data
        if len(games_df) > 0:
            conn.execute(f"""
                INSERT INTO nba_api_games 
                SELECT 
                    game_id,
                    date::DATE,
                    season,
                    home_team,
                    away_team,
                    home_score,
                    away_score,
                    winner,
                    source,
                    CURRENT_TIMESTAMP
                FROM games_df
            """)
            
            conn.commit()
            
            # Verify
            count = conn.execute(f"SELECT COUNT(*) FROM nba_api_games WHERE season = {season_year}").fetchone()[0]
            print(f'  Saved {count} games')
        
        conn.close()
    
    def run(self):
        """Main execution"""
        print('='*70)
        print('NBA API DATA FETCHER')
        print('='*70)
        
        seasons_to_fetch = [
            ('2024-25', 2024),
            ('2025-26', 2025)
        ]
        
        total_games = 0
        
        for season_str, season_year in seasons_to_fetch:
            print(f'\n{"="*70}')
            print(f'SEASON: {season_str}')
            print(f'{"="*70}')
            
            # Fetch
            raw_games = self.fetch_season(season_str)
            
            if len(raw_games) == 0:
                print(f'  No data found for {season_str}')
                continue
            
            # Process
            processed_games = self.process_games(raw_games, season_year)
            
            # Save
            self.save_to_db(processed_games, season_year)
            
            total_games += len(processed_games)
            
            # Rate limiting
            time.sleep(1)
        
        print(f'\n{"="*70}')
        print(f'TOTAL GAMES FETCHED: {total_games}')
        print(f'{"="*70}')
        
        # Show summary
        conn = duckdb.connect(self.db_path)
        result = conn.execute('''
            SELECT season, COUNT(*) 
            FROM nba_api_games 
            GROUP BY season 
            ORDER BY season
        ''').fetchall()
        
        print('\nDatabase summary:')
        for season, count in result:
            print(f'  {season}: {count} games')
        
        conn.close()

if __name__ == '__main__':
    fetcher = NBAAPIDataFetcher()
    fetcher.run()
