import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const root = fileURLToPath(new URL('..', import.meta.url));

/** Minimal .env parser (KEY=VALUE, optional quotes, # comments). */
export function loadRootEnv() {
  const p = join(root, '.env');
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export function listServices() {
  const dir = join(root, 'services');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'package.json')))
    .map((d) => d.name);
}

export function listApps() {
  const dir = join(root, 'apps');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'package.json')))
    .map((d) => d.name);
}

export function hasScript(pkgDir, script) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  return Boolean(pkg.scripts?.[script]);
}
