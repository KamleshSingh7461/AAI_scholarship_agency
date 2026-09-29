#!/usr/bin/env node
// Runs only the three Next.js apps (public site :3000, student portal :3001, admin panel :3002).
process.argv.push('--apps-only');
await import('./dev-services.mjs');
