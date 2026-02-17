# Test Automation Coverage Plan

**Workflow:** testarch-automate  
**Date:** 2026-02-16  
**Mode d'Exécution:** Standalone (analyse du code source existant)  
**Coverage Target:** critical-paths

---

## 📊 Vue d'Ensemble de la Couverture

| Métrique | Valeur |
|----------|--------|
| **Tests Totaux** | ~150+ |
| Tests API | ~50+ |
| Tests E2E | ~60+ |
| Tests Unit | ~30+ |
| Tests Integration | ~10+ |
| Tests Component | ~5+ |

---

## 🎯 Cibles Identifiées et Couverture

### 1. Authentication & Security (P0 - Critique)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Inscription/Connexion | API | ✅ Covered | auth-api-coverage.spec.ts |
| Inscription/Connexion | E2E | ✅ Covered | authentication-journey.spec.ts |
| MFA | API | ✅ Covered | mfa-api-coverage.spec.ts |
| MFA | E2E | ✅ Covered | mfa-e2e.spec.ts |
| Rate Limiting | Unit/API | ✅ Covered | rate-limit.spec.ts, cache-rate-limit.spec.ts |
| RBAC | Unit | ✅ Covered | rbac.spec.ts |
| B2B API Key | API/Unit | ✅ Covered | b2b-api-key-auth.spec.ts |

### 2. Policy & Governance (P0 - Critique)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Policy Config | API | ✅ Covered | automate-policy-config-api.spec.ts |
| Policy Evaluation | API | ✅ Covered | automate-policy-evaluate-api.spec.ts |
| Hardstop | API | ✅ Covered | automate-policy-hardstop-api.spec.ts, hardstop.spec.ts |
| Hardstop | E2E | ✅ Covered | hardstop-status-2-6.spec.ts |
| Policy Service | Unit | ✅ Covered | policy-service.spec.ts |
| Guardrails | E2E | ✅ Covered | guardrail-banner-3-7.spec.ts |

### 3. Data & Ingestion (P1 - Élevé)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Ingestion API | API | ✅ Covered | ingestion-api.spec.ts, ingestion-api-coverage.spec.ts |
| Provider Integration | Integration | ✅ Covered | provider-integration.spec.ts |
| Runs API | API | ✅ Covered | runs-api.spec.ts, runs-api-coverage.spec.ts |
| Scheduler | API/Unit | ✅ Covered | scheduler-api.spec.ts, scheduler.test.ts |

### 4. Decisions & Picks (P1 - Élevé)

| Cible | Niveau | Status | Fichiers |
|-------|--------|-----------|
| Decisions CRUD | API | ✅ Covered | automate-decisions-api.spec.ts |
| Decisions Validation | API | ✅ Covered | decisions-validation.spec.ts |
| Dashboard Picks | E2E | ✅ Covered | dashboard-picks-journey.spec.ts |
| Decision Detail | E2E | ✅ Covered | decision-card-3-3.spec.ts |

### 5. Admin & RBAC (P1 - Élevé)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Admin Management | API | ✅ Covered | admin-management-api.spec.ts |
| Admin Users | E2E | ✅ Covered | admin-users.spec.ts |
| RBAC Flows | E2E | ✅ Covered | admin-rbac-journey.spec.ts, admin-rbac-flows.spec.ts |
| Role Changes | API | ✅ Covered | role-change.spec.ts |

### 6. RGPD & Privacy (P0 - Critique)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Data Export | API | ✅ Covered | rgpd-export-api.spec.ts |
| Account Deletion | API/E2E | ✅ Covered | rgpd-deletion-api.spec.ts, rgpd-account-deletion-e2e.spec.ts |
| Privacy Journey | E2E | ✅ Covered | rgpd-privacy-journey.spec.ts |

### 7. Performance & Monitoring (P2 - Moyen)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Performance Metrics | Service/View | ✅ Covered | metrics-service.test.ts, performance-view.spec.ts |
| ML Orchestration | E2E | ✅ Covered | ml-orchestration-dashboard.spec.ts |
| Logs View | E2E | ✅ Covered | logs-view.spec.ts |
| Investigation | E2E | ✅ Covered | investigation.spec.ts, investigation-search.spec.ts |

### 8. Mobile & Responsive (P2 - Moyen)

| Cible | Niveau | Status | Fichiers |
|-------|--------|--------|-----------|
| Mobile Layout | E2E | ✅ Covered | mobile-responsive-layout-3-8.spec.ts |
| Mobile Viewport | E2E | ✅ Covered | mobile-viewport-3-8.spec.ts |
| Mobile Navigation | E2E | ✅ Covered | mobile-navigation-3-8.spec.ts |

---

## 🔴 Zones Non Couvertes (Gaps Identifiés)

### Priorité Haute

| Zone | Reason | Recommandation |
|------|--------|----------------|
| ML Fallback Chain | Tests existants basiques | Ajouter des tests de fallback complexes |
| Source Health Checks | Couverture incomplète | Ajouter tests pour seuils de santé |
| Drift Detection | Tests existants limités | Étendre les tests de détection |

### Priorité Moyenne

| Zone | Reason | Recommandation |
|------|--------|----------------|
| Cache Invalidation | Tests basiques | Tester les patterns d'invalidation |
| Audit Trail | Tests limités | Étendre la couverture |

### Priorité Basse

| Zone | Reason | Recommandation |
|------|--------|----------------|
| Visual Regression | Couverture initiale | Étendre aux composants clés |
| Accessibility | Tests limités | Ajouter plus de scénarios A11y |

---

## 📋 Tests Skippés (En Attente d'Implémentation)

| Fichier | Epic | Reason | Priorité |
|---------|------|--------|----------|
| decisions-crud.spec.ts | Epic 2 | Non implémenté | P0 |
| mfa-api.spec.ts | Epic 4 | Non implémenté | P0 |
| admin-api.spec.ts | Epic 4 | Non implémenté | P0 |

---

## 🎯 Plan d'Amélioration

### Court Terme (Cette Itération)

1. **Activer les tests skippés** - Une fois les Epics implémentés
2. **Étendre les tests ML** - Ajouter des scénarios de fallback complexes
3. **Améliorer la couverture Cache** - Tester l'invalidation

### Moyen Terme (Prochaines Itérations)

1. **Tests de Performance** - Charger les tests de performance
2. **Tests d'Accessibilité** - Couverture A11y étendue
3. **Visual Regression** - Snapshots pour composants clés

---

## ✅ Checklist de Validation

- [x] Framework Playwright configuré
- [x] Structure de répertoire tests/ existante
- [x] Niveaux de test appropriés sélectionnés
- [x] Priorités assignées (P0-P3)
- [x] Pas de duplication de couverture
- [x] Format Given-When-Then utilisé
- [x] Tags de priorité dans les noms de tests
- [x] Sélecteurs résilients
- [x] Pattern network-first appliqué
- [x] Pas d'attentes fixes
- [x] Données générées avec faker
- [x] Factories avec support des overrides

---

*Généré par BMAD-CORE™ - Testarch Automate Workflow v5.0*
