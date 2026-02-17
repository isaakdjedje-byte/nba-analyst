#!/usr/bin/env python3
"""
Create Team Name Mapping Table
Map abbreviations to full names for proper merging
"""

import duckdb

# NBA team abbreviations to full names mapping
TEAM_MAPPING = {
    'ATL': 'Atlanta Hawks',
    'BOS': 'Boston Celtics',
    'BRK': 'Brooklyn Nets',
    'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',
    'CHO': 'Charlotte Hornets',  # Old abbreviation
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
    'NYN': 'New Jersey Nets',  # Old name
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
    'NJN': 'New Jersey Nets',  # Old abbreviation
    'NOH': 'New Orleans Hornets',  # Old name
    'CHA': 'Charlotte Bobcats',  # Old name
    'SEA': 'Seattle SuperSonics',  # Old team
    'VAN': 'Vancouver Grizzlies',  # Old team
    'KCK': 'Kansas City Kings',  # Very old
    'SDC': 'San Diego Clippers',  # Old
}

def create_mapping_table():
    print('Creating team mapping table...')
    
    conn = duckdb.connect('./nba-data/analytics.duckdb')
    
    # Create table
    conn.execute('''
        DROP TABLE IF EXISTS team_mapping;
        CREATE TABLE team_mapping (
            abbreviation VARCHAR PRIMARY KEY,
            full_name VARCHAR
        )
    ''')
    
    # Insert mappings
    for abbr, name in TEAM_MAPPING.items():
        conn.execute(f"""
            INSERT INTO team_mapping (abbreviation, full_name)
            VALUES ('{abbr}', '{name.replace("'", "''")}')
        """)
    
    conn.commit()
    
    # Verify
    count = conn.execute('SELECT COUNT(*) FROM team_mapping').fetchone()[0]
    print(f'Created {count} team mappings')
    
    print('\nSample mappings:')
    result = conn.execute('SELECT * FROM team_mapping LIMIT 10').fetchall()
    for row in result:
        print(f'  {row[0]} -> {row[1]}')
    
    conn.close()
    print('\nTeam mapping table created!')

if __name__ == '__main__':
    create_mapping_table()
