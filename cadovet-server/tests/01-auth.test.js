const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');

const { api } = h;
before(h.start);
after(h.stop);

describe('OTP send', () => {
  it('rejects a malformed mobile number', async () => {
    for (const mobile of ['', 'abc', '12345', '+1', '9'.repeat(16), '0000000000', '1234567890', '<script>', null, {}, [], true]) {
      const r = await api.post('/api/auth/otp/send', { mobile, purpose: 'login' });
      assert.equal(r.status, 400, `mobile=${JSON.stringify(mobile)}`);
    }
  });
  it('treats formatting variants of one number as the same account', async () => {
    const c = await h.signupCustomer();
    const m = c.mobile;
    for (const variant of [`${m.slice(0, 5)} ${m.slice(5)}`, `${m.slice(0, 5)}-${m.slice(5)}`, `+91${m}`, `+91 ${m.slice(0, 5)} ${m.slice(5)}`, ` ${m} `]) {
      assert.equal((await api.post('/api/auth/otp/send', { mobile: variant, purpose: 'signup' })).status, 409, variant);
      const sent = await api.post('/api/auth/otp/send', { mobile: variant, purpose: 'login' });
      assert.equal(sent.status, sent.status === 429 ? 429 : 200, variant);
    }
  });
  it('rejects an unknown purpose', async () => {
    const r = await api.post('/api/auth/otp/send', { mobile: h.uniqueMobile(), purpose: 'delete' });
    assert.equal(r.status, 400);
  });
  it('login for an unregistered number is 404', async () => {
    const r = await api.post('/api/auth/otp/send', { mobile: h.uniqueMobile(), purpose: 'login' });
    assert.equal(r.status, 404);
  });
  it('signup for an existing number is 409, and an invalid email is 400', async () => {
    const c = await h.signupCustomer();
    assert.equal((await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'signup' })).status, 409);
    assert.equal((await api.post('/api/auth/otp/send', { mobile: h.uniqueMobile(), purpose: 'signup', email: 'not-an-email' })).status, 400);
  });
  it('signup rejects an email that is already taken', async () => {
    const email = `taken${Date.now()}@example.com`;
    await h.signupCustomer({ email });
    const r = await api.post('/api/auth/otp/send', { mobile: h.uniqueMobile(), purpose: 'signup', email });
    assert.equal(r.status, 409);
  });
  it('is limited to 5 codes per hour per number and purpose', async () => {
    const c = await h.signupCustomer();
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' })).status);
    assert.deepEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.equal(statuses[5], 429);
    assert.equal(statuses[6], 429);
  });
});

describe('OTP sign-up', () => {
  it('creates a CUSTOMER with mobile, optional email, a customers row, and returns a working session', async () => {
    const email = `signup${Date.now()}@example.com`;
    const c = await h.signupCustomer({ name: 'Asha Rao', email });
    const me = await api.get('/api/auth/me', { token: c.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.name, 'Asha Rao');
    assert.equal(me.body.data.mobile, c.mobile);
    assert.equal(me.body.data.email, email);
    assert.equal(me.body.data.role_name, 'CUSTOMER');
    const row = await h.db.query('SELECT 1 FROM customers WHERE user_id = $1', [c.userId]);
    assert.equal(row.rowCount, 1);
  });
  it('works without an email', async () => {
    const c = await h.signupCustomer();
    const me = await api.get('/api/auth/me', { token: c.token });
    assert.equal(me.body.data.email, null);
  });
  it('a wrong code is rejected and creates nothing', async () => {
    const mobile = h.uniqueMobile();
    await api.post('/api/auth/otp/send', { mobile, purpose: 'signup' });
    const r = await api.post('/api/auth/otp/signup', { name: 'X Person', mobile, code: '000000' });
    assert.equal(r.status, 400);
    assert.equal((await h.db.query('SELECT 1 FROM users WHERE mobile = $1', [mobile])).rowCount, 0);
  });
  it('a code cannot be replayed', async () => {
    const mobile = h.uniqueMobile();
    await api.post('/api/auth/otp/send', { mobile, purpose: 'signup' });
    const code = h.otpFor(mobile);
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'First User', mobile, code })).status, 201);
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'First User', mobile, code })).status, 409);
  });
  it('a login code cannot be used to sign up (purposes are separate)', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const loginCode = h.otpFor(c.mobile);
    const other = h.uniqueMobile();
    const r = await api.post('/api/auth/otp/signup', { name: 'Sneaky One', mobile: other, code: loginCode });
    assert.equal(r.status, 400);
  });
  it('a code issued for one number does not work for another', async () => {
    const a = h.uniqueMobile(); const b = h.uniqueMobile();
    await api.post('/api/auth/otp/send', { mobile: a, purpose: 'signup' });
    await api.post('/api/auth/otp/send', { mobile: b, purpose: 'signup' });
    const r = await api.post('/api/auth/otp/signup', { name: 'Mixed Up', mobile: b, code: h.otpFor(a) });
    assert.equal(r.status, 400);
  });
  it('validates name and required fields', async () => {
    const mobile = h.uniqueMobile();
    await api.post('/api/auth/otp/send', { mobile, purpose: 'signup' });
    const code = h.otpFor(mobile);
    assert.equal((await api.post('/api/auth/otp/signup', { mobile, code })).status, 400); // no name
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'A', mobile, code })).status, 400); // too short
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'A'.repeat(200), mobile, code })).status, 400);
    // none of the failed attempts may have consumed the code
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'Valid Name', mobile, code })).status, 201);
  });
  it('rejects an unknown referral code without consuming the OTP', async () => {
    const mobile = h.uniqueMobile();
    await api.post('/api/auth/otp/send', { mobile, purpose: 'signup' });
    const code = h.otpFor(mobile);
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'Refer Test', mobile, code, referral_code: 'NOSUCHCODE' })).status, 400);
    assert.equal((await api.post('/api/auth/otp/signup', { name: 'Refer Test', mobile, code })).status, 201);
  });
  it('customers have no password: the staff login refuses them, by email or by mobile', async () => {
    const email = `nopw${Date.now()}@example.com`;
    const c = await h.signupCustomer({ email });
    for (const password of ['password', 'admin123', 'customer123', 'Test1234', c.mobile]) {
      assert.equal((await api.post('/api/auth/login', { identifier: email, password })).status, 401, `password=${password}`);
      assert.equal((await api.post('/api/auth/login', { identifier: c.mobile, password })).status, 400, 'mobile is not a staff identifier');
    }
    assert.equal((await api.post('/api/auth/login', { identifier: email, password: '' })).status, 400);
  });
  it('even a seeded customer whose row has a real password cannot sign in with it', async () => {
    assert.equal((await api.post('/api/auth/login', { identifier: 'customer@cadovet.com', password: 'customer123' })).status, 401);
  });
});

describe('OTP login', () => {
  it('signs in with the right code and returns tokens plus the user', async () => {
    const c = await h.signupCustomer({ name: 'Login Person' });
    const r = await h.loginWithOtp(c.mobile);
    assert.equal(r.status, 200);
    assert.ok(r.body.data.token && r.body.data.refreshToken);
    assert.equal(r.body.data.user.mobile, c.mobile);
  });
  it('rejects a wrong code, an empty code, and a non-numeric code', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    for (const code of ['000000', '', 'abcdef', '12345', '1234567', null]) {
      const r = await api.post('/api/auth/otp/login', { mobile: c.mobile, code });
      assert.equal(r.status, 400, `code=${JSON.stringify(code)}`);
    }
  });
  it('locks the code after 5 wrong guesses, even for the correct code', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const good = h.otpFor(c.mobile);
    const wrong = good === '000000' ? '111111' : '000000';
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await api.post('/api/auth/otp/login', { mobile: c.mobile, code: wrong })).status);
    assert.deepEqual(statuses.slice(0, 5), [400, 400, 400, 400, 400]);
    assert.equal(statuses[5], 429);
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code: good })).status, 429);
    // a fresh code works again
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code: h.otpFor(c.mobile) })).status, 200);
  });
  it('a new code invalidates the previous one', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const first = h.otpFor(c.mobile);
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const second = h.otpFor(c.mobile);
    if (first !== second) assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code: first })).status, 400);
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code: second })).status, 200);
  });
  it('expired codes are rejected', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    await h.db.query("UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE mobile = $1", [c.mobile]);
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code: h.otpFor(c.mobile) })).status, 400);
  });
  it('a code cannot be used twice', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const code = h.otpFor(c.mobile);
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code })).status, 200);
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code })).status, 400);
  });
  it('concurrent verifications of one code: exactly one wins', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const code = h.otpFor(c.mobile);
    const results = await Promise.all(Array.from({ length: 8 }, () => api.post('/api/auth/otp/login', { mobile: c.mobile, code })));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
  });
  it('a deactivated account cannot sign in or get a code', async () => {
    const c = await h.signupCustomer();
    await h.db.query("UPDATE users SET status = 'INACTIVE' WHERE id = $1", [c.userId]);
    assert.equal((await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' })).status, 404);
  });
  it('an account deactivated after the code was sent still cannot sign in', async () => {
    const c = await h.signupCustomer();
    await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' });
    const code = h.otpFor(c.mobile);
    await h.db.query("UPDATE users SET status = 'INACTIVE' WHERE id = $1", [c.userId]);
    assert.equal((await api.post('/api/auth/otp/login', { mobile: c.mobile, code })).status, 400);
  });
});

describe('Sessions and tokens', () => {
  it('rejects requests with no, malformed, tampered or wrongly-signed tokens', async () => {
    const c = await h.signupCustomer();
    assert.equal((await api.get('/api/auth/me')).status, 401);
    assert.equal((await api.get('/api/auth/me', { token: 'garbage' })).status, 401);
    assert.equal((await api.get('/api/auth/me', { token: c.token.slice(0, -3) + 'abc' })).status, 401);
    const forged = jwt.sign({ id: c.userId, role_id: 1 }, 'wrong-secret');
    assert.equal((await api.get('/api/auth/me', { token: forged })).status, 401);
    const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: 1 })).toString('base64url')}.`;
    assert.equal((await api.get('/api/auth/me', { token: noneAlg })).status, 401);
  });
  it('rejects an expired token', async () => {
    const c = await h.signupCustomer();
    const expired = jwt.sign({ id: c.userId, role_id: 3 }, process.env.JWT_SECRET, { expiresIn: -10 });
    assert.equal((await api.get('/api/auth/me', { token: expired })).status, 401);
  });
  it('a token for a deactivated user stops working immediately', async () => {
    const c = await h.signupCustomer();
    assert.equal((await api.get('/api/auth/me', { token: c.token })).status, 200);
    await h.db.query("UPDATE users SET status = 'INACTIVE' WHERE id = $1", [c.userId]);
    assert.equal((await api.get('/api/auth/me', { token: c.token })).status, 401);
  });
  it('refresh rotates the token: the old one is dead, the new one works', async () => {
    const c = await h.signupCustomer();
    const r1 = await api.post('/api/auth/refresh', { refreshToken: c.refreshToken });
    assert.equal(r1.status, 200);
    assert.notEqual(r1.body.data.refreshToken, c.refreshToken);
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: c.refreshToken })).status, 401); // reuse
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: r1.body.data.refreshToken })).status, 200);
    assert.equal((await api.get('/api/auth/me', { token: r1.body.data.token })).status, 200);
  });
  it('refresh rejects missing and made-up tokens', async () => {
    assert.equal((await api.post('/api/auth/refresh', {})).status, 400);
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: 'a'.repeat(96) })).status, 401);
  });
  it('logout revokes the refresh token', async () => {
    const c = await h.signupCustomer();
    assert.equal((await api.post('/api/auth/logout', { refreshToken: c.refreshToken })).status, 200);
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: c.refreshToken })).status, 401);
  });
});

describe('Staff password login (website / admin portal)', () => {
  it('signs staff in with the right password', async () => {
    const r = await api.post('/api/auth/login', { identifier: 'admin@cadovet.com', password: 'admin123' });
    assert.equal(r.status, 200);
    const me = await api.get('/api/auth/me', { token: r.body.data.token });
    assert.equal(me.body.data.role_name, 'ADMIN');
    assert.ok(me.body.data.permissions.includes('USER_CREATE'));
  });
  it('gives the same answer for a wrong password and an unknown account (no enumeration)', async () => {
    const wrong = await api.post('/api/auth/login', { identifier: 'admin@cadovet.com', password: 'nope-nope' });
    const unknown = await api.post('/api/auth/login', { identifier: 'nobody@example.com', password: 'nope-nope' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });
  it('rejects missing fields and non-string values without a 500', async () => {
    assert.equal((await api.post('/api/auth/login', {})).status, 400);
    assert.equal((await api.post('/api/auth/login', { identifier: 'admin@cadovet.com' })).status, 400);
    assert.equal((await api.post('/api/auth/login', { identifier: '9876543210', password: 'admin123' })).status, 400, 'a mobile number is not accepted here');
    for (const identifier of [{ $ne: 1 }, ['a'], 12345, true]) {
      const r = await api.post('/api/auth/login', { identifier, password: 'x' });
      assert.ok(r.status >= 400 && r.status < 500, `identifier=${JSON.stringify(identifier)} -> ${r.status}`);
    }
  });
  it('throttles repeated wrong passwords for one account (brute-force protection)', async () => {
    const statuses = [];
    for (let i = 0; i < 15; i++) statuses.push((await api.post('/api/auth/login', { identifier: 'ops@cadovet.com', password: `wrong-${i}` })).status);
    assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(',')}`);
    // ...and the lock also blocks the correct password until the window passes
    assert.equal((await api.post('/api/auth/login', { identifier: 'ops@cadovet.com', password: 'staff123' })).status, 429);
  });
});

describe('Account deletion', () => {
  it('needs a valid code sent to the account\'s own mobile', async () => {
    const c = await h.signupCustomer();
    assert.equal((await api.delete('/api/auth/me', {}, { token: c.token })).status, 400);
    assert.equal((await api.delete('/api/auth/me', { code: '123456' }, { token: c.token })).status, 403);
    assert.equal((await api.post('/api/auth/me/otp', {}, { token: c.token })).status, 200);
    assert.equal((await api.delete('/api/auth/me', { code: '000000' }, { token: c.token })).status, 403);
    assert.equal((await api.delete('/api/auth/me', { code: h.otpFor(c.mobile) }, { token: c.token })).status, 200);
  });
  it('anonymises the account, frees the number, and kills the session', async () => {
    const c = await h.signupCustomer({ email: `del${Date.now()}@example.com` });
    await h.createPet(c.token);
    await api.post('/api/auth/me/otp', {}, { token: c.token });
    await api.delete('/api/auth/me', { code: h.otpFor(c.mobile) }, { token: c.token });
    const row = (await h.db.query('SELECT name, email, mobile, status FROM users WHERE id = $1', [c.userId])).rows[0];
    assert.equal(row.name, 'Deleted User');
    assert.equal(row.mobile, null);
    assert.equal(row.status, 'INACTIVE');
    assert.match(row.email, /@deleted\.invalid$/);
    assert.equal((await api.get('/api/auth/me', { token: c.token })).status, 401);
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: c.refreshToken })).status, 401);
    assert.equal((await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' })).status, 404);
    // the number can be registered again
    assert.equal((await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'signup' })).status, 200);
  });
  it('a delete code cannot be used by another user', async () => {
    const a = await h.signupCustomer(); const b = await h.signupCustomer();
    await api.post('/api/auth/me/otp', {}, { token: a.token });
    assert.equal((await api.delete('/api/auth/me', { code: h.otpFor(a.mobile) }, { token: b.token })).status, 403);
    assert.equal((await api.get('/api/auth/me', { token: b.token })).status, 200);
    assert.equal((await api.get('/api/auth/me', { token: a.token })).status, 200);
  });
  it('staff accounts cannot be deleted from the customer flow', async () => {
    const token = await h.loginStaff('meera@cadovet.com');
    assert.equal((await api.post('/api/auth/me/otp', {}, { token })).status, 403);
    assert.equal((await api.delete('/api/auth/me', { code: '123456' }, { token })).status, 403);
    assert.equal((await api.delete('/api/auth/me', { password: 'doctor123' }, { token })).status, 403);
  });
  it('requires authentication', async () => {
    assert.equal((await api.post('/api/auth/me/otp', {})).status, 401);
    assert.equal((await api.delete('/api/auth/me', { code: '123456' })).status, 401);
  });
});
