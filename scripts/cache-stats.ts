/**
 * Cache Statistics
 * Show Redis cache statistics
 */

import { initCache, closeCache } from '../src/data-fetch/cache/redis-cache';

async function main() {
  console.log('📦 Redis Cache Statistics\n');

  try {
    const cache = await initCache();
    const stats = await cache.getStats();

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    CACHE STATISTICS                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Odds:           ${String(stats.odds).padEnd(44)} ║`);
    console.log(`║  Injuries:       ${String(stats.injuries).padEnd(44)} ║`);
    console.log(`║  Lineups:        ${String(stats.lineups).padEnd(44)} ║`);
    console.log(`║  Live:           ${String(stats.live).padEnd(44)} ║`);
    console.log(`║  Total:          ${String(stats.total).padEnd(44)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Failed to get cache stats:', (error as Error).message);
    process.exit(1);
  } finally {
    await closeCache();
  }
}

main();
