#!/usr/bin/env node
// Runs an npm script in every service that defines it, with the root .env loaded.
// Usage: node scripts/for-each-service.mjs <script> [service-name...]
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { hasScript, listServices, loadRootEnv, root } from './lib.mjs';

const [script, ...only] = process.argv.slice(2);
if (!script) {
  console.error('usage: for-each-service.mjs <script> [service...]');
  process.exit(1);
}
const env = { ...loadRootEnv(), ...process.env };
let failed = 0;
for (const svc of listServices()) {
  if (only.length && !only.includes(svc)) continue;
  const dir = join(root, 'services', svc);
  if (!hasScript(dir, script)) continue;
  console.log(`\n▶ ${svc}: npm run ${script}`);
  const r = spawnSync('npm', ['run', script], { cwd: dir, env, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    failed++;
    console.error(`✖ ${svc} failed`);
  }
}
process.exit(failed ? 1 : 0);
