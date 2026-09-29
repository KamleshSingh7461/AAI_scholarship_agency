#!/usr/bin/env node
// Creates the first SUPER_ADMIN directly in the auth database (there is no API to bootstrap one).
// Usage: npm run db:seed        (after migrations)
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { loadRootEnv, root } from './lib.mjs';

const env = { ...loadRootEnv(), ...process.env };
const require = createRequire(import.meta.url);
const { PrismaClient } = require(join(root, 'services/auth-service/src/generated/prisma'));

const phone = env.SEED_SUPER_ADMIN_PHONE;
if (!phone || !/^\+\d{10,15}$/.test(phone)) {
  console.error('Set SEED_SUPER_ADMIN_PHONE (E.164, e.g. +919812345678) in .env');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: env.AUTH_DATABASE_URL } } });
try {
  const user = await prisma.user.upsert({
    where: { phone },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
    create: { phone, fullName: env.SEED_SUPER_ADMIN_NAME ?? 'Platform Owner', role: 'SUPER_ADMIN' },
  });
  console.log(`✔ SUPER_ADMIN ready: ${user.phone} (${user.id})`);
  console.log('  Log in at the admin panel with this number; the OTP prints in the notification-service log locally.');
} finally {
  await prisma.$disconnect();
}
