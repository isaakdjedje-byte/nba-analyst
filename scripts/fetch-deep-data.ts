#!/usr/bin/env ts-node
/**
 * NBA Deep Data Fetcher - Main Entry Point
 * Fetches 2015-2025 data from multiple sources
 * 
 * Usage:
 *   npm run data:fetch-deep              # Fetch all seasons
 *   npm run data:fetch-deep -- 2024      # Fetch single season
 *   npm run data:fetch-resume            # Resume from checkpoint
 *   npm run data:fetch-status            # Check status
 *   npm run data:features                # Generate features
 */

import { DataFetchOrchestrator } from '../src/data-fetch/orchestrator';
import { FeatureEngineering } from '../src/data-fetch/features/feature-engineering';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            NBA DEEP DATA FETCHER v2.0                        ║');
  console.log('║     Multi-Source: B-Ref + NBA API + Features                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    switch (command) {
      case 'resume':
        console.log('🔄 Resuming from checkpoint...\n');
        const resumeOrchestrator = new DataFetchOrchestrator();
        await resumeOrchestrator.resumeFromCheckpoint();
        break;

      case 'status':
        const statusOrchestrator = new DataFetchOrchestrator();
        await statusOrchestrator.getStatus();
        break;

      case 'features':
        console.log('⚙️  Generating advanced features...\n');
        const engineer = new FeatureEngineering();
        await engineer.generateAllFeatures();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        // Check if specific season provided
        const season = parseInt(command || '');
        if (!isNaN(season)) {
          console.log(`📅 Fetching season ${season}...\n`);
          const orchestrator = new DataFetchOrchestrator();
          // Note: Need to modify orchestrator to accept single season
          console.log('⚠️  Single season fetch not yet implemented, fetching all');
          await orchestrator.fetchAllData();
        } else {
          // Fetch all
          console.log('📅 Fetching all seasons (2015-2025)...\n');
          const orchestrator = new DataFetchOrchestrator();
          await orchestrator.fetchAllData();
        }
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Usage: npm run data:fetch-deep [command|season]

Commands:
  (none)          Fetch all seasons (2015-2025)
  <season>        Fetch specific season (e.g., 2024)
  resume          Resume from last checkpoint
  status          Show current fetch status
  features        Generate ML features from fetched data
  help            Show this help

Examples:
  npm run data:fetch-deep              # Fetch everything
  npm run data:fetch-deep -- 2024      # Fetch 2024 season only
  npm run data:fetch-resume            # Resume interrupted fetch
  npm run data:features                # Generate features

Data Sources:
  - Basketball-Reference: Box scores, play-by-play, Four Factors
  - NBA API: Player tracking, shot charts, hustle stats
  - ESPN: Backup for real-time data

Storage:
  - DuckDB: ./nba-data/analytics.duckdb (analytics & ML)
  - PostgreSQL: Application database

Duration: ~10-12 hours for complete 2015-2025 dataset
Progress is saved every 10 games, can resume anytime.
`);
}

main();
