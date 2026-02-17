#!/usr/bin/env python3
"""
Analyze Data Sources Before Merge
Check structure, team names, dates to find merge issues
"""

import duckdb
import pandas as pd

def analyze_database():
    print('='*70)
    print('ANALYSE DES SOURCES DE DONNEES')
    print('='*70)
    
    conn = duckdb.connect('./nba-data/analytics.duckdb')
    
    # 1. Analyze github_games
    print('\n1. TABLE: github_games')
    print('-'*70)
    
    games_sample = conn.execute('''
        SELECT * FROM github_games LIMIT 5
    ''').fetchdf()
    
    print('Sample rows:')
    print(games_sample[['season', 'date', 'home_team', 'away_team', 'home_score', 'away_score']].to_string())
    
    print('\nUnique seasons:', conn.execute('SELECT DISTINCT season FROM github_games ORDER BY season').fetchall())
    print('Total games:', conn.execute('SELECT COUNT(*) FROM github_games').fetchone()[0])
    
    print('\nUnique home teams (first 10):')
    teams = conn.execute('SELECT DISTINCT home_team FROM github_games LIMIT 10').fetchdf()
    for team in teams['home_team']:
        print(f'  - "{team}"')
    
    print('\nDate range:')
    dates = conn.execute('SELECT MIN(date), MAX(date) FROM github_games').fetchone()
    print(f'  Min: {dates[0]}')
    print(f'  Max: {dates[1]}')
    
    # 2. Analyze odds_historical
    print('\n\n2. TABLE: odds_historical')
    print('-'*70)
    
    odds_sample = conn.execute('''
        SELECT * FROM odds_historical LIMIT 5
    ''').fetchdf()
    
    print('Sample rows:')
    print(odds_sample[['season', 'date', 'home_team', 'away_team', 'spread', 'over_under']].to_string())
    
    print('\nUnique seasons:', conn.execute('SELECT DISTINCT season FROM odds_historical ORDER BY season').fetchall())
    print('Total odds entries:', conn.execute('SELECT COUNT(*) FROM odds_historical').fetchone()[0])
    
    print('\nUnique home teams (first 10):')
    teams = conn.execute('SELECT DISTINCT home_team FROM odds_historical LIMIT 10').fetchdf()
    for team in teams['home_team']:
        print(f'  - "{team}"')
    
    print('\nDate range:')
    dates = conn.execute('SELECT MIN(date), MAX(date) FROM odds_historical').fetchone()
    print(f'  Min: {dates[0]}')
    print(f'  Max: {dates[1]}')
    
    # 3. Check for matching teams
    print('\n\n3. VERIFICATION DES CORRESPONDANCES')
    print('-'*70)
    
    games_teams = conn.execute('SELECT DISTINCT home_team FROM github_games').fetchdf()['home_team'].tolist()
    odds_teams = conn.execute('SELECT DISTINCT home_team FROM odds_historical').fetchdf()['home_team'].tolist()
    
    print(f'Teams in games: {len(games_teams)}')
    print(f'Teams in odds: {len(odds_teams)}')
    
    # Normalize and compare
    games_teams_clean = [t.strip().lower() for t in games_teams]
    odds_teams_clean = [t.strip().lower() for t in odds_teams]
    
    print('\nSample team comparison:')
    print('Games teams (first 5):', games_teams_clean[:5])
    print('Odds teams (first 5):', odds_teams_clean[:5])
    
    # Find matching teams
    common_teams = set(games_teams_clean) & set(odds_teams_clean)
    games_only = set(games_teams_clean) - set(odds_teams_clean)
    odds_only = set(odds_teams_clean) - set(games_teams_clean)
    
    print(f'\nCommon teams: {len(common_teams)}')
    print(f'Teams only in games: {len(games_only)}')
    print(f'Teams only in odds: {len(odds_only)}')
    
    if games_only:
        print('\nTeams only in games (first 10):')
        for team in sorted(games_only)[:10]:
            print(f'  - "{team}"')
    
    if odds_only:
        print('\nTeams only in odds (first 10):')
        for team in sorted(odds_only)[:10]:
            print(f'  - "{team}"')
    
    # 4. Check season overlap
    print('\n\n4. CHEVAUCHEMENT DES SAISONS')
    print('-'*70)
    
    games_seasons = conn.execute('SELECT DISTINCT season FROM github_games ORDER BY season').fetchdf()['season'].tolist()
    odds_seasons = conn.execute('SELECT DISTINCT season FROM odds_historical ORDER BY season').fetchdf()['season'].tolist()
    
    print('Games seasons:', games_seasons)
    print('Odds seasons:', odds_seasons)
    
    common_seasons = set(games_seasons) & set(odds_seasons)
    print(f'\nCommon seasons: {sorted(common_seasons)}')
    
    # 5. Test merge on one season
    print('\n\n5. TEST DE MERGE (Saison 2010)')
    print('-'*70)
    
    test_merge = conn.execute('''
        SELECT 
            g.season,
            g.home_team as g_home,
            g.away_team as g_away,
            o.home_team as o_home,
            o.away_team as o_away
        FROM github_games g
        LEFT JOIN odds_historical o 
            ON g.season = o.season 
            AND LOWER(TRIM(g.home_team)) = LOWER(TRIM(o.home_team))
            AND LOWER(TRIM(g.away_team)) = LOWER(TRIM(o.away_team))
        WHERE g.season = 2010
        LIMIT 10
    ''').fetchdf()
    
    print(f'Merge test - {len(test_merge)} rows')
    print(test_merge.to_string())
    
    matches = conn.execute('''
        SELECT COUNT(*)
        FROM github_games g
        INNER JOIN odds_historical o 
            ON g.season = o.season 
            AND LOWER(TRIM(g.home_team)) = LOWER(TRIM(o.home_team))
            AND LOWER(TRIM(g.away_team)) = LOWER(TRIM(o.away_team))
        WHERE g.season = 2010
    ''').fetchone()[0]
    
    total_games_2010 = conn.execute("SELECT COUNT(*) FROM github_games WHERE season = 2010").fetchone()[0]
    print(f'\nMatches found for 2010: {matches}/{total_games_2010} ({matches/total_games_2010*100:.1f}%)')
    
    conn.close()
    
    print('\n' + '='*70)
    print('ANALYSE TERMINEE')
    print('='*70)

if __name__ == '__main__':
    analyze_database()
