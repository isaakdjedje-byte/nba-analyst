# Stratégie de Tests par Epic - nba-analyst

**Version**: 1.0  
**Date**: 2026-02-13  
**Auteur**: Isaak  
**Workflow**: Correct Course Implementation

---

## Vue d'ensemble

Cette stratégie de tests organise les tests Playwright par **Epic** pour permettre :
- L'exécution sélective des tests selon l'Epic en cours
- La préservation des tests futurs sans bloquer le pipeline CI/CD
- Une transition progressive des tests au fil des sprints

---

## Principe de Fonctionnement

### Fichier `.current-epic`

Ce fichier à la racine du projet définit l'Epic actuellement en cours :

```bash
# Contenu du fichier
1
```

**Valeurs possibles**:
- `1` - Epic 1: Accès sécurisé et gouvernance utilisateur
- `2` - Epic 2: Production décisionnelle fiable
- `3` - Epic 3: Expérience Picks/No-Bet
- `4` - Epic 4: Performance, logs et replay d'audit
- `5` - Epic 5: Gouvernance policy opérable
- `6` - Epic 6: Readiness B2B
- `all` - Tous les tests (développement local uniquement)

### Configuration Playwright

Le fichier `playwright.config.ts` :
1. Lit `.current-epic` au démarrage
2. Filtre les projets de tests selon l'Epic
3. N'exécute que les tests pertinents pour l'Epic actif

### Tags par Epic

Chaque test doit être tagué avec `@epic{N}` :

```typescript
// Epic 1 tests
test.describe('Auth Tests @epic1', () => {
  test('should authenticate user', async ({ page }) => {
    // test implementation
  });
});

// Epic 2 tests
test.describe('Decision API Tests @epic2', () => {
  test('should create decision', async ({ request }) => {
    // test implementation
  });
});
```

---

## Organisation des Tests

### Epic 1: Accès sécurisé et gouvernance utilisateur

**Scope**: Authentification, RBAC, MFA, RGPD  
**Tags**: `@epic1`, `@auth`, `@security`, `@smoke`  
**Fichiers**:
- `tests/auth/*.spec.ts`
- `tests/e2e/auth.spec.ts`
- `tests/api/rgpd-*.spec.ts`

**Critères de succès**:
- [ ] Tous les tests @epic1 passent
- [ ] Build réussi
- [ ] Lint sans erreur

### Epic 2: Production décisionnelle fiable

**Scope**: Data pipeline, Policy Engine, Hard-stops, Fallback  
**Tags**: `@epic2`, `@data`, `@decisions`, `@policy`, `@hardstop`  
**Fichiers**:
- `tests/api/v1/decisions*.spec.ts`
- `tests/api/policy*.spec.ts`
- `tests/e2e/decision*.spec.ts`
- `tests/e2e/daily-run.spec.ts` - Story 2.10: Pipeline E2E tests
- `tests/e2e/hardstop-api.spec.ts` - Story 2.11: Hard-Stop API E2E tests
- `tests/e2e/helpers/hardstop-helpers.ts` - Helper functions for hard-stop state

**Stories complétées**:
- ✅ Story 2.10: Tests E2E du pipeline daily run
- ✅ Story 2.11: Tests E2E de l'API Hard-Stop

**Note**: Epic 2 est maintenant complété avec couverture de tests complète.

### Epic 3: Expérience Picks/No-Bet

**Scope**: Dashboard, composants UI, responsive mobile  
**Tags**: `@epic3`, `@ux`, `@dashboard`, `@mobile`  
**Fichiers**:
- `tests/e2e/dashboard*.spec.ts`
- `tests/e2e/picks*.spec.ts`
- `tests/visual/*.spec.ts`

### Epic 4: Performance, logs et replay d'audit

**Scope**: Admin API, MFA avancé, Audit logs, Replay  
**Tags**: `@epic4`, `@admin`, `@mfa`, `@audit`  
**Fichiers**:
- `tests/api/admin-api.spec.ts` ⏸️ SKIPPED
- `tests/api/mfa-api.spec.ts` ⏸️ SKIPPED

**Note**: Ces tests sont marqués `.skip()` jusqu'à ce que Epic 4 soit actif.

### Epic 5: Gouvernance policy opérable

**Scope**: Policy management, Paramètres gouvernés  
**Tags**: `@epic5`, `@policy`, `@governance`  
**Fichiers**: À créer quand Epic 5 commence

### Epic 6: Readiness B2B

**Scope**: API v1, Intégrations B2B  
**Tags**: `@epic6`, `@b2b`, `@api`, `@v1`  
**Fichiers**: À créer quand Epic 6 commence

---

## Utilisation en Développement Local

### Exécuter tous les tests
```bash
# Par défaut, tous les tests sont exécutés localement
npx playwright test

# Gate de hardening API/CI
npm run verify:hardening

# Sous-suites utiles
npm run test:security
npm run test:b2b-docs
npm run test:ml-core
```

### Exécuter tests d'un Epic spécifique
```bash
# Modifier .current-epic
echo "3" > .current-epic

# Lancer les tests
npx playwright test
```

### Exécuter tests avec grep
```bash
# Epic 1 uniquement
npx playwright test --grep @epic1

# Tests smoke
npx playwright test --grep @smoke
```

---

## Pipeline CI/CD

### Lecture automatique de `.current-epic`

Le workflow GitHub Actions lit `.current-epic` et :
1. Filtre les tests selon l'Epic
2. Exécute uniquement les tests pertinents
3. Génère un rapport avec le scope Epic

### Exemple de sortie

```
Running tests for Epic: 1
Shard 1/4: epic-1-auth
Shard 2/4: epic-1-auth
Shard 3/4: epic-1-auth-mobile
Shard 4/4: epic-1-auth-mobile
```

---

## Transition entre Epics

### Quand un Epic est complété

1. **Marquer l'Epic comme done** dans `sprint-status.yaml`
2. **Mettre à jour `.current-epic`** avec le nouvel Epic
3. **Réactiver les tests** du nouvel Epic (retirer `.skip()`)
4. **Valider le pipeline** passe avec les nouveaux tests

### Exemple de transition

```bash
# Epic 1 terminé, passage à Epic 2
echo "2" > .current-epic

# Réactiver les tests Epic 2
# Modifier: tests/api/v1/decisions-crud.spec.ts
# test.describe.skip('Decisions API @epic2', () => {  // OLD
# test.describe('Decisions API @epic2', () => {       // NEW
```

---

## Tests Skipped

### Règle des tests futurs

Les tests des Epics futurs sont marqués avec `.skip()` pour :
- Préserver les tests déjà écrits
- Documenter les cas de test attendus
- Éviter les échecs de CI/CD

### Liste des tests skipped

| Fichier | Epic | Raison | Date prévue |
|---------|------|--------|-------------|
| `tests/api/v1/decisions-crud.spec.ts` | Epic 2 | Endpoints non implémentés | Sprint prochain |
| `tests/api/admin-api.spec.ts` | Epic 4 | Admin API dans le futur | Epic 4 |
| `tests/api/mfa-api.spec.ts` | Epic 4 | MFA avancé dans le futur | Epic 4 |

---

## Bonnes Pratiques

### 1. Taguer tous les nouveaux tests

```typescript
// ✅ Correct
test('should login @epic1 @smoke', async () => { ... });

// ❌ Incorrect
test('should login', async () => { ... });  // Pas de tag
```

### 2. Utiliser test.describe.skip pour les tests futurs

```typescript
// ✅ Correct - tests préservés mais skipped
test.describe.skip('Future Feature @epic5', () => {
  test('test case', async () => { ... });
});

// ❌ Incorrect - tests supprimés
// (ne rien avoir ici)
```

### 3. Documenter dans les commentaires

```typescript
/**
 * SKIPPED: Epic 4 not yet implemented
 * Tests for Admin user management
 * Re-enable when Epic 4 is active
 */
test.describe.skip('Admin API @epic4', () => { ... });
```

---

## Dépannage

### Le pipeline CI/CD échoue avec "No tests found"

**Cause**: `.current-epic` n'existe pas ou est vide  
**Solution**:
```bash
echo "1" > .current-epic
git add .current-epic
git commit -m "Set current epic to 1"
```

### Les tests Epic 2+ s'exécutent malgré tout

**Cause**: Les tests ne sont pas correctement marqués avec `.skip()`  
**Solution**: Vérifier que `test.describe.skip()` est utilisé

### Conflit de versions de tests

**Cause**: Des tests sont ajoutés sans tags  
**Solution**: Ajouter les tags @epic{N} appropriés

---

## Résumé des Commandes

```bash
# Définir l'Epic actuel
echo "1" > .current-epic

# Exécuter les tests
npx playwright test

# Exécuter avec un Epic spécifique
CURRENT_EPIC=1 npx playwright test

# Mode debug
npx playwright test --debug

# Rapport HTML
npx playwright show-report
```

---

## Références

- [Sprint Change Proposal](../_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-13.md)
- [Epics Document](../_bmad-output/planning-artifacts/epics.md)
- [Playwright Documentation](https://playwright.dev/docs/intro)

---

*Document généré par le workflow Correct Course - BMAD Method*
