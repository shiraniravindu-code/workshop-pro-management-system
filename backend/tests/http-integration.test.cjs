// Real Express HTTP requests, with the database layer mocked (NO live MySQL).
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'local-test-secret-should-not-be-used-in-production';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const calls = [];
const dbPath = require.resolve('../src/config/db');
const pool = {
  async query(sql) {
    calls.push({ sql, params: [] });
    if (sql.trim() === 'SELECT 1') return [[{ '1': 1 }]];
    throw new Error(`Unhandled test query: ${sql}`);
  },
  async execute(sql, params = []) {
    calls.push({ sql, params });
    if (/SELECT user_id, role, is_active FROM users WHERE user_id/.test(sql)) {
      const id = Number(params[0]);
      return [[{ user_id: id, role: id === 1 ? 'admin' : 'technician', is_active: 1 }]];
    }
    if (/FROM customers\s+ORDER BY customer_id DESC/.test(sql)) return [[
      { customer_id: 3, name: 'Sample Customer', phone: '0710000000', email: null, address: null },
    ]];
    if (/FROM vehicles v\s+.*ORDER BY v\.vehicle_id DESC/s.test(sql)) return [[
      { vehicle_id: 5, customer_id: 3, vehicle_number: 'ABC-1234', vehicle_type: 'Car' },
    ]];
    if (/FROM jobs j\s+INNER JOIN vehicles v/.test(sql)) {
      if (/WHERE j\.technician_id = \?/.test(sql)) {
        assert.deepEqual(params, [2]); // technician must be filtered at SQL level
      }
      return [[{ job_id: 7, technician_id: 2, vehicle_id: 5, status: 'Assigned', problem_description: 'Engine noise', received_date: '2026-11-05' }]];
    }
    if (/FROM users\s+WHERE role = 'technician'/.test(sql)) return [[
      { user_id: 2, name: 'Test Technician', email: 'tech@example.test', role: 'technician', is_active: 1 },
    ]];
    if (/SELECT job_id, technician_id FROM jobs WHERE job_id = \?/.test(sql)) return [[{ job_id: Number(params[0]), technician_id: 2 }]];
    if (/FROM job_status_history h/.test(sql)) return [[{ history_id: 1, job_id: 7, status: 'Assigned', updated_by: 1 }]];
    if (/FROM jobs\s+WHERE job_id = \? FOR UPDATE/.test(sql)) return [[{
      job_id: 7, technician_id: 2, status: 'Assigned', completed_date: null,
    }]];
    if (/UPDATE jobs/.test(sql)) return [{ affectedRows: 1 }];
    if (/INSERT INTO job_status_history/.test(sql)) return [{ insertId: 12 }];
    throw new Error(`Unhandled test SQL: ${sql}`);
  },
  async getConnection() {
    return {
      beginTransaction: async () => calls.push({ event: 'BEGIN' }),
      commit: async () => calls.push({ event: 'COMMIT' }),
      rollback: async () => calls.push({ event: 'ROLLBACK' }),
      release: () => calls.push({ event: 'RELEASE' }),
      execute: (sql, params) => pool.execute(sql, params),
    };
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const app = require('../src/server');
let server;
let url;

test.before(async () => {
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

const tokenFor = (id) => jwt.sign({ userId: id, role: id === 1 ? 'admin' : 'technician' }, process.env.JWT_SECRET);
async function req(path, { method = 'GET', body, token, origin } = {}) {
  const res = await fetch(url + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

test('public root responds over real HTTP', async () => {
  const r = await req('/');
  assert.equal(r.status, 200);
  assert.match(r.body.message, /running/i);
});
test('health endpoint returns expected API + DB envelope (mock DB only)', async () => {
  const r = await req('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { api: 'running', database: 'connected' });
});
test('login validates a malformed body before attempting database access', async () => {
  const r = await req('/api/auth/login', { method: 'POST', body: { email: 'invalid', password: '' } });
  assert.equal(r.status, 400);
});
test('protected API rejects missing authentication', async () => {
  assert.equal((await req('/api/jobs')).status, 401);
});
test('admin data endpoints return envelopes expected by the frontend refresh()', async () => {
  const t = tokenFor(1);
  const c = await req('/api/customers', { token: t });
  const v = await req('/api/vehicles', { token: t });
  const j = await req('/api/jobs', { token: t });
  const u = await req('/api/users/technicians', { token: t });
  assert.equal(c.status, 200); assert.equal(c.body.customers[0].customer_id, 3);
  assert.equal(v.status, 200); assert.equal(v.body.vehicles[0].vehicle_id, 5);
  assert.equal(j.status, 200); assert.equal(j.body.jobs[0].job_id, 7);
  assert.equal(u.status, 200); assert.equal(u.body.technicians[0].user_id, 2);
});
test('technician jobs SQL query is restricted by technician ID', async () => {
  const r = await req('/api/jobs', { token: tokenFor(2) });
  assert.equal(r.status, 200);
  assert.ok(calls.some(c => /WHERE j\.technician_id = \?/.test(c.sql) && c.params?.[0] === 2));
});
test('technician cannot access admin-only directory or create a customer', async () => {
  const t = tokenFor(2);
  assert.equal((await req('/api/users/technicians', { token: t })).status, 403);
  assert.equal((await req('/api/customers', { token: t, method: 'POST', body: { name: 'New', phone: '0710000000' } })).status, 403);
});
test('job cost validation rejects values larger than the database column', async () => {
  const r = await req('/api/jobs', {
    token: tokenFor(1), method: 'POST', body: {
      vehicle_id: 5,
      problem_description: 'Engine noise',
      received_date: '2026-11-05',
      estimated_cost: 100000000,
    },
  });
  assert.equal(r.status, 400);
});
test('technician can load history of assigned job', async () => {
  const r = await req('/api/jobs/7/history', { token: tokenFor(2) });
  assert.equal(r.status, 200);
  assert.equal(r.body.history[0].status, 'Assigned');
});
test('technician can update assigned job status with a committed history entry', async () => {
  calls.length = 0;
  const r = await req('/api/jobs/7/status', { token: tokenFor(2), method: 'PATCH', body: { status: 'In Progress', repair_notes: 'Inspection started' } });
  assert.equal(r.status, 200);
  assert.ok(calls.some(c => /INSERT INTO job_status_history/.test(c.sql)));
  assert.ok(calls.some(c => c.event === 'COMMIT'));
  assert.ok(!calls.some(c => c.event === 'ROLLBACK'));
});
test('technician cannot modify final cost, even through direct API call', async () => {
  const r = await req('/api/jobs/7/status', { token: tokenFor(2), method: 'PATCH', body: { status: 'Completed', final_cost: 2500 } });
  assert.equal(r.status, 403);
});
test('CORS allows frontend localhost:5173', async () => {
  const r = await req('/', { origin: 'http://localhost:5173' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
test('unknown API routes return 404', async () => {
  assert.equal((await req('/api/does-not-exist')).status, 404);
});
