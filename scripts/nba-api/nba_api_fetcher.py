#!/usr/bin/env python3
"""
NBA API Data Fetcher
Wraps nba_api library to fetch tracking data from stats.nba.com
Called from Node.js via Python shell
"""

import sys
import json
import time
import argparse
from nba_api.stats.endpoints import (
    boxscoretraditionalv2,
    boxscoreplayertrackv2,
    shotchartdetail,
    playbyplayv2,
    hustlestatsboxscore,
    boxscoreadvancedv2,
    boxscorematchups,
)
from nba_api.stats.library.parameters import LeagueID


class NBAAPIScraper:
    """Fetches detailed NBA data from official NBA Stats API"""
    
    def __init__(self, rate_limit=0.6):
        """
        Initialize scraper with rate limiting
        rate_limit: seconds between requests (default 0.6 = 10 req/min)
        """
        self.rate_limit = rate_limit
        self.last_request_time = 0
    
    def _apply_rate_limit(self):
        """Apply rate limiting between requests"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit:
            time.sleep(self.rate_limit - elapsed)
        self.last_request_time = time.time()
    
    def fetch_game(self, game_id: str) -> dict:
        """
        Fetch all available data for a single game
        
        Args:
            game_id: NBA API game ID (format: 0022300961)
            
        Returns:
            Dictionary with all fetched data
        """
        data = {
            'game_id': game_id,
            'boxscore_traditional': None,
            'boxscore_advanced': None,
            'player_tracking': None,
            'shot_charts': None,
            'play_by_play': None,
            'hustle_stats': None,
            'matchups': None,
            'errors': []
        }
        
        print(f"Fetching game {game_id}...", file=sys.stderr)
        
        # 1. Box Score Traditional (basic stats)
        try:
            self._apply_rate_limit()
            box = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
            data['boxscore_traditional'] = box.get_normalized_dict()
            print(f"  ✓ Box score traditional", file=sys.stderr)
        except Exception as e:
            error_msg = f"Box score traditional failed: {str(e)}"
            data['errors'].append(error_msg)
            print(f"  ✗ {error_msg}", file=sys.stderr)
        
        # 2. Box Score Advanced
        try:
            self._apply_rate_limit()
            advanced = boxscoreadvancedv2.BoxScoreAdvancedV2(game_id=game_id)
            data['boxscore_advanced'] = advanced.get_normalized_dict()
            print(f"  ✓ Box score advanced", file=sys.stderr)
        except Exception as e:
            error_msg = f"Box score advanced failed: {str(e)}"
            data['errors'].append(error_msg)
            print(f"  ✗ {error_msg}", file=sys.stderr)
        
        # 3. Player Tracking (speed, distance, touches)
        try:
            self._apply_rate_limit()
            tracking = boxscoreplayertrackv2.BoxScorePlayerTrackV2(game_id=game_id)
            data['player_tracking'] = tracking.get_normalized_dict()
            print(f"  ✓ Player tracking", file=sys.stderr)
        except Exception as e:
            error_msg = f"Player tracking failed: {str(e)}"
            data['errors'].append(error_msg)
            print(f"  ✗ {error_msg}", file=sys.stderr)
        
        # 4. Shot Charts (coordinates)
        try:
            self._apply_rate_limit()
            # Need team_id and player_id, but we can use 0 for all
            shots = shotchartdetail.ShotChartDetail(
                team_id=0,
                player_id=0,
                game_id_nullable=game_id,
                context_measure_simple='FGA'
            )
            data['shot_charts'] = shots.get_normalized_dict()
            print(f"  ✓ Shot charts ({len(data['shot_charts'].get('Shot_Chart_Detail', []))} shots)", file=sys.stderr)
        except Exception as e:
            error_msg = f"Shot charts failed: {str(e)}"
            data['errors'].append(error_msg)
            print(f"  ✗ {error_msg}", file=sys.stderr)
        
        # 5. Play-by-Play
        try:
            self._apply_rate_limit()
            pbp = playbyplayv2.PlayByPlayV2(game_id=game_id)
            data['play_by_play'] = pbp.get_normalized_dict()
            print(f"  ✓ Play-by-play ({len(data['play_by_play'].get('PlayByPlay', []))} events)", file=sys.stderr)
        except Exception as e:
            error_msg = f"Play-by-play failed: {str(e)}"
            data['errors'].append(error_msg)
            print(f"  ✗ {error_msg}", file=sys.stderr)
        
        # 6. Hustle Stats (loose balls, deflections - not available for all games)
        try:
            self._apply_rate_limit()
            hustle = hustlestatsboxscore.HustleStatsBoxScore(game_id=game_id)
            data['hustle_stats'] = hustle.get_normalized_dict()
            print(f"  ✓ Hustle stats", file=sys.stderr)
        except Exception as e:
            # Hustle stats not available for older games, don't treat as error
            print(f"  ⚠ Hustle stats not available (normal for older games)", file=sys.stderr)
        
        # 7. Matchups (defensive matchups)
        try:
            self._apply_rate_limit()
            matchups = boxscorematchups.BoxScoreMatchups(game_id=game_id)
            data['matchups'] = matchups.get_normalized_dict()
            print(f"  ✓ Matchups", file=sys.stderr)
        except Exception as e:
            # Matchups not available for older games
            print(f"  ⚠ Matchups not available (normal for older games)", file=sys.stderr)
        
        return data
    
    def fetch_season_games(self, season: str, season_type: str = 'Regular Season') -> list:
        """
        Fetch all games for a season
        
        Args:
            season: Season string (e.g., '2023-24')
            season_type: 'Regular Season', 'Playoffs', 'Pre Season'
            
        Returns:
            List of game IDs
        """
        from nba_api.stats.endpoints import leaguegamefinder
        
        self._apply_rate_limit()
        
        game_finder = leaguegamefinder.LeagueGameFinder(
            season_nullable=season,
            season_type_nullable=season_type,
            league_id_nullable=LeagueID.nba
        )
        
        games = game_finder.get_normalized_dict()
        game_ids = list(set([game['GAME_ID'] for game in games.get('LeagueGameFinderResults', [])]))
        
        return game_ids


def main():
    parser = argparse.ArgumentParser(description='NBA API Data Fetcher')
    parser.add_argument('--game-id', help='Fetch single game by ID')
    parser.add_argument('--season', help='Fetch all games for season (e.g., 2023-24)')
    parser.add_argument('--rate-limit', type=float, default=0.6, help='Rate limit in seconds')
    
    args = parser.parse_args()
    
    scraper = NBAAPIScraper(rate_limit=args.rate_limit)
    
    if args.game_id:
        # Fetch single game
        result = scraper.fetch_game(args.game_id)
        print(json.dumps(result, indent=2))
    
    elif args.season:
        # Fetch all games for season
        print(f"Fetching all games for season {args.season}...", file=sys.stderr)
        game_ids = scraper.fetch_season_games(args.season)
        print(f"Found {len(game_ids)} games", file=sys.stderr)
        
        all_games = []
        for i, game_id in enumerate(game_ids):
            print(f"\n[{i+1}/{len(game_ids)}] Game {game_id}", file=sys.stderr)
            game_data = scraper.fetch_game(game_id)
            all_games.append(game_data)
        
        print(json.dumps(all_games, indent=2))
    
    else:
        print("Error: Must specify --game-id or --season", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
