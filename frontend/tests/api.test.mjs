import test from 'node:test';
import assert from 'node:assert/strict';
import { api, validEmail } from '../src/lib/api.js';

test('email validation accepts a normal address and rejects malformed values', () => {
  assert.equal(Boolean(validEmail('admin@example.com')), true);
  assert.equal(Boolean(validEmail('not-an-email')), false);
  assert.equal(Boolean(validEmail('a@b@c.com')), false);
});

test('API helper sends JSON and a bearer token', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ saved: true }) };
  };

  try {
    const result = await api('/jobs', {
      method: 'POST', token: 'test-token', body: { vehicle_id: 1 },
    });
    assert.deepEqual(result, { saved: true });
    assert.match(captured.url, /\/api\/jobs$/);
    assert.equal(captured.options.headers.Authorization, 'Bearer test-token');
    assert.equal(captured.options.body, JSON.stringify({ vehicle_id: 1 }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API helper combines backend validation messages', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      message: 'Validation failed',
      errors: [{ field: 'email', message: 'Enter a valid email address' }],
    }),
  });

  try {
    await assert.rejects(
      api('/auth/login', { method: 'POST', body: {} }),
      /email: Enter a valid email address/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
