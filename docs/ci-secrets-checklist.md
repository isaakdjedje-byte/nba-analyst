# CI Secrets Checklist

## Secrets Requis

Vérifiez si votre application nécessite les secrets suivants :

### URLs et Environnement
- [ ] `BASE_URL` - URL de l'application (défaut: http://localhost:3000)
- [ ] `API_URL` - URL de l'API (déaut: http://localhost:3000/api)

### Authentification
- [ ] `TEST_USER_EMAIL` - Email utilisateur test
- [ ] `TEST_USER_PASSWORD` - Mot de passe utilisateur test
- [ ] `TEST_AUTH_TOKEN` - Token JWT pour les tests API

### Services Externes
- [ ] `REDIS_URL` - Connexion Redis (si utilisé)
- [ ] `DATABASE_URL` - Connexion base de données (si tests utilisent DB)

### API Keys (si applicable)
- [ ] `API_KEY_*` - Clés pour services externes

## Configuration GitHub

Ajouter les secrets dans :
```
Settings → Secrets and variables → Actions → New repository secret
```

## Configuration dans le Workflow

Variables actuellement utilisées (via `playwright.config.ts`) :
```yaml
env:
  BASE_URL: ${{ secrets.BASE_URL || 'http://localhost:3000' }}
  API_URL: ${{ secrets.API_URL || 'http://localhost:3000/api' }}
```

## Validation

Après ajout des secrets :
1. Redémarrer un workflow
2. Vérifier que les variables sont injectées
3. Consulter les logs pour confirmation

## Notes

- Aucun secret n'est requis pour les tests de base
- Les valeurs par défaut fonctionnent avec le serveur de dev local
