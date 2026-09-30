// Staff (admin, operational head, doctors, desk staff) sign in with EMAIL + PASSWORD; customers with mobile + OTP.
// This suite covers everything that makes the password route trustworthy: changing it, the forced change of a temporary
// password, administrator resets, the emailed reset code, what a change does to existing sessions, and the limits.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const { api } = h;
let admin, ops, doctor;
before(async () => {
  await h.start();
  admin = await h.loginStaff('admin@cadovet.com');
  ops = await h.loginStaff('ops@cadovet.com');
  doctor = await h.loginStaff('doctor@cadovet.com');
});
after(h.stop);

const signIn = (s, password = s.password) => api.post('/api/auth/login', { identifier: s.email, password });
const change = (token, current_password, new_password) => api.post('/api/auth/change-password', { current_password, new_password }, { token });

describe('Signing in', () => {
  it('is case-insensitive on the email and ignores surrounding spaces', async () => {
    const s = await h.createStaff(admin);
    for (const identifier of [s.email.toUpperCase(), ` ${s.email} `, s.email]) {
      assert.equal((await api.post('/api/auth/login', { identifier, password: s.password })).status, 200, identifier);
    }
    assert.equal((await api.post('/api/auth/login', { identifier: s.email, password: s.password.toUpperCase() })).status, 401, 'the password itself is case-sensitive');
  });
  it('a deactivated staff account cannot sign in, and its old token stops working', async () => {
    const s = await h.createStaff(admin);
    const token = (await signIn(s)).body.data.token;
    assert.equal((await api.get('/api/auth/me', { token })).status, 200);
    await h.db.query("UPDATE users SET status = 'INACTIVE' WHERE id = $1", [s.id]);
    assert.equal((await signIn(s)).status, 401);
    assert.equal((await api.get('/api/auth/me', { token })).status, 401);
  });
  it('locks one account after 10 wrong passwords without affecting others', async () => {
    const a = await h.createStaff(admin); const b = await h.createStaff(admin);
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await signIn(a, `wrong-pass-${i}1`)).status);
    assert.ok(statuses.includes(429), statuses.join(','));
    assert.equal((await signIn(a)).status, 429, 'the right password is refused while locked');
    assert.equal((await signIn(b)).status, 200, 'another account is unaffected');
  });
  it('never returns the password hash anywhere', async () => {
    for (const path of ['/api/auth/me', '/api/users', '/api/customers', '/api/doctors', '/api/appointments']) {
      const r = await api.get(path, { token: admin });
      assert.ok(!/password_hash|"password"/.test(JSON.stringify(r.body)), `${path} leaks a password field`);
    }
    const login = await signIn({ email: 'admin@cadovet.com', password: 'admin123' });
    assert.ok(!JSON.stringify(login.body).includes('password_hash'));
  });
});

describe('Changing your own password', () => {
  it('needs a session and is not available to customers (who have no password)', async () => {
    assert.equal((await api.post('/api/auth/change-password', { current_password: 'a', new_password: 'b' })).status, 401);
    const c = await h.signupCustomer();
    assert.equal((await change(c.token, 'anything1', 'Newpass123')).status, 403);
  });
  it('requires both fields, the right current password, and a new password that meets the policy', async () => {
    const s = await h.createStaff(admin); const token = (await signIn(s)).body.data.token;
    assert.equal((await api.post('/api/auth/change-password', {}, { token })).status, 400);
    assert.equal((await api.post('/api/auth/change-password', { current_password: s.password }, { token })).status, 400);
    assert.equal((await change(token, 'not-the-password1', 'Newpass123')).status, 403, 'wrong current password');
    for (const weak of ['short1', 'onlyletters', '12345678', 'a'.repeat(80) + '1', '']) {
      assert.equal((await change(token, s.password, weak)).status, 400, `weak=${weak.slice(0, 12)}`);
    }
    assert.equal((await change(token, s.password, s.password)).status, 400, 'must differ from the current one');
    assert.equal((await signIn(s)).status, 200, 'nothing changed while every attempt failed');
  });
  it('changes the password, returns a fresh session, and ends every other session', async () => {
    const s = await h.createStaff(admin);
    const first = (await signIn(s)).body.data;
    const laptop = (await signIn(s)).body.data; // a second device
    const r = await change(first.token, s.password, 'Brand-new-1');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.data.token && r.body.data.refreshToken);
    assert.equal((await api.get('/api/auth/me', { token: first.token })).status, 401, 'the old access token is dead');
    assert.equal((await api.get('/api/auth/me', { token: laptop.token })).status, 401, 'so is the other device\'s');
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: laptop.refreshToken })).status, 401, 'and its refresh token');
    assert.equal((await api.get('/api/auth/me', { token: r.body.data.token })).status, 200, 'the new session works');
    assert.equal((await api.post('/api/auth/refresh', { refreshToken: r.body.data.refreshToken })).status, 200);
    assert.equal((await signIn(s)).status, 401, 'the old password no longer works');
    assert.equal((await signIn(s, 'Brand-new-1')).status, 200, 'the new one does');
    assert.equal((await h.db.query("SELECT 1 FROM audit_logs WHERE action = 'PASSWORD_CHANGED' AND user_id = $1", [s.id])).rowCount, 1);
  });
  it('guessing the current password is throttled', async () => {
    const s = await h.createStaff(admin); const token = (await signIn(s)).body.data.token;
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await change(token, `guess-${i}-abc1`, 'Newpass123')).status);
    assert.ok(statuses.includes(429), statuses.join(','));
    assert.equal((await change(token, s.password, 'Newpass123')).status, 429, 'even the right one, while locked');
  });
});

describe('Temporary passwords set by an administrator', () => {
  it('a new account must change its temporary password; the flag clears once it does', async () => {
    const s = await h.createStaff(admin);
    const login = (await signIn(s)).body.data;
    assert.equal(login.user.must_change_password, true);
    assert.equal((await api.get('/api/auth/me', { token: login.token })).body.data.must_change_password, true);
    assert.equal((await change(login.token, s.password, 'MyOwn-pass9')).status, 200);
    const again = (await signIn(s, 'MyOwn-pass9')).body.data;
    assert.equal(again.user.must_change_password, false);
  });
  it('the administrator can reset a staff password; the person is signed out and must choose a new one', async () => {
    const s = await h.createStaff(admin);
    const token = (await signIn(s)).body.data.token;
    assert.equal((await change(token, s.password, 'Chosen-pass1')).status, 200);
    const live = (await signIn(s, 'Chosen-pass1')).body.data;
    const r = await api.post(`/api/users/${s.id}/reset-password`, { password: 'Reset-temp5' }, { token: admin });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await api.get('/api/auth/me', { token: live.token })).status, 401);
    assert.equal((await signIn(s, 'Chosen-pass1')).status, 401);
    const back = (await signIn(s, 'Reset-temp5')).body.data;
    assert.equal(back.user.must_change_password, true);
    assert.equal((await h.db.query("SELECT 1 FROM audit_logs WHERE action = 'PASSWORD_RESET_BY_ADMIN' AND record_id = $1", [s.id])).rowCount, 1);
  });
  it('only an administrator can reset, the target must be staff, and the new password must meet the policy', async () => {
    const s = await h.createStaff(admin);
    const c = await h.signupCustomer();
    assert.equal((await api.post(`/api/users/${s.id}/reset-password`, { password: 'Reset-temp5' }, { token: ops })).status, 403);
    assert.equal((await api.post(`/api/users/${s.id}/reset-password`, { password: 'Reset-temp5' }, { token: doctor })).status, 403);
    assert.equal((await api.post(`/api/users/${s.id}/reset-password`, { password: 'Reset-temp5' }, { token: c.token })).status, 403);
    assert.equal((await api.post(`/api/users/${s.id}/reset-password`, { password: 'Reset-temp5' })).status, 401);
    assert.equal((await api.post(`/api/users/${s.id}/reset-password`, { password: 'weak' }, { token: admin })).status, 400);
    assert.equal((await api.post(`/api/users/${c.userId}/reset-password`, { password: 'Reset-temp5' }, { token: admin })).status, 400, 'customers have no password');
    assert.equal((await api.post('/api/users/99999999/reset-password', { password: 'Reset-temp5' }, { token: admin })).status, 404);
    assert.equal((await api.post('/api/users/abc/reset-password', { password: 'Reset-temp5' }, { token: admin })).status, 400);
  });
});

describe('Forgot password (emailed code, staff only)', () => {
  const forgot = (identifier) => api.post('/api/auth/forgot-password', { identifier });
  const reset = (identifier, code, password) => api.post('/api/auth/reset-password', { identifier, code, password });

  it('sends a code to a staff email and lets them choose a new password, ending all old sessions', async () => {
    const s = await h.createStaff(admin);
    const live = (await signIn(s)).body.data;
    h.clearResetCode(s.email);
    assert.equal((await forgot(s.email)).status, 200);
    const code = h.resetCodeFor(s.email);
    assert.match(code, /^\d{6}$/);
    assert.equal((await reset(s.email, '000000', 'Forgot-fix1')).status, 400, 'wrong code');
    assert.equal((await reset(s.email, code, 'weak')).status, 400, 'policy applies');
    assert.equal((await reset(s.email, code, 'Forgot-fix1')).status, 200);
    assert.equal((await reset(s.email, code, 'Another-one2')).status, 400, 'a code works once');
    assert.equal((await api.get('/api/auth/me', { token: live.token })).status, 401, 'old session ended');
    assert.equal((await signIn(s)).status, 401);
    const back = await signIn(s, 'Forgot-fix1');
    assert.equal(back.status, 200);
    assert.equal(back.body.data.user.must_change_password, false, 'they chose it themselves');
  });
  it('gives the same answer for unknown addresses and customers, and sends no code to them', async () => {
    const customerEmail = `cust${Date.now()}@example.com`;
    const c = await h.signupCustomer({ email: customerEmail });
    h.clearResetCode(customerEmail); h.clearResetCode('nobody@example.com');
    const [a, b, d] = [await forgot(customerEmail), await forgot('nobody@example.com'), await forgot(c.mobile)];
    assert.deepEqual([a.status, b.status, d.status], [200, 200, 200]);
    assert.equal(a.body.message, b.body.message);
    assert.equal(h.resetCodeFor(customerEmail), undefined, 'customers have no password to reset');
    assert.equal(h.resetCodeFor('nobody@example.com'), undefined);
    assert.equal((await reset(customerEmail, '123456', 'Forgot-fix1')).status, 400);
  });
  it('locks a code after 5 wrong guesses', async () => {
    const s = await h.createStaff(admin);
    h.clearResetCode(s.email);
    await forgot(s.email);
    const code = h.resetCodeFor(s.email);
    const wrong = code === '000000' ? '111111' : '000000';
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await reset(s.email, wrong, 'Forgot-fix1')).status);
    assert.deepEqual(statuses.slice(0, 5), [400, 400, 400, 400, 400]);
    assert.equal(statuses[5], 429);
    assert.equal((await reset(s.email, code, 'Forgot-fix1')).status, 429, 'even the right code, once locked');
  });
  it('limits how many codes can be requested per hour', async () => {
    const s = await h.createStaff(admin);
    for (let i = 0; i < 3; i++) { h.clearResetCode(s.email); await forgot(s.email); assert.ok(h.resetCodeFor(s.email), `code ${i + 1}`); }
    h.clearResetCode(s.email);
    assert.equal((await forgot(s.email)).status, 200, 'same reply, so the limit cannot be probed');
    assert.equal(h.resetCodeFor(s.email), undefined, 'but no fourth code is issued');
  });
});
