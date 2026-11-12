#!/usr/bin/env node
// Safe, read-only live HTTP check. Expects the backend and MySQL to be running.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const BASE = (process.env.SMOKE_API_ORIGIN || 'http://localhost:5000').replace(/\/$/, '');
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const checks = [
  ['GET /', '/', { method: 'GET' }, 200, payload => /running/i.test(payload.message || '')],
  ['GET /api/health (live database)', '/api/health', { method: 'GET' }, 200, payload => payload.api === 'running' && payload.database === 'connected'],
  ['GET /api/jobs without token', '/api/jobs', { method: 'GET' }, 401],
  ['POST /api/auth/login invalid body', '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'invalid', password: '' }) }, 400],
  ['GET unknown API path', '/api/no-such-route', { method: 'GET' }, 404],
  ['CORS for frontend origin', '/', { method: 'GET', headers: { Origin: ORIGIN } }, 200, (_, response) => response.headers.get('access-control-allow-origin') === ORIGIN],
];
(async () => {
  let failed = 0;
  for (const [label, path, init, expectedStatus, bodyCheck] of checks) {
    try {
      const response = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(8000) });
      const result = await response.json().catch(() => ({}));
      const ok = response.status === expectedStatus && (!bodyCheck || bodyCheck(result, response));
      console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} (HTTP ${response.status})`);
      if (!ok) {
        if (path === '/api/health') console.error('  MySQL or backend config may be unavailable.');
        failed++;
      }
    } catch (error) {
      console.error(`FAIL: ${label}: ${error.cause?.code || error.message}`);
      failed++;
    }
  }
  if (failed) {
    console.error(`Failed ${failed}/${checks.length} live HTTP checks. Review the backend terminal.`);
    process.exitCode = 1;
  } else console.log(`All ${checks.length} live HTTP checks passed.`);
})();
