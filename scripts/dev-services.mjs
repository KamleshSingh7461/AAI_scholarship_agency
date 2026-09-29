#!/usr/bin/env node
// Runs every microservice (and optionally the web apps) in watch mode with prefixed, coloured logs.
// Usage: node scripts/dev-services.mjs [--with-apps] [--only auth,athlete]
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { listApps, listServices, loadRootEnv, root } from './lib.mjs';

const args = process.argv.slice(2);
const withApps = args.includes('--with-apps') || args.includes('--apps-only');
const appsOnly = args.includes('--apps-only');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;

const env = { ...process.env, ...loadRootEnv(), FORCE_COLOR: '1' };
const colors = [31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96, 37];
const targets = [
  ...(appsOnly ? [] : listServices().map((s) => ({ name: s.replace('-service', ''), dir: join(root, 'services', s) }))),
  ...(withApps ? listApps().map((a) => ({ name: a, dir: join(root, 'apps', a) })) : []),
].filter((t) => !only || only.some((o) => t.name.includes(o)));

const pad = Math.max(...targets.map((t) => t.name.length));
const children = targets.map((t, i) => {
  const color = colors[i % colors.length];
  const tag = `\x1b[${color}m${t.name.padEnd(pad)}\x1b[0m │ `;
  const child = spawn('npm', ['run', 'dev'], { cwd: t.dir, env, shell: true });
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const l of lines) if (l.trim()) out.write(tag + l + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => process.stdout.write(`${tag}exited with code ${code}\n`));
  return child;
});

const stop = () => {
  for (const c of children) c.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log(`Started ${targets.length} processes: ${targets.map((t) => t.name).join(', ')}`);
