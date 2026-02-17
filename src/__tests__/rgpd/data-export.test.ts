import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db/client';
import { generateUserDataExport } from '@/server/rgpd/data-export';
import { createHash } from 'crypto';

describe('RGPD Data Export (Portability)', () => {
  let testUserId: string;
  let testEmail: string;

  beforeAll(async () => {
    testEmail = `export-test-${Date.now()}@example.com`;
    
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashedpassword',
        role: 'user',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.dataExport.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  describe('Data Export Generation', () => {
    it('should generate a valid data export for user', async () => {
      const result = await generateUserDataExport(testUserId);

      expect(result).toBeDefined();
      expect(result.filePath).toBeDefined();
      expect(result.dataHash).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt > new Date()).toBe(true);
    });

    it('should create a DataExport record in database', async () => {
      const result = await generateUserDataExport(testUserId);

      const exportRecord = await prisma.dataExport.findFirst({
        where: { userId: testUserId },
        orderBy: { requestedAt: 'desc' },
      });

      expect(exportRecord).toBeDefined();
      expect(exportRecord?.status).toBe('completed');
      expect(exportRecord?.filePath).toBe(result.filePath);
      expect(exportRecord?.dataHash).toBe(result.dataHash);
    });

    it('should generate export with correct structure', async () => {
      const result = await generateUserDataExport(testUserId);
      
      // Read and parse the exported file
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      const exportData = JSON.parse(fileContent);

      // Verify structure
      expect(exportData).toHaveProperty('exportDate');
      expect(exportData).toHaveProperty('user');
      expect(exportData).toHaveProperty('dataCategories');
      expect(exportData).toHaveProperty('retentionInfo');

      // Verify user data (minimal per NFR9)
      expect(exportData.user).toHaveProperty('email', testEmail);
      expect(exportData.user).toHaveProperty('role', 'user');
      expect(exportData.user).toHaveProperty('createdAt');
      expect(exportData.user).not.toHaveProperty('password'); // Security

      // Verify data categories listed
      expect(Array.isArray(exportData.dataCategories)).toBe(true);
      expect(exportData.dataCategories.length).toBeGreaterThan(0);

      // Verify retention info
      expect(exportData.retentionInfo).toHaveProperty('accountData');
      expect(exportData.retentionInfo).toHaveProperty('auditLogs');
    });

    it('should generate consistent data hash', async () => {
      const result = await generateUserDataExport(testUserId);
      
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      const expectedHash = createHash('sha256').update(fileContent).digest('hex');

      expect(result.dataHash).toBe(expectedHash);
    });

    it('should update user dataExportRequestedAt timestamp', async () => {
      const beforeExport = new Date();
      
      await generateUserDataExport(testUserId);
      
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      expect(user?.dataExportRequestedAt).toBeDefined();
      expect((user?.dataExportRequestedAt?.getTime() ?? 0) >= beforeExport.getTime()).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        generateUserDataExport('non-existent-user-id')
      ).rejects.toThrow('User not found');
    });
  });
});
