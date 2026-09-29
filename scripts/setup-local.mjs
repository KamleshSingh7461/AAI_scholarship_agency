#!/usr/bin/env node
// One-time local setup: creates .env from .env.example with random secrets and an RS256 JWT key pair.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = join(root, '.env');
const keysDir = join(root, 'env', 'keys');

mkdirSync(keysDir, { recursive: true });
const priv = join(keysDir, 'jwt-private.pem');
const pub = join(keysDir, 'jwt-public.pem');
if (!existsSync(priv) || !existsSync(pub)) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  writeFileSync(priv, privateKey, { mode: 0o600 });
  writeFileSync(pub, publicKey);
  console.log('✔ Generated JWT key pair in env/keys/');
} else {
  console.log('• JWT keys already exist');
}

if (!existsSync(envPath)) {
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  const env = example.replace(/__GENERATED__/g, () => randomBytes(32).toString('base64url'));
  writeFileSync(envPath, env);
  console.log('✔ Created .env from .env.example');
} else {
  console.log('• .env already exists (not overwritten)');
}

console.log(`
Next steps:
  1. npm run infra:up        # Postgres, Redis, RabbitMQ, SeaweedFS (S3), Mailpit (Docker)
  2. npm run prisma:generate && npm run build:packages
  3. npm run db:migrate      # apply migrations to every service database
  4. npm run db:seed         # super admin + demo university/programs
  5. npm run dev             # all services + gateway + 3 web apps
`);
