# Quickstart - ML System Setup

Ce guide explique comment installer et utiliser le système ML de NBA Analyst.

## Prérequis

```bash
# Vérifier Node.js (v20+ requis)
node --version  # Doit afficher v20.x.x

# Installer les dépendances si ce n'est pas déjà fait
npm install
```

## Installation Rapide (Méthode Recommandée)

### Option 1: Utiliser le CLI (Plus Simple)

```bash
# 1. Vérifier le statut actuel
node scripts/ml-cli.js status

# 2. Installer le système ML complet
node scripts/ml-cli.js install

# 3. Vérifier que tout est OK
node scripts/ml-cli.js status
```

### Option 2: Utiliser npm run (Encore Plus Simple)

```bash
# Après avoir modifié le package.json avec les nouveaux scripts:

# Vérifier le statut
npm run ml:status

# Installation complète
npm run ml:install

# Voir toutes les commandes disponibles
npm run ml -- --help
```

## Commandes Disponibles

```bash
# Afficher l'aide
node scripts/ml-cli.js --help

# Installation complète
node scripts/ml-cli.js install

# Entraîner un modèle
node scripts/ml-cli.js train --activate
node scripts/ml-cli.js train --start-date 2023-10-01 --end-date 2024-01-01 --activate

# Récupérer des données historiques
node scripts/ml-cli.js fetch-data --start-date 2023-10-01

# Vérifier le statut
node scripts/ml-cli.js status

# Activer un modèle spécifique
node scripts/ml-cli.js activate <model-id>

# Démarrer le dashboard
node scripts/ml-cli.js dashboard
```

## Résolution des Problèmes

### Erreur "Cannot use import statement outside a module"

**Solution**: Utilisez `node scripts/ml-cli.js` au lieu de `ts-node`.

```bash
# ❌ Ne fonctionne pas
ts-node scripts/install-ml-system.ts

# ✅ Fonctionne
node scripts/ml-cli.js install
```

### Erreur "Prisma client not found"

```bash
# Générer le client Prisma
npx prisma generate

# Ou via le CLI
node scripts/ml-cli.js status  # Vérifiera automatiquement
```

### Erreur "Database tables not found"

```bash
# Exécuter les migrations
npx prisma migrate dev --name add_ml_system

# Vérifier
npx prisma studio
```

### tsconfig-paths manquant

```bash
npm install --save-dev tsconfig-paths
```

## Workflow Complet

```bash
# Étape 1: Vérifier
node scripts/ml-cli.js status

# Étape 2: Installer (si pas déjà fait)
node scripts/ml-cli.js install

# Étape 3: Démarrer le serveur
npm run dev

# Étape 4: Ouvrir le dashboard
# http://localhost:3000/admin/ml
```

## Structure du Système ML

```
nba-analyst/
├── scripts/
│   ├── ml-cli.js              # ⭐ CLI principal (utilisez celui-ci!)
│   ├── install-ml-system.ts    # Installation automatique
│   ├── train-ml-model.ts       # Entraînement
│   ├── fetch-historical-data.ts # Fetch données
│   └── activate-model.ts       # Activation modèle
├── src/server/ml/              # Code ML
│   ├── models/
│   │   ├── logistic-regression.ts
│   │   └── xgboost-model.ts
│   ├── features/
│   ├── training/
│   ├── prediction/
│   ├── monitoring/
│   └── data/
├── src/app/admin/ml/page.tsx   # Dashboard web
├── prisma/schema.prisma        # Tables ML
└── docs/
    ├── ML_ARCHITECTURE.md
    └── ML_SETUP_GUIDE.md
```

## Utilisation via npm scripts

Ajoutez ces scripts à votre `package.json`:

```json
{
  "scripts": {
    "ml": "node scripts/ml-cli.js",
    "ml:install": "npm run ml install",
    "ml:train": "npm run ml train -- --activate",
    "ml:fetch-data": "npm run ml fetch-data",
    "ml:status": "npm run ml status",
    "ml:dashboard": "npm run ml dashboard"
  }
}
```

Puis utilisez:

```bash
npm run ml:install
npm run ml:status
npm run ml:dashboard
```

## Dépannage

### Vérifier l'installation

```bash
node scripts/ml-cli.js status
```

### Réinstallation complète

```bash
# 1. Nettoyer
npx prisma migrate reset

# 2. Réinstaller
node scripts/ml-cli.js install
```

### Vérifier les logs

```bash
# Lister les modèles
npx prisma studio
# → Onglet ml_models

# Voir les prédictions
# → Onglet prediction_logs

# Voir les données
# → Onglet games, box_scores
```

## Support

- Documentation: `docs/ML_ARCHITECTURE.md`
- Guide complet: `docs/ML_SETUP_GUIDE.md`
- API: `GET /api/admin/ml/dashboard`
