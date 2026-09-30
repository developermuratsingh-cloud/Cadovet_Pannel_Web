process.env.PUBLIC_BOOKING_RATE_LIMIT = '6'; // set before the app loads: this file tests the throttle itself
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const h = require('./helpers');

const { api } = h;
let admin, cust;
const serverDir = path.resolve(__dirname, '..');

before(async () => { await h.start(); admin = await h.loginStaff('admin@cadovet.com'); cust = await h.signupCustomer(); });
after(h.stop);

describe('HTTP basics and security headers', () => {
  it('health check reports the database', async () => {
    const r = await api.get('/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.db, 'up');
  });
  it('sends security headers and does not advertise Express', async () => {
    const r = await api.get('/health');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(r.headers.get('strict-transport-security'));
    assert.ok(r.headers.get('x-frame-options') || r.headers.get('content-security-policy'));
  });
  it('unknown routes are JSON 404s', async () => {
    const r = await api.get('/api/does-not-exist');
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
  });
  it('malformed JSON is a 400, not a 500', async () => {
    const r = await h.call('POST', '/api/auth/otp/send', { raw: '{"mobile": ', headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.success, false);
  });
  it('an oversized body is a 413', async () => {
    const r = await h.call('POST', '/api/auth/otp/send', { raw: JSON.stringify({ mobile: '9'.repeat(200000) }), headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 413);
  });
  it('a body of the wrong type does not crash the endpoint', async () => {
    for (const raw of ['[]', '"just a string"', 'null', '123']) {
      const r = await h.call('POST', '/api/auth/login', { raw, headers: { 'Content-Type': 'application/json' } });
      assert.ok(r.status >= 400 && r.status < 500, `${raw} -> ${r.status}`);
    }
  });
});

describe('Identifier validation on every resource route', () => {
  const resources = ['pets', 'appointments', 'customers', 'invoices', 'medical-records', 'doctors', 'services', 'users', 'inventory', 'documents'];
  for (const r of resources) {
    it(`GET /api/${r}/<bad id> is 400, never 500`, async () => {
      for (const id of ['abc', '1;DROP', '-1', '0', '99999999999999999999', '1.5', '%00']) {
        const res = await api.get(`/api/${r}/${encodeURIComponent(id)}`, { token: admin });
        assert.ok([400, 404].includes(res.status), `/api/${r}/${id} -> ${res.status} ${JSON.stringify(res.body)}`);
        assert.ok(!JSON.stringify(res.body).match(/syntax|integer|relation|column/i), 'no database internals in the response');
      }
    });
  }
});

describe('The permission model is staff-only', () => {
  it('customers cannot read roles, role details or permissions', async () => {
    for (const p of ['/api/roles', '/api/roles/1', '/api/permissions', '/api/departments/departments']) {
      assert.equal((await api.get(p, { token: cust.token })).status, 403, p);
    }
  });
  it('staff still can', async () => {
    assert.equal((await api.get('/api/roles', { token: admin })).status, 200);
    assert.equal((await api.get('/api/permissions', { token: admin })).status, 200);
  });
});

describe('Abuse throttles', () => {
  it('public booking is limited per client (6/hour in this test)', async () => {
    const statuses = [];
    for (let i = 0; i < 9; i++) {
      statuses.push((await api.post('/api/appointments/public', { owner_name: 'Rate Test', phone: h.uniqueMobile(), pet_name: 'Rex', service_id: 1 })).status);
    }
    assert.equal(statuses.filter((s) => s === 201).length, 6, statuses.join(','));
    assert.deepEqual(statuses.slice(6), [429, 429, 429]);
    const r = await api.post('/api/appointments/public', { owner_name: 'Rate Test', phone: h.uniqueMobile() });
    assert.ok(r.headers.get('retry-after'));
  });
});

describe('Production-mode safeguards (real child processes)', () => {
  const run = (script, env = {}) => spawnSync(process.execPath, ['-e', script], {
    cwd: serverDir, encoding: 'utf8', timeout: 20000,
    env: { PATH: process.env.PATH, DATABASE_URL: process.env.DATABASE_URL, ...env },
  });

  it('refuses to start in production without a strong JWT_SECRET', () => {
    for (const secret of ['', 'short', 'secret']) {
      const r = run("require('./src/app')", { NODE_ENV: 'production', JWT_SECRET: secret, CORS_ORIGIN: 'https://cadovet.com' });
      assert.notEqual(r.status, 0, `secret=${JSON.stringify(secret)} should not start`);
      assert.match(r.stderr, /JWT_SECRET/);
    }
  });
  it('starts in production with a strong secret', () => {
    const r = run("require('./src/app'); setTimeout(() => process.exit(0), 200)", { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGIN: 'https://cadovet.com' });
    assert.equal(r.status, 0, r.stderr);
  });
  it('production hides internal error details and does not allow cross-origin access by default', () => {
    const script = `
      const http = require('http');
      const app = require('./src/app');
      const s = http.createServer(app).listen(0, async () => {
        const base = 'http://127.0.0.1:' + s.address().port;
        const out = {};
        const bad = await fetch(base + '/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
        out.malformed = [bad.status, await bad.text()];
        const cors = await fetch(base + '/health', { headers: { Origin: 'https://evil.example' } });
        out.corsHeader = cors.headers.get('access-control-allow-origin');
        console.log(JSON.stringify(out)); process.exit(0);
      });`;
    // CORS_ORIGIN is pinned to empty (= unset): dotenv never overrides it from the developer's .env, which has CORS_ORIGIN=*.
    const r = run(script, { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGIN: '' });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(out.malformed[0], 400);
    assert.equal(out.corsHeader, null, 'no CORS header without CORS_ORIGIN in production');
  });
  it('production allows only the configured origin', () => {
    const script = `
      const http = require('http');
      const app = require('./src/app');
      const s = http.createServer(app).listen(0, async () => {
        const base = 'http://127.0.0.1:' + s.address().port;
        const ok = await fetch(base + '/health', { headers: { Origin: 'https://cadovet.com' } });
        const no = await fetch(base + '/health', { headers: { Origin: 'https://evil.example' } });
        console.log(JSON.stringify({ ok: ok.headers.get('access-control-allow-origin'), no: no.headers.get('access-control-allow-origin') }));
        process.exit(0);
      });`;
    const r = run(script, { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGIN: 'https://cadovet.com,https://admin.cadovet.com' });
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(out.ok, 'https://cadovet.com');
    assert.equal(out.no, null);
  });
  it('the OTP test-code shortcut is ignored in production', () => {
    const script = `
      const { issueOtp, verifyOtp } = require('./src/utils/otp');
      (async () => {
        const db = require('./src/database');
        const m = '9000000123';
        await db.query("DELETE FROM otp_codes WHERE mobile = $1", [m]);
        await issueOtp('LOGIN', m);
        const r = await verifyOtp('LOGIN', m, '123456');
        console.log(JSON.stringify({ accepted: !r.error }));
        process.exit(0);
      })();`;
    const r = run(script, { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), OTP_TEST_CODE: '123456', OTP_TEST_MOBILES: '9000000123', CORS_ORIGIN: 'https://cadovet.com' });
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(out.accepted, false);
  });
});
