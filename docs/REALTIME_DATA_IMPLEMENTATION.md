# Implementation Completee - Donnees NBA Temps Reel

## Architecture Implementee

```
┌─────────────────────────────────────────────────────────────┐
│                    COUCHE TEMPS REEL                        │
│                      (Redis Cache)                          │
├─────────────────────────────────────────────────────────────┤
│  Odds du jour        →  TTL: 24h                         │
│  Injury reports      →  TTL: 6h                          │
│  Starting lineups    →  TTL: 12h                         │
│  Live game data      →  TTL: 2h                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    COUCHE ANALYTIQUE                        │
│                    (DuckDB Persistant)                      │
├─────────────────────────────────────────────────────────────┤
│  github_games        →  2010-2024 (18,000 matchs)        │
│  odds_historical     →  2008-2024 (Kaggle)               │
│  injuries_historical →  2010-2021                          │
│  features_ml         →  80+ features calculees           │
└─────────────────────────────────────────────────────────────┘
```

## Fichiers Crees

### 1. Cache Layer
- `src/data-fetch/cache/redis-cache.ts` - Service Redis avec TTL

### 2. Providers Temps Reel
- `src/data-fetch/providers/odds-realtime.ts` - The Odds API (2020-2026)
- `src/data-fetch/providers/injuries-realtime.ts` - ESPN/NBA Injuries
- `src/data-fetch/providers/espn-lineups.ts` - ESPN Lineups

### 3. Feature Engineering
- `src/data-fetch/features/live-features.ts` - Features temps reel

### 4. Scripts Import Historique
- `scripts/import-github-data.ts` - Dataset GitHub 2010-2024
- `scripts/import-kaggle-odds.ts` - Kaggle Odds 2008-2023
- `scripts/import-historical-injuries.ts` - Blessures historiques

### 5. Pipelines Automatises
- `scripts/evening-pipeline.ts` - Pipeline soir (18h-20h)
- `scripts/post-game-pipeline.ts` - Pipeline post-match (22h-23h)

## Commandes NPM

```bash
# Installation des dependances
npm install

# Import des donnees historiques
npm run import:github          # GitHub dataset
npm run import:kaggle          # Kaggle odds
npm run import:injuries        # Blessures historiques

# Pipelines automatises
npm run pipeline:evening       # Pipeline soir (18h)
npm run pipeline:pre-game      # Pre-game (20h)
npm run pipeline:post-game     # Post-match (22h)

# Cache Redis
npm run cache:clear            # Vider le cache
npm run cache:stats            # Statistiques cache
```

## Configuration

Ajoutez ces variables dans `.env`:

```env
# Redis
REDIS_URL=redis://localhost:6379

# The Odds API
THE_ODDS_API_KEY=8b930b318df066da353304ff5167ad77

# ESPN (pas de cle requise)
ESPN_API_URL=https://site.api.espn.com/apis/site/v2/sports/basketball/nba
```

## Workflows Automatises

### Soir (18h00)
```typescript
npm run pipeline:evening
```
1. Fetch odds ouverture
2. Fetch injury reports
3. Fetch lineups
4. Calculer features
5. Generer predictions

### Soir (20h00)
```typescript
npm run pipeline:pre-game
```
1. Fetch odds cloture
2. Detecter line movement
3. Calculer bet sizes (Kelly)

### Soir (22h00)
```typescript
npm run pipeline:post-game
```
1. Fetch resultats
2. Mettre a jour ELO
3. Calculer ROI
4. Valider predictions

## Schema de Donnees

### Tables DuckDB

```sql
-- Odds temps reel
CREATE TABLE odds_realtime (
  game_id VARCHAR,
  bookmaker VARCHAR,
  market VARCHAR,
  open_line FLOAT,
  close_line FLOAT,
  line_movement FLOAT,
  fetched_at TIMESTAMP
);

-- Blessures temps reel
CREATE TABLE injuries_realtime (
  game_id VARCHAR,
  player_id VARCHAR,
  player_name VARCHAR,
  team VARCHAR,
  status VARCHAR,
  impact_score FLOAT,
  report_date TIMESTAMP
);

-- Features ML temps reel
CREATE TABLE ml_features_live (
  game_id VARCHAR PRIMARY KEY,
  spread_movement FLOAT,
  home_stars_out INTEGER,
  away_stars_out INTEGER,
  injury_impact_diff FLOAT,
  calculated_at TIMESTAMP
);
```

## Utilisation

### Exemple: Fetch manuel des odds

```typescript
import { RedisCache, OddsRealtimeProvider } from './src/data-fetch';

const cache = new RedisCache();
await cache.connect();

const odds = new OddsRealtimeProvider(cache);
const openingOdds = await odds.fetchOpeningOdds();
const closingOdds = await odds.fetchClosingOdds();

// Detecter mouvement
const sharpMovement = await odds.detectSharpMovement(gameId);
```

### Exemple: Features temps reel

```typescript
import { LiveFeatureEngineering } from './src/data-fetch';

const features = new LiveFeatureEngineering(cache);
await features.init();

const gameFeatures = await features.calculateLiveFeatures(
  gameId,
  homeTeam,
  awayTeam,
  gameDate
);

console.log(gameFeatures.sharpIndicator);
console.log(gameFeatures.injuryImpactDiff);
```

## Prochaines Etapes

1. **Configurer Redis** - Demarrer Redis localement ou utiliser Redis Cloud
2. **Executer imports** - Lancer les scripts d'import historique
3. **Tester pipelines** - Executer les pipelines manuellement
4. **Configurer cron** - Automatiser avec cron/Task Scheduler
5. **Entrainer modele** - Utiliser les nouvelles features pour entrainer

## Notes Techniques

- **Redis**: Deja installe via `package.json` (redis@^4.7.0)
- **DuckDB**: Deja configure dans `src/data-fetch/storage/duckdb-storage.ts`
- **Cheerio**: Deja installe pour le scraping
- **Axios**: Deja installe pour les appels API

## Limites Connues

1. **Blessures historiques**: Difficile a obtenir gratuitement (2010-2021)
   - Solution: Interpoler depuis donnees disponibles
   - Alternative: NBA.com API payante

2. **Kaggle**: Necessite credentials
   - Solution: Telechargement manuel si besoin

3. **Rate limiting**: The Odds API limite les appels
   - Deja gere avec delais entre requetes
