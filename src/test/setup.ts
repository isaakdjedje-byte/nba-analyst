import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend vitest expect with jest-dom matchers
expect.extend(matchers);

// Set up environment variables for tests
process.env.MFA_ENCRYPTION_KEY = "test-key-32-chars-long-for-mfa!!";
process.env.MFA_ISSUER_NAME = "Test-App";
process.env.MFA_ENFORCE_FOR_ROLES = "admin,ops";
process.env.MFA_GRACE_PERIOD_MINUTES = "15";
process.env.MFA_REMOVAL_COOLDOWN_HOURS = "24";
process.env.NEXTAUTH_SECRET = "test-secret-for-nextauth-testing-32-chars";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.DATABASE_URL = "file:./prisma/test.db";

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
