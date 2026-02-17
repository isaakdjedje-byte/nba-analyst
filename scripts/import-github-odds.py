#!/usr/bin/env python3
"""
Import NBA Odds from GitHub Repository
Source: kyleskom/NBA-Machine-Learning-Sports-Betting
"""

import sqlite3
import os
import sys

# Add project root to path for duckdb
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_season_tables(db_path):
    """Get list of odds tables from the database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'odds_%'")
    tables = cursor.fetchall()
    
    season_tables = []
    for (table_name,) in tables:
        # Extract season from table name (e.g., "odds_2010-11" -> 2010)
        import re
        match = re.match(r'odds_(\d{4})-\d{2}', table_name)
        if match:
            season = int(match.group(1))
            if season >= 2010:
                season_tables.append({
                    'name': table_name,
                    'season': season
                })
    
    conn.close()
    return sorted(season_tables, key=lambda x: x['season'])

def get_table_columns(conn, table_name):
    """Get column names from a table"""
    cursor = conn.cursor()
    cursor.execute(f'PRAGMA table_info("{table_name}")')
    columns = cursor.fetchall()
    return [col[1] for col in columns]

def main():
    data_dir = './data/github-odds'
    db_path = os.path.join(data_dir, 'OddsData.sqlite')
    
    print('===============================================================')
    print('     Importing NBA Odds from GitHub (kyleskom)')
    print('===============================================================\n')
    
    if not os.path.exists(db_path):
        print(f'Error: {db_path} not found')
        sys.exit(1)
    
    # Connect to SQLite
    print('Analyzing database structure...')
    conn = sqlite3.connect(db_path)
    
    # Get season tables
    tables = get_season_tables(db_path)
    print(f'Found {len(tables)} season tables from 2010+\n')
    
    # Check columns from first table
    if tables:
        columns = get_table_columns(conn, tables[0]['name'])
        print(f'Columns in {tables[0]["name"]}:')
        print(f'  {columns}\n')
    
    conn.close()
    
    print('Now you can run the TypeScript import script:')
    print('  npm run import:github-odds')
    print('\nOr query directly with:')
    print(f'  sqlite3 {db_path}')

if __name__ == '__main__':
    main()
