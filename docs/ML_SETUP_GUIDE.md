# NBA Analyst - ML Setup Guide

Ce guide explique comment configurer et démarrer le système ML de zéro.

## Prérequis

- Node.js 20+
- PostgreSQL 14+
- Clés API (ESPN, NBA CDN - optionnel)

## Installation

### 1. Migrations Prisma

```bash
# Générer les tables
npx prisma migrate dev --name add_ml_models

# Générer le client Prisma
npx prisma generate
```

### 2. Variables d'environnement

Ajoutez dans `.env`:

```bash
# Database (déjà configuré normalement)
DATABASE_URL="postgresql://user:password@localhost:5432/nba_analyst"

# API Keys (optionnels mais recommandés)
NBA_API_URL="https://cdn.nba.com"
ESPN_API_URL="https://site.api.espn.com/apis/site/v2/sports"
```

## Workflow Complet

### Étape 1: Fetch des Données Historiques

Récupérez les matchs passés pour l'entraînement:

```bash
# Récupérer la saison 2023-2024 (recommandé: au moins 500 matchs)
npx ts-node scripts/fetch-historical-data.ts \
  --start-date 2023-10-01 \
  --end-date 2024-06-01
```

**Vérification:**
```bash
# Vérifier le nombre de matchs en base
npx prisma studio
# Consulter la table `games` et `box_scores`
```

### Étape 2: Entraînement du Modèle

#### Option A: Logistic Regression (Recommandé pour démarrer)

```bash
npx ts-node scripts/train-ml-model.ts \
  --start-date 2023-10-01 \
  --end-date 2024-06-01 \
  --activate
```

#### Option B: XGBoost (Meilleures performances)

Modifiez le training service pour utiliser XGBoost:

```typescript
// Dans training-service.ts, ligne ~140
import { XGBoostModel } from '@/server/ml/models/xgboost-model';

// Remplacez:
// const model = new LogisticRegressionModel(...)
// Par:
const model = new XGBoostModel({
  nEstimators: 100,
  maxDepth: 4,
  learningRate: 0.1,
});
```

Puis relancez l'entraînement.

### Étape 3: Activation du Modèle

Si vous n'avez pas utilisé `--activate`:

```bash
# Lister les modèles disponibles
npx ts-node scripts/activate-model.ts

# Activer un modèle spécifique
npx ts-node scripts/activate-model.ts model-1234567890
```

### Étape 4: Test des Prédictions

```bash
# Lancer une exécution quotidienne (test)
npx ts-node scripts/trigger-real-daily-run.ts

# Ou via l'API
POST /api/admin/ml/run-daily
```

### Étape 5: Monitoring

Accédez au dashboard de monitoring:

```
GET /api/admin/ml/dashboard
```

Ou consultez les métriques:

```bash
# Health check
npx ts-node scripts/ml-health-check.ts
```

## Vérification du Système

### Vérifier les composants

```bash
# 1. Données historiques
npx prisma studio
# Consulter: games, box_scores

# 2. Modèles entraînés
# Consulter: ml_models
# Vérifier: is_active = true pour un modèle

# 3. Features calculées
# Consulter: feature_store

# 4. Logs de prédiction
# Consulter: prediction_logs
```

### Test manuel d'une prédiction

```typescript
import { getPredictionService } from '@/server/ml';

const service = getPredictionService();

const prediction = await service.predict({
  gameId: 12345,
  homeTeamId: 1,
  awayTeamId: 2,
  homeTeamName: 'Lakers',
  awayTeamName: 'Warriors',
  scheduledAt: new Date('2024-02-20T20:00:00'),
});

console.log(prediction.prediction.winner);
console.log(prediction.prediction.confidence);
```

## Architecture des Données

### Tables créées

| Table | Description |
|-------|-------------|
| `ml_models` | Modèles entraînés avec métriques et poids |
| `feature_store` | Cache des features calculées |
| `games` | Matchs historiques NBA |
| `box_scores` | Statistiques détaillées par match |
| `prediction_logs` | Logs de toutes les prédictions |

### Flux de données

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ESPN API   │────▶│   Games     │────▶│  Features   │
│  NBA CDN    │     │  (Storage)  │     │  (Cache)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│Monitoring   │◀────│ Predictions │◀────│  ML Model   │
│ Dashboard   │     │  (Logs)     │     │  (Active)     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Troubleshooting

### "No active model found"

```bash
# Vérifier qu'un modèle est actif
npx prisma studio
# Aller dans ml_models, vérifier is_active = true

# Si non, activer:
npx ts-node scripts/activate-model.ts <model-id>
```

### "Insufficient training data"

```bash
# Vérifier le nombre de matchs
npx prisma studio
# games.count doit être > 100

# Si insuffisant, fetch plus de données:
npx ts-node scripts/fetch-historical-data.ts --start-date 2023-01-01
```

### "Feature validation failed"

- Les features nécessitent des box scores
- Vérifier que `box_scores.count` > 50
- Si non, refetch les données

### Prédictions aléatoires

- Vérifier le modèle actif: `modelVersion` dans `prediction_logs`
- Vérifier les métriques du modèle: `accuracy` doit être > 0.52
- Si accuracy trop faible: réentraîner avec plus de données

## Métriques Attendues

### Modèle Entraîné

| Métrique | Minimum | Objectif |
|----------|---------|----------|
| Accuracy | > 52% | 60%+ |
| Precision | > 50% | 58%+ |
| Recall | > 50% | 58%+ |
| Calibration Error | < 10% | < 5% |
| AUC-ROC | > 0.55 | > 0.65 |

### En Production

| Métrique | Alerte |
|----------|--------|
| Latence moyenne | > 1000ms |
| Taux d'erreur | > 5% |
| Drift features | > 2 features |
| Calibration | > 10% error |

## Commandes Utiles

```bash
# Entraînement rapide (test)
npx ts-node scripts/train-ml-model.ts --activate

# Entraînement complet
npx ts-node scripts/train-ml-model.ts \
  --start-date 2023-10-01 \
  --end-date 2024-06-01 \
  --activate

# Fetch données historiques
npx ts-node scripts/fetch-historical-data.ts \
  --start-date 2023-10-01 \
  --end-date 2024-06-01

# Activer un modèle
npx ts-node scripts/activate-model.ts <model-id>

# Vérifier le statut
npx prisma studio

# Générer Prisma
npx prisma generate

# Reset complet (⚠️ ATTENTION)
npx prisma migrate reset
```

## Prochaines Étapes

1. **Automatisation**: Configurer un cron job pour `fetch-historical-data.ts` quotidiennement
2. **Auto-training**: Réentraîner automatiquement quand `drift` détecté
3. **A/B Testing**: Comparer Logistic Regression vs XGBoost en production
4. **Feature Importance**: Analyser quelles features sont les plus importantes

## Support

En cas de problème:
1. Vérifier les logs: `prediction_logs.error`
2. Consulter le dashboard: `/api/admin/ml/dashboard`
3. Vérifier la santé: `MonitoringService.runHealthCheck()`
