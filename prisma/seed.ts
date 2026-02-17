import { PrismaClient, Role, RunStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed script for development database
 * Run with: npx prisma db seed
 */
async function main() {
  console.log('Starting database seed...');

  // Hash passwords for dev users (password: 'password123')
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      role: Role.admin,
      privacyPolicyAcceptedAt: new Date(),
      privacyPolicyVersion: '1.0.0',
    },
  });
  console.log('Created admin user:', adminUser.email);

  // Create ops user
  const opsUser = await prisma.user.upsert({
    where: { email: 'ops@example.com' },
    update: {},
    create: {
      email: 'ops@example.com',
      password: hashedPassword,
      role: Role.ops,
      privacyPolicyAcceptedAt: new Date(),
      privacyPolicyVersion: '1.0.0',
    },
  });
  console.log('Created ops user:', opsUser.email);

  // Create regular user
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: hashedPassword,
      role: Role.user,
      privacyPolicyAcceptedAt: new Date(),
      privacyPolicyVersion: '1.0.0',
    },
  });
  console.log('Created regular user:', regularUser.email);

  // Create sample daily run
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyRun = await prisma.dailyRun.upsert({
    where: { runDate: today },
    update: {},
    create: {
      runDate: today,
      status: RunStatus.PENDING,
      triggeredBy: 'manual',
      traceId: `seed-${Date.now()}`,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
    },
  });
  console.log('Created daily run for:', today.toISOString().split('T')[0]);

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
  console.log('\nTest credentials:');
  console.log('  Admin: admin@example.com / password123');
  console.log('  Ops:   ops@example.com / password123');
  console.log('  User:  user@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
