#!/usr/bin/env node
// Scaffolds the boilerplate for a NestJS microservice. Never overwrites existing files.
// Usage: node scripts/scaffold-service.mjs <name> <port> [extra deps as name@version ...]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './lib.mjs';

const [name, port, ...extra] = process.argv.slice(2);
if (!name || !port) {
  console.error('usage: scaffold-service.mjs <name> <port> [dep@version ...]');
  process.exit(1);
}
const dir = join(root, 'services', `${name}-service`);
const ENV = name.toUpperCase();

const deps = {
  '@aci/contracts': '0.1.0',
  '@aci/nest-common': '0.1.0',
  '@nestjs/common': '^11.1.6',
  '@nestjs/core': '^11.1.6',
  '@nestjs/platform-express': '^11.1.6',
  '@nestjs/swagger': '^11.2.0',
  '@prisma/client': '6.19.3',
  'class-transformer': '^0.5.1',
  'class-validator': '^0.14.2',
  'reflect-metadata': '^0.2.2',
  rxjs: '^7.8.2',
  zod: '^3.25.76',
};
for (const d of extra) {
  const at = d.lastIndexOf('@');
  deps[d.slice(0, at)] = d.slice(at + 1);
}

const files = {
  'package.json': JSON.stringify(
    {
      name: `@aci/${name}-service`,
      version: '0.1.0',
      private: true,
      scripts: {
        build: 'nest build',
        start: 'node dist/main.js',
        dev: 'nest start --watch --preserveWatchOutput',
        typecheck: 'tsc -p tsconfig.json --noEmit',
        'prisma:generate': 'prisma generate',
        'db:migrate': 'prisma migrate dev',
        'db:deploy': 'prisma migrate deploy',
        'db:studio': 'prisma studio',
      },
      dependencies: Object.fromEntries(Object.entries(deps).sort()),
      devDependencies: { prisma: '6.19.3' },
    },
    null,
    2,
  ) + '\n',
  'tsconfig.json': JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'dist', rootDir: 'src', baseUrl: '.' },
      include: ['src'],
    },
    null,
    2,
  ) + '\n',
  'tsconfig.build.json': JSON.stringify(
    { extends: './tsconfig.json', exclude: ['node_modules', 'dist', 'test', '**/*.spec.ts'] },
    null,
    2,
  ) + '\n',
  'nest-cli.json': JSON.stringify(
    {
      $schema: 'https://json.schemastore.org/nest-cli',
      collection: '@nestjs/schematics',
      sourceRoot: 'src',
      compilerOptions: {
        deleteOutDir: true,
        tsConfigPath: 'tsconfig.build.json',
        // The generated Prisma client is plain JS + a native engine; copy it next to the compiled code.
        assets: [{ include: 'generated/prisma/**/*', outDir: 'dist', watchAssets: false }],
      },
    },
    null,
    2,
  ) + '\n',
  'src/prisma.service.ts': `import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type BaseConfig } from '@aci/nest-common';
import { PrismaClient } from './generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: BaseConfig) {
    super({ datasources: { db: { url: config.databaseUrl } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
`,
  'src/main.ts': `import { bootstrapService } from '@aci/nest-common';
import { AppModule } from './app.module';
import { config } from './config';

void bootstrapService(AppModule, { config, title: '${name} service' });
`,
  '.env.example': `# ${name}-service — production variables (see root .env.example for local defaults)
NODE_ENV=production
APP_ENV=production
${ENV}_PORT=${port}
${ENV}_DATABASE_URL=postgresql://aci_${name}:CHANGE_ME@db-host:5432/aci_${name}?schema=public&sslmode=require
RABBITMQ_URL=amqps://user:CHANGE_ME@mq-host:5671
REDIS_URL=rediss://:CHANGE_ME@redis-host:6380
INTERNAL_API_TOKEN=CHANGE_ME_32_CHARS_MIN
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----
`,
  Dockerfile: `# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f services/${name}-service/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services/${name}-service ./services/${name}-service
RUN npm ci --no-audit --no-fund -w @aci/contracts -w @aci/nest-common -w @aci/${name}-service --include-workspace-root
RUN npm run build -w @aci/contracts -w @aci/nest-common \\
 && cd services/${name}-service && npx prisma generate && npm run build
RUN npm prune --omit=dev -w @aci/contracts -w @aci/nest-common -w @aci/${name}-service

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages ./packages
COPY --from=build --chown=node:node /repo/services/${name}-service/dist ./services/${name}-service/dist
COPY --from=build --chown=node:node /repo/services/${name}-service/prisma ./services/${name}-service/prisma
COPY --from=build --chown=node:node /repo/services/${name}-service/package.json ./services/${name}-service/package.json
COPY --from=build --chown=node:node /repo/package.json ./package.json
USER node
WORKDIR /repo/services/${name}-service
EXPOSE ${port}
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:${port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
`,
};

mkdirSync(join(dir, 'src'), { recursive: true });
mkdirSync(join(dir, 'prisma'), { recursive: true });
for (const [rel, content] of Object.entries(files)) {
  const p = join(dir, rel);
  if (existsSync(p)) {
    console.log(`  skip ${rel} (exists)`);
    continue;
  }
  writeFileSync(p, content);
  console.log(`  wrote ${rel}`);
}
console.log(`✔ scaffolded services/${name}-service`);
