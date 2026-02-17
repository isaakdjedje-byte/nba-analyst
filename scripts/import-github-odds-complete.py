#!/usr/bin/env python3
"""
Import NBA Odds from GitHub Repository (Complete Version)
Source: kyleskom/NBA-Machine-Learning-Sports-Betting
Imports all odds data from multiple season tables into DuckDB
"""

import sqlite3
import duckdb
import os
import sys
import re
from datetime import datetime

def get_season_tables(db_path):
    """Get list of odds tables from the database, sorted by season"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'odds_%'")
    tables = cursor.fetchall()
    
    season_tables = []
    for (table_name,) in tables:
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

def parse_date(date_str):
    """Parse date from various formats"""
    try:
        # Try different date formats
        for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y']:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except:
                continue
    except:
        pass
    return date_str  # Return original if parsing fails

def import_data():
    """Main import function"""
    data_dir = './data/github-odds'
    db_path = os.path.join(data_dir, 'OddsData.sqlite')
    duckdb_path = './nba-data/analytics.duckdb'
    
    print('=' * 65)
    print('Importing NBA Odds from GitHub (kyleskom)')
    print('=' * 65)
    print()
    
    if not os.path.exists(db_path):
        print(f'Error: {db_path} not found')
        sys.exit(1)
    
    # Connect to DuckDB
    print('Connecting to DuckDB...')
    conn = duckdb.connect(duckdb_path)
    
    # Create table
    print('Creating odds_historical table...')
    conn.execute('''
        DROP TABLE IF EXISTS odds_historical;
        CREATE TABLE odds_historical (
            season INTEGER,
            date DATE,
            home_team VARCHAR,
            away_team VARCHAR,
            over_under FLOAT,
            spread FLOAT,
            ml_home VARCHAR,
            ml_away VARCHAR,
            total_points INTEGER,
            win_margin INTEGER,
            days_rest_home INTEGER,
            days_rest_away INTEGER,
            source VARCHAR DEFAULT 'kyleskom'
        )
    ''')
    print()
    
    # Get season tables
    print('Analyzing SQLite database...')
    tables = get_season_tables(db_path)
    print(f'Found {len(tables)} season tables from 2010+')
    print()
    
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(db_path)
    sqlite_cursor = sqlite_conn.cursor()
    
    total_imported = 0
    
    # Import each season
    for table in tables:
        try:
            # Query data from SQLite
            sqlite_cursor.execute(f'SELECT * FROM "{table["name"]}"')
            rows = sqlite_cursor.fetchall()
            
            # Get column names
            columns = [description[0] for description in sqlite_cursor.description]
            
            # Map columns to our schema
            col_map = {col.lower().replace(' ', '_'): col for col in columns}
            
            # Prepare data for insertion
            data_to_insert = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                
                # Extract values with defaults
                date_val = parse_date(row_dict.get('Date', ''))
                home_team = row_dict.get('Home', '')
                away_team = row_dict.get('Away', '')
                ou = float(row_dict.get('OU', 0) or 0)
                spread = float(row_dict.get('Spread', 0) or 0)
                ml_home = str(row_dict.get('ML_Home', ''))
                ml_away = str(row_dict.get('ML_Away', ''))
                points = int(row_dict.get('Points', 0) or 0)
                win_margin = int(row_dict.get('Win_Margin', 0) or 0)
                days_rest_home = int(row_dict.get('Days_Rest_Home', 0) or 0)
                days_rest_away = int(row_dict.get('Days_Rest_Away', 0) or 0)
                
                data_to_insert.append((
                    table['season'],
                    date_val,
                    home_team,
                    away_team,
                    ou,
                    spread,
                    ml_home,
                    ml_away,
                    points,
                    win_margin,
                    days_rest_home,
                    days_rest_away,
                    'kyleskom'
                ))
            
            # Insert into DuckDB
            if data_to_insert:
                conn.executemany('''
                    INSERT INTO odds_historical 
                    (season, date, home_team, away_team, over_under, spread, ml_home, ml_away, 
                     total_points, win_margin, days_rest_home, days_rest_away, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', data_to_insert)
                
                total_imported += len(data_to_insert)
                print(f'  {table["season"]}-{table["season"]+1}: {len(data_to_insert)} games')
                
        except Exception as e:
            print(f'  Warning: Failed to import {table["name"]}: {e}')
    
    sqlite_conn.close()
    
    # Create indexes
    print()
    print('Creating indexes...')
    conn.execute('CREATE INDEX idx_odds_date ON odds_historical(date)')
    conn.execute('CREATE INDEX idx_odds_season ON odds_historical(season)')
    conn.execute('CREATE INDEX idx_odds_home ON odds_historical(home_team)')
    conn.execute('CREATE INDEX idx_odds_away ON odds_historical(away_team)')
    
    # Print summary
    print()
    print('Summary:')
    print(f'  Total imported: {total_imported} odds records')
    
    result = conn.execute('''
        SELECT season, COUNT(*) as games 
        FROM odds_historical 
        GROUP BY season 
        ORDER BY season
    ''').fetchall()
    
    print()
    print('  By Season:')
    for row in result:
        print(f'    {row[0]}-{row[0]+1}: {row[1]} games')
    
    conn.close()
    
    print()
    print('=' * 65)
    print('Import complete!')
    print('=' * 65)

if __name__ == '__main__':
    import_data()
