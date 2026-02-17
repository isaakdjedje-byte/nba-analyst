/**
 * Clear Cache
 * Clear all Redis cache
 */

import { initCache, closeCache } from '../src/data-fetch/cache/redis-cache';

async function main() {
  console.log('🗑️  Clearing Redis Cache...\n');

  try {
    const cache = await initCache();
    await cache.flushAll();

    console.log('✅ Cache cleared successfully\n');

  } catch (error) {
    console.error('❌ Failed to clear cache:', (error as Error).message);
    process.exit(1);
  } finally {
    await closeCache();
  }
}

main();
