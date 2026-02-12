# CI/CD Pipeline Documentation

## Overview

Pipeline CI/CD pour les tests E2E avec Playwright, configurée avec parallélisation, burn-in et collecte d'artefacts.

## Configuration

- **Plateforme** : GitHub Actions
- **Fichier** : `.github/workflows/test.yml`
- **Node.js** : 20 (via `.nvmrc`)

## Stages

### 1. Lint
- Vérification de la qualité du code
- Utilise `npm run lint`
- Timeout : 5 minutes

### 2. Test (4 Shards)
- Exécution parallèle des tests E2E
- 4 shards pour optimiser le temps d'exécution
- `fail-fast: false` pour préserver les preuves
- Artefacts uploadés en cas d'échec

### 3. Burn-In
- Détection des tests instables (flaky)
- 10 itérations sur les tests modifiés
- Exécuté sur PR et planification hebdomadaire

### 4. Report
- Agrégation des résultats
- Résumé dans l'interface GitHub

## Caching

- `node_modules` (via `actions/setup-node`)
- Navigateurs Playwright (`~/.cache/ms-playwright`)

## Artefacts

| Type | Emplacement | Retention |
|------|-------------|-----------|
| Résultats tests | `test-results/` | 30 jours |
| Rapport HTML | `playwright-report/` | 30 jours |
| Échecs burn-in | `burn-in-failures/` | 30 jours |

## Scripts Utilitaires

```bash
# Tests locaux (mirroring CI)
./scripts/ci-local.sh

# Tests modifiés uniquement
./scripts/test-changed.sh [base-branch]

# Burn-in des tests modifiés
./scripts/burn-in-changed.sh [iterations] [base-branch]
```

## Triggers

- `push` sur `main` et `develop`
- `pull_request` sur `main` et `develop`
- `schedule` : dimanche 2h UTC (burn-in hebdomadaire)

## Prochaines Étapes

1. Configurer les secrets (si nécessaire)
2. Pousser sur la branche principale
3. Créer une PR pour déclencher le premier run
4. Surveiller l'exécution dans l'onglet Actions
