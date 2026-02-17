# Skipped Tests Tracking

This file tracks all skipped tests in the project and their re-enablement criteria.

## Overview

| File | Epic | Reason | Priority | Re-enable Criteria |
|------|------|--------|----------|-------------------|
| `tests/api/v1/decisions-crud.spec.ts` | Epic 2 | Not implemented | P0 | Verify API endpoints exist |
| `tests/api/mfa-api.spec.ts` | Epic 4 | Not implemented | P0 | Verify MFA endpoints exist |
| `tests/api/admin-api.spec.ts` | Epic 4 | Not implemented | P0 | Verify admin endpoints exist |

## Epic 2 - Production Décisionnelle Fiable

### decisions-crud.spec.ts

**Status**: SKIPPED
**Reason**: Epic 2 not yet implemented
**Coverage**:
- Decision creation (POST /api/v1/decisions)
- Decision retrieval (GET /api/v1/decisions)
- Input validation (matchId, status enum, confidence range)
- Edge cases (Hard-Stop status, empty body)

**Re-enablement**:
1. Verify POST /api/v1/decisions endpoint exists
2. Verify GET /api/v1/decisions endpoint exists
3. Remove `test.describe.skip`
4. Run tests to verify implementation

**TODO Items**:
- [ ] Re-enable tests when Epic 2 starts
- [ ] Add tests for PUT /api/v1/decisions/:id
- [ ] Add tests for DELETE /api/v1/decisions/:id

---

## Epic 4 - Performance, Logs et Replay d'Audit

### mfa-api.spec.ts

**Status**: SKIPPED
**Reason**: Epic 4 not yet implemented
**Coverage**:
- MFA token verification (POST /api/auth/mfa)
- MFA setup/enable (POST /api/auth/mfa/setup)
- MFA disable (DELETE /api/auth/mfa)
- MFA backup codes (GET /api/auth/mfa/backup-codes)
- MFA validation errors

**Re-enablement**:
1. Verify MFA endpoints exist
2. Remove `test.describe.skip`
3. Run tests to verify implementation

**TODO Items**:
- [ ] Re-enable tests when Epic 4 starts
- [ ] Add tests for MFA QR code generation
- [ ] Add tests for MFA bypass (admin)

### admin-api.spec.ts

**Status**: SKIPPED
**Reason**: Epic 4 not yet implemented
**Coverage**:
- User listing (GET /api/v1/admin/users)
- User management (POST/DELETE /api/v1/admin/users)
- Role assignment (PUT /api/v1/admin/users/:id/role)
- RBAC enforcement (non-admin cannot access)

**Re-enablement**:
1. Verify admin API endpoints exist
2. Remove `test.describe.skip`
3. Run tests to verify implementation

**TODO Items**:
- [ ] Re-enable tests when Epic 4 starts
- [ ] Add tests for audit logging of admin actions

---

## Adding New Skipped Tests

When adding a new skipped test file, use this template:

```typescript
/**
 * Feature Name
 * Description
 * 
 * SKIPPED: [Reason]
 * 
 * @epic [epic-number]
 * @tracked false
 * @re-enable When [condition]
 * @priority [P0/P1/P2/P3]
 * 
 * Coverage:
 * - [Coverage item 1]
 * - [Coverage item 2]
 * 
 * TODO: [Ticket] Re-enable when [condition]
 */

test.describe.skip('Feature @tag', () => {
  // tests...
});
```

---

## Running Skipped Tests

To run skipped tests temporarily:

```bash
# Run all tests including skipped
npx playwright test --grep "@epic2" --grep-invert "@skip"

# Or modify test.describe.skip to test.describe.only temporarily
```

---

Last Updated: 2026-02-14
