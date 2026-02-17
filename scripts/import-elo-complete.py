#!/usr/bin/env python3
"""
Import Complete ELO Data 2016-2025
Source: Neil-Paine-1/NBA-elo GitHub
"""

import duckdb
import pandas as pd
from datetime import datetime

# Team mapping from abbreviations to full names
TEAM_MAP = {
    'ATL': 'Atlanta Hawks',
    'BOS': 'Boston Celtics',
    'BRK': 'Brooklyn Nets',
    'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',
    'CHO': 'Charlotte Hornets',
    'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks',
    'DEN': 'Denver Nuggets',
    'DET': 'Detroit Pistons',
    'GSW': 'Golden State Warriors',
    'HOU': 'Houston Rockets',
    'IND': 'Indiana Pacers',
    'LAC': 'LA Clippers',
    'LAL': 'Los Angeles Lakers',
    'MEM': 'Memphis Grizzlies',
    'MIA': 'Miami Heat',
    'MIL': 'Milwaukee Bucks',
    'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans',
    'NYK': 'New York Knicks',
    'NYN': 'New Jersey Nets',
    'OKC': 'Oklahoma City Thunder',
    'ORL': 'Orlando Magic',
    'PHI': 'Philadelphia 76ers',
    'PHO': 'Phoenix Suns',
    'PHX': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers',
    'SAC': 'Sacramento Kings',
    'SAS': 'San Antonio Spurs',
    'TOR': 'Toronto Raptors',
    'UTA': 'Utah Jazz',
    'WAS': 'Washington Wizards',
    'NJN': 'New Jersey Nets',
    'NOH': 'New Orleans Hornets',
    'SEA': 'Seattle SuperSonics',
    'VAN': 'Vancouver Grizzlies',
    'KCK': 'Kansas City Kings',
    'SDC': 'San Diego Clippers',
    'CHS': 'Chicago Stags',
    'STB': 'St. Louis Bombers',
    'PRO': 'Providence Steamrollers',
    'PIT': 'Pittsburgh Ironmen',
    'DTF': 'Detroit Falcons',
    'WSC': 'Washington Capitols',
    'TRH': 'Toronto Huskies',
}

print('='*70)
print('IMPORT ELO COMPLET 2016-2025')
print('='*70)

# Load ELO data
print('\n1. Loading ELO CSV from GitHub...')
df_elo = pd.read_csv('data/nba_elo_github.csv')
print(f'   Total ELO entries: {len(df_elo)}')

# Filter for seasons we need (2016-2025)
df_elo = df_elo[df_elo['season'].between(2016, 2025)]
print(f'   ELO entries 2016-2025: {len(df_elo)}')

# Map team abbreviations to full names
print('\n2. Mapping team names...')
df_elo['home_team_full'] = df_elo['team1'].map(TEAM_MAP)
df_elo['away_team_full'] = df_elo['team2'].map(TEAM_MAP)

# Check for unmapped teams
unmapped = df_elo[df_elo['home_team_full'].isna()]['team1'].unique()
if len(unmapped) > 0:
    print(f'   Warning: Unmapped teams: {unmapped}')

# Connect to database
print('\n3. Connecting to database...')
conn = duckdb.connect('./nba-data/analytics.duckdb')

# Create temporary table for ELO data
print('\n4. Creating ELO staging table...')
conn.execute('DROP TABLE IF EXISTS elo_staging')
conn.execute('''
    CREATE TABLE elo_staging (
        date DATE,
        season INTEGER,
        team1 VARCHAR,
        team2 VARCHAR,
        home_team_full VARCHAR,
        away_team_full VARCHAR,
        elo1_pre FLOAT,
        elo2_pre FLOAT,
        elo1_post FLOAT,
        elo2_post FLOAT,
        score1 INTEGER,
        score2 INTEGER
    )
''')

# Insert ELO data
print('\n5. Inserting ELO data...')
for _, row in df_elo.iterrows():
    conn.execute(f'''
        INSERT INTO elo_staging VALUES (
            '{row['date']}',
            {row['season']},
            '{row['team1']}',
            '{row['team2']}',
            '{row['home_team_full'] if pd.notna(row['home_team_full']) else ''}',
            '{row['away_team_full'] if pd.notna(row['away_team_full']) else ''}',
            {row['elo1_pre']},
            {row['elo2_pre']},
            {row['elo1_post']},
            {row['elo2_post']},
            {row['score1']},
            {row['score2']}
        )
    ''')

count = conn.execute('SELECT COUNT(*) FROM elo_staging').fetchone()[0]
print(f'   Inserted {count} ELO records')

# Update github_games with ELO
print('\n6. Updating github_games with ELO...')

# Update 2016-2025 seasons
conn.execute('''
    UPDATE github_games g
    SET 
        elo_home_before = e.elo1_pre,
        elo_home_after = e.elo1_post,
        elo_away_before = e.elo2_pre,
        elo_away_after = e.elo2_post
    FROM elo_staging e
    WHERE g.season = e.season
    AND g.season BETWEEN 2016 AND 2025
    AND (
        (LOWER(TRIM(g.home_team)) = LOWER(TRIM(e.home_team_full)) 
         AND LOWER(TRIM(g.away_team)) = LOWER(TRIM(e.away_team_full)))
        OR
        (g.home_team = e.team1 AND g.away_team = e.team2)
    )
''')

# Check results
print('\n7. Verification...')
result = conn.execute('''
    SELECT 
        season,
        COUNT(*) as total,
        COUNT(CASE WHEN elo_home_before IS NOT NULL THEN 1 END) as with_elo
    FROM github_games
    GROUP BY season
    ORDER BY season
''').fetchdf()

print('\n   ELO Coverage after update:')
print(result.to_string(index=False))

# Calculate missing
missing = conn.execute('''
    SELECT season, COUNT(*) as missing
    FROM github_games
    WHERE elo_home_before IS NULL
    GROUP BY season
    ORDER BY season
''').fetchdf()

if len(missing) > 0:
    print('\n   Still missing ELO:')
    print(missing.to_string(index=False))
else:
    print('\n   ✅ All games now have ELO!')

# Cleanup
conn.execute('DROP TABLE IF EXISTS elo_staging')
conn.commit()
conn.close()

print('\n' + '='*70)
print('ELO IMPORT COMPLETE')
print('='*70)
