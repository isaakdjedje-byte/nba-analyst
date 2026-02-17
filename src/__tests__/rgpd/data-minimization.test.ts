import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/client';

describe('RGPD Data Minimization (NFR9)', () => {
  beforeAll(async () => {
    // Clean up test data - skip if table doesn't exist yet
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: '@example.com',
          },
        },
      });
    } catch {
      // Table might not exist, continue with tests
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Model PII Compliance', () => {
    it('should only collect email as PII - no name field', async () => {
      // Try to create user with name - should fail or ignore name
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          // name field should not exist per NFR9
        },
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      // After RGPD migration, name field should not exist on user
      expect('name' in user).toBe(false);
    });

    it('should not have image field on user model', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });

      expect(user).toBeDefined();
      // After RGPD migration, image field should not exist on user
      expect('image' in (user || {})).toBe(false);
    });

    it('should enforce email uniqueness', async () => {
      // First user
      await prisma.user.create({
        data: {
          email: 'unique@example.com',
          password: 'password1',
        },
      });

      // Second user with same email should fail
      await expect(
        prisma.user.create({
          data: {
            email: 'unique@example.com',
            password: 'password2',
          },
        })
      ).rejects.toThrow();
    });

    it('should require email field', async () => {
      await expect(
        prisma.user.create({
          data: {
            email: '',
            password: 'password',
          } as unknown as never,
        })
      ).rejects.toThrow();
    });
  });

  describe('Registration Data Collection', () => {
    it('should only store email and password at registration', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'minimal@example.com',
          password: 'securehashedpassword',
          role: 'user',
        },
      });

      // Verify minimal data stored
      expect(user.email).toBe('minimal@example.com');
      expect(user.password).toBe('securehashedpassword');
      expect(user.role).toBe('user');
      
      // Verify no extra PII (NFR9 compliance)
      const allowedFields = [
        'id', 'email', 'emailVerified', 'password', 'role',
        'createdAt', 'updatedAt', 'accounts', 'sessions', 'auditLogs',
        'dataExports'
      ];
      
      // MFA fields are allowed for security
      const mfaFields = [
        'mfaSecret', 'mfaEnabled', 'mfaBackupCodes', 'mfaEnrolledAt',
        'mfaLastVerifiedAt', 'mfaDisableRequestedAt'
      ];
      
      // RGPD fields are allowed for compliance
      const rgpdFields = [
        'dataExportRequestedAt', 'dataExportCompletedAt', 'deletionRequestedAt',
        'deletedAt', 'deletionReason', 'privacyPolicyAcceptedAt', 'privacyPolicyVersion'
      ];
      
      const userFields = Object.keys(user);
      const allAllowedFields = [...allowedFields, ...mfaFields, ...rgpdFields];
      
      userFields.forEach(field => {
        expect(allAllowedFields).toContain(field);
      });
    });
  });
});
