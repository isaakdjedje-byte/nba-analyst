# Quick Start Guide

Guide de démarrage rapide pour NBA Analyst

---

## 🚀 Démarrer l'application

```bash
# Démarrer le serveur de développement
npm run dev

# L'application sera disponible sur http://localhost:3000
```

## 🧪 Lancer les tests

```bash
# Tous les tests
npm run test:e2e

# Un projet spécifique (Chromium uniquement)
npx playwright test --project=chromium

# Mode UI interactif
npm run test:e2e:ui

# Mode headed (navigateur visible)
npm run test:e2e:headed

# Déboguer
npm run test:e2e:debug

# Voir le rapport
npm run test:report
```

## 🔐 Authentification

### API Endpoints disponibles

**Login:**
```bash
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "testpassword123"
}
```

**Utilisateurs de test:**
- User: `test@example.com` / `testpassword123`
- Admin: `admin@example.com` / `admin123`

**Protected:**
```bash
GET /api/auth/me
Authorization: Bearer <token>
```

## 🏭 Utiliser les Factories

### Créer des données de test

```typescript
import {
  createUser,
  createDecision,
  createMatch,
  createRun,
} from '../support/factories';

// Utilisateur basique
const user = createUser();

// Utilisateur avec overrides
const admin = createUser({
  email: 'admin@test.com',
  role: 'admin'
});

// Décision
const decision = createDecision({
  status: 'Pick',
  confidence: 0.85
});

// Match NBA
const match = createMatch({
  homeTeam: 'Lakers',
  awayTeam: 'Warriors'
});

// Run
const run = createRun({ status: 'completed' });
```

### Exemple complet de test

```typescript
test('scenario complet', async ({ api }) => {
  // Créer les données
  const user = createUser();
  const match = createMatch();
  const decision = createDecision({ matchId: match.id });

  // Seeder via API
  await api.post('/api/users', user);
  await api.post('/api/v1/decisions', decision);

  // Tester l'UI
  await page.goto('/dashboard/picks');
  await expect(page.getByTestId('pick-card')).toBeVisible();
});
```

## 📁 Structure des fichiers de test

```
tests/
├── e2e/
│   ├── auth.spec.ts              # Tests d'authentification
│   ├── dashboard-picks.spec.ts   # Dashboard picks
│   ├── factories-demo.spec.ts    # Démonstration factories
│   ├── logs-replay.spec.ts       # Logs et replay
│   └── no-bet-hard-stop.spec.ts  # Policy enforcement
├── support/
│   ├── fixtures/
│   │   └── index.ts              # Factories de données
│   └── merged-fixtures.ts        # Fixtures Playwright
└── README.md                     # Documentation complète
```

## 🎯 Pages de l'application

- **Home**: http://localhost:3000/
- **Picks**: http://localhost:3000/dashboard/picks
- **No-Bet**: http://localhost:3000/dashboard/no-bet
- **Logs**: http://localhost:3000/dashboard/logs

## 🛠️ Commandes utiles

```bash
# Vérifier les types TypeScript
npm run typecheck

# Linter
npm run lint

# Construire pour la production
npm run build

# Démarrer en production
npm run start
```

## 📝 Environnement

Variables dans `.env`:
```
TEST_ENV=local
BASE_URL=http://localhost:3000
API_URL=http://localhost:3000/api
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

## 🎓 Ressources

- [Documentation Playwright](https://playwright.dev)
- [Documentation Next.js](https://nextjs.org/docs)
- [Tests Factories](tests/support/fixtures/index.ts)

---

**Généré par BMAD Framework v6.0**
