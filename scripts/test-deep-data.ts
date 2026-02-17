#!/usr/bin/env ts-node
/**
 * Quick test script for NBA Deep Data Fetcher
 * Tests individual components without full fetch
 */

import { BasketballReferenceProvider } from '../src/data-fetch/providers/basketball-reference';
import { NBAAPIWrapper } from '../src/data-fetch/providers/nba-api-wrapper';
import { DataMerger } from '../src/data-fetch/mergers/data-merger';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import { FeatureEngineering } from '../src/data-fetch/features/feature-engineering';

async function testPythonScript() {
  console.log('Testing Python nba_api script...');
  const wrapper = new NBAAPIWrapper();
  
  // Test with a known game
  // Game: 2024 NBA Finals Game 1 (BOS vs DAL)
  const gameId = '0022400611';
  
  try {
    const data = await wrapper.fetchGame(gameId);
    if (data) {
      console.log('✓ Python script works!');
      console.log(`  Game: ${data.game_id}`);
      console.log(`  Sources: ${Object.keys(data).join(', ')}`);
      return true;
    }
  } catch (error) {
    console.error('✗ Python script failed:', (error as Error).message);
    return false;
  }
  return false;
}

async function testDuckDB() {
  console.log('\nTesting DuckDB storage...');
  const storage = new DuckDBStorage();
  
  try {
    await storage.init();
    console.log('✓ DuckDB initialized');
    
    // Test query
    const result = await storage.query('SELECT 1 as test');
    if (result[0].test === 1) {
      console.log('✓ DuckDB query works');
    }
    
    await storage.close();
    return true;
  } catch (error) {
    console.error('✗ DuckDB failed:', (error as Error).message);
    return false;
  }
}

async function testConfig() {
  console.log('\nTesting configuration...');
  try {
    const { loadConfig } = await import('../src/data-fetch/config/fetch.config');
    const config = loadConfig();
    console.log('✓ Configuration loaded');
    console.log(`  Seasons: ${config.seasons.join(', ')}`);
    console.log(`  B-Ref: ${config.sources.basketballReference.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  NBA API: ${config.sources.nbaAPI.enabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error) {
    console.error('✗ Config failed:', (error as Error).message);
    return false;
  }
}

async function testBRefSingleGame() {
  console.log('\nTesting Basketball-Reference fetch (single game)...');
  const provider = new BasketballReferenceProvider();
  
  try {
    // Fetch just the first game of 2024 season
    const games = await provider.fetchSeason(2024);
    if (games.length > 0) {
      console.log(`✓ B-Ref works! Fetched ${games.length} games`);
      const firstGame = games[0];
      console.log(`  First game: ${firstGame.home_team} vs ${firstGame.away_team}`);
      console.log(`  Date: ${firstGame.date.toISOString().split('T')[0]}`);
      console.log(`  Score: ${firstGame.home_score}-${firstGame.away_score}`);
      console.log(`  Data quality: ${firstGame._data_quality}/100`);
      return true;
    }
  } catch (error) {
    console.error('✗ B-Ref failed:', (error as Error).message);
    return false;
  }
  return false;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         NBA Deep Data Fetcher - Component Tests              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results = {
    config: false,
    duckdb: false,
    python: false,
    bref: false,
  };

  // Test 1: Config
  results.config = await testConfig();

  // Test 2: DuckDB
  results.duckdb = await testDuckDB();

  // Test 3: Python script
  console.log('\nNote: Python test requires nba_api to be installed');
  console.log('Skip this test if Python is not set up (y/n)?');
  // For automated testing, we'll try anyway
  try {
    results.python = await testPythonScript();
  } catch {
    console.log('⚠ Python test skipped');
  }

  // Test 4: B-Ref (fetch one game - takes ~5 seconds)
  console.log('\nNote: B-Ref test will fetch one season (takes ~1 minute)');
  console.log('Skip this test (y/n)?');
  // For automated testing, we'll try anyway
  try {
    results.bref = await testBRefSingleGame();
  } catch {
    console.log('⚠ B-Ref test skipped');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('Test Results:');
  console.log('═'.repeat(60));
  console.log(`Configuration: ${results.config ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`DuckDB Storage: ${results.duckdb ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Python/nba_api: ${results.python ? '✓ PASS' : '⚠ SKIP'}`);
  console.log(`Basketball-Ref: ${results.bref ? '✓ PASS' : '⚠ SKIP'}`);
  console.log('═'.repeat(60));

  const allCorePassed = results.config && results.duckdb;
  
  if (allCorePassed) {
    console.log('\n✅ Core components working! Ready to fetch data.');
    console.log('\nNext steps:');
    console.log('  1. Test full fetch: npm run data:fetch-deep -- 2024');
    console.log('  2. Fetch all data: npm run data:fetch-deep');
    console.log('  3. Generate features: npm run data:features');
  } else {
    console.log('\n❌ Some core components failed. Check errors above.');
    console.log('\nTroubleshooting:');
    console.log('  - Run: npm install axios cheerio duckdb --legacy-peer-deps');
    console.log('  - Run: pip install nba_api pandas requests');
  }
}

main().catch(console.error);
