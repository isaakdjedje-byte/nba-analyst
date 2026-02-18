import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script for development database
 * Run with: npx prisma db seed
 */
async function main() {
  console.log('Starting database seed...');

  // Create data retention policies
  const retentionPolicies = [
    { dataType: 'user_data', retentionDays: 2555, description: 'User data retained for 7 years per RGPD' },
    { dataType: 'audit_log', retentionDays: 1825, description: 'Audit logs retained for 5 years' },
    { dataType: 'decisions', retentionDays: 1095, description: 'Policy decisions retained for 3 years' },
  ];

  for (const policy of retentionPolicies) {
    const existing = await prisma.dataRetentionPolicy.findFirst({
      where: { dataType: policy.dataType },
    });
    if (existing) {
      await prisma.dataRetentionPolicy.update({
        where: { id: existing.id },
        data: policy,
      });
    } else {
      await prisma.dataRetentionPolicy.create({
        data: policy,
      });
    }
  }
  console.log('Created data retention policies');

  console.log('\n✅ Database seed completed successfully!');
  console.log('No synthetic users or sample runs were created.');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
