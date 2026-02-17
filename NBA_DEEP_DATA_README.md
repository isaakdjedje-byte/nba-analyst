# NBA Deep Data Fetcher v2.0

Système complet de récupération de données NBA multi-sources (2015-2025) avec feature engineering avancé.

## 🎯 Objectifs

- **12 000+ matchs** : Données complètes de 2015 à 2025
- **Multi-sources** : Basketball-Reference + NBA API + ESPN
- **Features avancées** : ELO, rolling averages, rest, Four Factors
- **Stockage hybride** : PostgreSQL (app) + DuckDB (analytics)

## 📁 Structure

```
C:\Users\isaac\nba-analyst
├── src/data-fetch/
│   ├── config/
│   │   └── fetch.config.ts          # Configuration
│   ├── providers/
│   │   ├── basketball-reference.ts  # Scraping B-Ref
│   │   └── nba-api-wrapper.ts       # Wrapper Python nba_api
│   ├── mergers/
│   │   └── data-merger.ts           # Fusion multi-sources
│   ├── storage/
│   │   └── duckdb-storage.ts        # Stockage DuckDB
│   ├── features/
│   │   └── feature-engineering.ts   # Calcul features ML
│   ├── types/
│   │   └── game.types.ts            # Types TypeScript
│   └── orchestrator.ts              # Orchestrateur principal
├── scripts/nba-api/
│   └── nba_api_fetcher.py           # Script Python nba_api
├── nba-data/                        # Données (non versionnées)
│   ├── analytics.duckdb             # Base DuckDB (~400MB)
│   ├── raw/                         # Données brutes
│   └── processed/                   # Données traitées
└── logs/                            # Logs et checkpoints
```

## 🚀 Installation

### 1. Dépendances Node.js

```bash
npm install axios cheerio duckdb
```

### 2. Python + nba_api

```bash
pip install nba_api pandas requests
```

Vérifiez l'installation :
```bash
python --version  # Python 3.14+ ✓
pip list | grep nba-api  # nba-api ✓
```

## 📊 Commandes

### Fetch complet (10-12 heures)
```bash
# Toutes les saisons 2015-2025
npm run data:fetch-deep

# Saison spécifique
npm run data:fetch-deep -- 2024

# Reprendre après interruption
npm run data:fetch-resume

# Voir le statut
npm run data:fetch-status
```

### Feature Engineering
```bash
# Générer toutes les features (ELO, rolling, etc.)
npm run data:features
```

## 📈 Sources de Données

### 1. Basketball-Reference (Principal)
- ✅ Box scores complets
- ✅ Play-by-play (2015+)
- ✅ Four Factors (eFG%, TOV%, ORB%, FT Rate)
- ✅ Advanced stats (PER, TS%, BPM)
- ⚠️ Rate limit: 1 req/3s

### 2. NBA API (Tracking)
- ✅ Player tracking (vitesse, distance)
- ✅ Shot charts (coordonnées x,y)
- ✅ Hustle stats (deflections, loose balls)
- ✅ Matchups défensifs
- ⚠️ Rate limit: 10 req/min

### 3. ESPN (Backup)
- ✅ Temps réel
- ✅ Blessures/lineups
- ✅ Standings

## 🧮 Features Générées

### ELO Ratings (538-style)
```sql
- Initial: 1500 points
- K-factor: 20
- Home advantage: +100 points
- Update: R_new = R_old + K × (Actual - Expected)
```

### Rolling Averages
- Forme sur 5 derniers matchs
- Forme sur 10 derniers matchs
- Forme sur 20 derniers matchs
- Moyennes saison (cumulatives)

### Rest Features
- Jours de repos (rest_days)
- Back-to-back (b2b)
- 3 matchs en 4 jours (3in4)
- Différence de repos (home - away)

### Four Factors
- eFG% differential
- TOV% differential
- ORB% differential
- FT Rate differential

### Head-to-Head
- Historique confrontations directes
- Win % domicile vs extérieur
- Marge moyenne

## 💾 Schéma de Stockage

### Tables DuckDB

**raw_games**: Données brutes fusionnées
```sql
- game_id, date, season, teams, scores
- boxscore JSON (home/away)
- players JSON (stats individuelles)
- play_by_play JSON (événements)
- shot_charts JSON (coordonnées)
- sources JSON (origine des données)
- data_quality FLOAT
```

**team_stats**: Stats agrégées par équipe
```sql
- game_id, team, is_home
- Traditional stats (fg, tp, ft, reb, ast, etc.)
- Four Factors (efg_pct, tov_pct, orb_pct, ft_rate)
- Advanced (off_rating, def_rating, pace)
- Tracking (paint_pts, fast_break_pts)
```

**player_stats**: Stats individuelles
```sql
- game_id, player_id, player_name, team
- Traditional stats (minutes, pts, reb, ast, etc.)
- Advanced (ts_pct, efg_pct, usg_pct)
- Tracking (avg_speed, distance_miles, touches)
- Hustle (contested_shots, deflections)
```

**ml_training_data**: Dataset final ML
```sql
- 50+ features par match
- Target: home_win (0/1)
- Prêt pour entraînement XGBoost/Logistic Regression
```

## 📊 Estimations

| Métrique | Valeur |
|----------|--------|
| Matchs totaux | ~12 000 |
| Joueurs uniques | ~5 000 |
| Events PBP | ~6 000 000 |
| Tirs trackés | ~2 000 000 |
| Taille DuckDB | ~400 MB |
| Temps de fetch | ~10-12 heures |
| Features | 50+ |

## 🔧 Configuration

Modifier `src/data-fetch/config/fetch.config.ts` :

```typescript
{
  seasons: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  sources: {
    basketballReference: { enabled: true, rateLimitMs: 3000 },
    nbaAPI: { enabled: true, rateLimitMs: 6000 },
    espn: { enabled: true }
  },
  checkpoint: { enabled: true, interval: 10 }
}
```

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATEUR                            │
│              (Coordonne tout le pipeline)                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ BASKETBALL   │    │ NBA API      │    │ ESPN         │
│ REFERENCE    │    │ (Python)     │    │ (Backup)     │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MERGER & VALIDATION                      │
│         (Fusionne données, calcule qualité)                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│    DUCKDB (Analytics)    │    │    POSTGRESQL (App)      │
│  - ML training data      │    │  - Predictions           │
│  - Features              │    │  - Users                 │
│  - Raw data              │    │  - Application data      │
└──────────────────────────┘    └──────────────────────────┘
```

## ⚠️ Points d'Attention

1. **Rate Limiting**: B-Ref (3s), NBA API (6s) - respectez les délais
2. **Reprise**: Les checkpoints sauvegardent toutes les 10 games
3. **Espace disque**: Prévoyez ~1GB pour tout le dataset
4. **Python**: Doit être accessible via `python` dans le PATH
5. **VPN/Proxy**: Peut être nécessaire pour B-Ref (anti-bot)

## 🔍 Dépannage

### Erreur "Cannot find module 'axios'"
```bash
npm install axios cheerio duckdb --legacy-peer-deps
```

### Erreur Python "ModuleNotFoundError: No module named 'nba_api'"
```bash
pip install nba_api pandas requests
```

### Fetch interrompu
```bash
# Reprendre automatiquement
npm run data:fetch-resume
```

### Données incomplètes
Vérifiez les logs dans `logs/bref-errors.log` et `logs/fetch-progress.json`

## 📈 Performance

Optimisations incluses :
- ✅ Rate limiting intelligent
- ✅ Retry avec exponential backoff
- ✅ Checkpoints toutes les 10 games
- ✅ Stockage DuckDB (100x plus rapide que SQLite)
- ✅ Batch inserts (100 games à la fois)
- ✅ Fusion lazy (NBA API optionnel)

## 🚀 Prochaines Étapes

Après le fetch :

1. **Entraîner les modèles** :
```bash
npm run ml:train-advanced
```

2. **Valider la qualité** :
```sql
-- Dans DuckDB
SELECT 
  season, 
  COUNT(*) as games,
  AVG(data_quality) as avg_quality
FROM raw_games 
GROUP BY season 
ORDER BY season;
```

3. **Exporter pour analyse** :
```sql
-- Export CSV
COPY ml_training_data TO 'training_data.csv' (HEADER, DELIMITER ',');
```

## 📚 Ressources

- [Basketball-Reference](https://www.basketball-reference.com)
- [NBA API Documentation](https://github.com/swar/nba_api)
- [FiveThirtyEight ELO](https://fivethirtyeight.com/features/how-we-calculate-nba-elo-ratings/)
- [DuckDB Documentation](https://duckdb.org/docs/)

---

**Version**: 2.0  
**Dernière mise à jour**: 2026-02-16  
**Auteur**: NBA Analyst Team
