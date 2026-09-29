import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * All browser API calls go to same-origin /api/* and are proxied to the gateway, so the
 * refresh-token cookie is first-party for this app and there is no CORS in the browser.
 */
const API_GATEWAY_URL = process.env.API_GATEWAY_URL ?? 'http://localhost:8080';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@aci/web-shared'],
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_GATEWAY_URL}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
