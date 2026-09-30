// Shared test harness. Runs the real Express app in-process on an ephemeral port against the isolated test database,
// and talks to it over real HTTP, exactly like the mobile app, the website and the admin portal do.
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://murat@localhost:5432/cadovet_test';

// Set BEFORE the app is required. dotenv never overrides variables that already exist, so the developer's .env
// (including the OTP_TEST_CODE shortcut and any SMS provider) cannot leak into the tests.
Object.assign(process.env, {
  DATABASE_URL: TEST_DB_URL,
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-that-is-long-enough-0123456789',
  OTP_TEST_CODE: '',
  OTP_TEST_MOBILES: '',
  TWILIO_ACCOUNT_SID: '',
  SMTP_HOST: '',
});
if (!/_test(\?|$)/.test(TEST_DB_URL)) throw new Error('Tests must run against a database whose name ends in _test');

const http = require('http');

// --- OTP capture: with no SMS provider the server prints "[otp] ... code for <+91…>: 123456". We read the real, random
// code from that line, so the whole issue -> hash -> verify path is exercised (no fixed-code backdoor).
const codes = new Map();
const realLog = console.log;
console.log = (...args) => {
  const m = typeof args[0] === 'string' && args[0].match(/^\[otp\] .*code for <\+?(\d+)>: (\d{6})/);
  if (m) { codes.set(m[1], m[2]); return; }
  const reset = typeof args[0] === 'string' && args[0].match(/^\[password-reset\] .*code for [^<]*<([^>]+)>: (\d{6})/);
  if (reset) { resetCodes.set(reset[1].toLowerCase(), reset[2]); return; }
  if (typeof args[0] === 'string' && /^\[(otp|password-reset)\]/.test(args[0])) return;
  realLog(...args);
};
const resetCodes = new Map(); // email -> latest password-reset code (printed to the console when SMTP is not configured)
const digits = (mobile) => String(mobile).replace(/\D/g, '');
const otpFor = (mobile) => {
  const d = digits(mobile);
  return codes.get(d.length === 10 ? `91${d}` : d);
};

let server;
let base;
const app = require('../src/app');
const db = require('../src/database');

async function start() {
  await new Promise((resolve) => { server = http.createServer(app).listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}
async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await db.pool.end();
}

// Tiny HTTP client: returns { status, body, headers }.
async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed, headers: res.headers };
}
const api = {
  get: (p, o) => call('GET', p, o),
  post: (p, body, o) => call('POST', p, { ...o, body }),
  put: (p, body, o) => call('PUT', p, { ...o, body }),
  patch: (p, body, o) => call('PATCH', p, { ...o, body }),
  delete: (p, body, o) => call('DELETE', p, { ...o, body }),
};

// --- Factories ---------------------------------------------------------------------------------------------------
let seq = 0;
// Unique, valid Indian mobile numbers (start with 9) so a re-run or another file never collides.
const uniqueMobile = () => `9${String(Date.now() % 100000).padStart(5, '0')}${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(2, '0')}`.slice(0, 10);

// Signs a customer up the way the mobile app does: send OTP -> verify OTP. Returns session + identifiers.
async function signupCustomer({ name = 'Test Customer', mobile = uniqueMobile(), email, referralCode } = {}) {
  const sent = await api.post('/api/auth/otp/send', { mobile, purpose: 'signup', ...(email ? { email } : {}) });
  if (sent.status !== 200) throw new Error(`otp/send failed: ${sent.status} ${JSON.stringify(sent.body)}`);
  const res = await api.post('/api/auth/otp/signup', { name, mobile, email, referral_code: referralCode, code: otpFor(mobile) });
  if (res.status !== 201) throw new Error(`otp/signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const d = res.body.data;
  return { mobile, email, name, token: d.token, refreshToken: d.refreshToken, userId: d.user.id };
}

async function loginWithOtp(mobile) {
  await api.post('/api/auth/otp/send', { mobile, purpose: 'login' });
  const res = await api.post('/api/auth/otp/login', { mobile, code: otpFor(mobile) });
  return res;
}

// Staff sign in with email + password (customers use mobile + OTP). Seeded development passwords:
//   admin@ = admin123 · doctor@ / meera@ = doctor123 · ops@ = staff123 · operations.head@ = OpsHead!2026#Cado · inventory@ / pharmacy@ = admin123
const SEED_PASSWORDS = {
  'admin@cadovet.com': 'admin123', 'doctor@cadovet.com': 'doctor123', 'meera@cadovet.com': 'doctor123',
  'ops@cadovet.com': 'staff123', 'operations.head@cadovet.com': 'OpsHead!2026#Cado',
  'inventory@cadovet.com': 'admin123', 'pharmacy@cadovet.com': 'admin123',
};
async function loginStaff(email, password = SEED_PASSWORDS[email]) {
  const res = await api.post('/api/auth/login', { identifier: email, password });
  if (res.status !== 200) throw new Error(`staff login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}
const loginStaffPassword = loginStaff;

async function createPet(token, over = {}) {
  const res = await api.post('/api/pets', { name: 'Bruno', species: 'Dog', breed: 'Labrador', gender: 'Male', ...over }, { token });
  if (res.status !== 201) throw new Error(`createPet failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

// A date N days ahead as YYYY-MM-DD (local), optionally moved forward to a given weekday (0=Sun).
function futureDate(daysAhead = 7, weekday) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  if (weekday !== undefined) while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function firstActiveDoctor() {
  const r = await db.query("SELECT id, available_days, available_from, available_to FROM doctors WHERE status = 'ACTIVE' ORDER BY id LIMIT 1");
  return r.rows[0];
}

// A request as the customer app/website makes it: pet + service + date + time, no doctor.
async function requestAppointment(token, petId, over = {}) {
  return api.post('/api/appointments', { pet_id: petId, service_id: 1, appointment_date: futureDate(10, 1), appointment_time: '11:00 AM', reason: 'Checkup', ...over }, { token });
}

// A pending request in the operational head's queue, ready to assign. Returns { customer, pet, appointment }.
async function pendingRequest(over = {}) {
  const customer = await signupCustomer();
  const pet = await createPet(customer.token);
  const res = await requestAppointment(customer.token, pet.id, over);
  if (res.status !== 201) throw new Error(`request failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { customer, pet, appointment: res.body.data };
}

const resetCodeFor = (email) => resetCodes.get(String(email).toLowerCase());
const clearResetCode = (email) => resetCodes.delete(String(email).toLowerCase());

// A desk role (Operational Head, Pharmacy, Inventory) must be rostered at a real branch to be created at all
// (see userController.createUser) — every test that creates one needs a valid, active location id for this.
let cachedLocationId;
async function firstActiveLocationId() {
  if (cachedLocationId) return cachedLocationId;
  const r = await db.query("SELECT id FROM locations WHERE status = 'ACTIVE' ORDER BY id LIMIT 1");
  if (!r.rows.length) throw new Error('No active location in the test database — did the locations migration run?');
  cachedLocationId = r.rows[0].id;
  return cachedLocationId;
}

// Creates a staff account the way an administrator does (email + temporary password) and returns its credentials.
async function createStaff(adminToken, { role = 'PHARMACY', password = 'Temp1234', name = 'Test Staff' } = {}) {
  const roles = (await api.get('/api/roles', { token: adminToken })).body.data;
  const email = `staff${Date.now()}${Math.floor(Math.random() * 1e6)}@cadovet.test`;
  const location_ids = ['PHARMACY', 'INVENTORY', 'OPERATIONAL_HEAD'].includes(role) ? [await firstActiveLocationId()] : undefined;
  const r = await api.post('/api/users', { name, email, password, role_id: roles.find((x) => x.name === role).id, location_ids }, { token: adminToken });
  if (r.status !== 201) throw new Error(`createStaff failed: ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.data.id, email, password };
}

module.exports = { start, stop, api, call, db, otpFor, resetCodeFor, clearResetCode, createStaff, uniqueMobile, signupCustomer, loginWithOtp, loginStaff, loginStaffPassword, createPet, futureDate, firstActiveDoctor, firstActiveLocationId, digits, requestAppointment, pendingRequest };
