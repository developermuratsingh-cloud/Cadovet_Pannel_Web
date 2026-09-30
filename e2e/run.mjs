// End-to-end check that the four parts of Cadovet work as ONE system, in a real browser:
//   WEBSITE (React, headless Chrome)  <->  BACKEND (Express + PostgreSQL)  <->  ADMIN PORTAL (same React app, staff login)
//   and the MOBILE APP, which talks to the backend with exactly the API calls made below (OTP sign-up / login, pets,
//   appointments). Everything runs against an isolated database; nothing touches development data.
//
//   node e2e/run.mjs            (from cado_vet/, needs PostgreSQL and Google Chrome)
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = 5002, WEB_PORT = 5174;
const API = `http://localhost:${API_PORT}/api`, WEB = `http://localhost:${WEB_PORT}`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TEST_DB = process.env.TEST_DATABASE_URL || 'postgresql://murat@localhost:5432/cadovetTest'.replace('cadovetTest', 'cadovet_test');

// --- tiny test framework ---------------------------------------------------------------------------------------------
const results = [];
let current = '';
const step = (name) => { current = name; console.log(`\n▶ ${name}`); };
const check = (ok, what, detail = '') => { results.push({ step: current, what, ok: !!ok }); console.log(`  ${ok ? '✔' : '✖'} ${what}${ok ? '' : `  ${detail}`}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- processes -------------------------------------------------------------------------------------------------------
const children = [];
const resetCodes = new Map(); // email -> password-reset code (printed when SMTP is not configured)
const otpCodes = new Map(); // digits -> latest code, parsed from the backend's console (no SMS provider in tests)
function start(cmd, args, opts, onLine) {
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(p);
  const feed = (chunk) => String(chunk).split('\n').forEach((l) => onLine?.(l));
  p.stdout.on('data', feed); p.stderr.on('data', feed);
  return p;
}
async function waitFor(fn, what, ms = 40000) {
  const t = Date.now();
  while (Date.now() - t < ms) { try { if (await fn()) return; } catch { /* retry */ } await sleep(300); }
  throw new Error(`timed out waiting for ${what}`);
}
const otpFor = (mobile) => { const d = String(mobile).replace(/\D/g, ''); return otpCodes.get(d.length === 10 ? `91${d}` : d); };

// --- API client (what the mobile app does) ---------------------------------------------------------------------------
async function api(method, url, { token, body } = {}) {
  const res = await fetch(`${API}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, body: json };
}
const nextMonday = (weeks = 1) => { const d = new Date(); d.setDate(d.getDate() + weeks * 7); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const mobile = (n) => `9${String(Date.now()).slice(-7)}${String(n).padStart(2, '0')}`.slice(0, 10);

// --- browser helpers -------------------------------------------------------------------------------------------------
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, text, ms = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, text);
async function fillByPlaceholder(page, placeholder, value) {
  const el = await page.waitForSelector(`input[placeholder="${placeholder}"]`, { timeout: 10000 });
  await el.click({ clickCount: 3 }); await el.type(value);
}
// React-controlled inputs need the native setter + an input event to be cleared reliably.
async function clearInput(page, selector) {
  await page.$eval(selector, (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function setDate(page, value) {
  await page.evaluate((v) => {
    const el = document.querySelector('form input[type=date]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function newPage(browser, errors) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  pages.push(page);
  await page.setViewport({ width: 1366, height: 1000 });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of (400|401|404|409|429)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('dialog', (d) => d.accept());
  return { page, ctx };
}


// Everybody signs in through the same page: mobile number + OTP (the code is read from the backend log; no SMS in tests).
async function signInWithOtp(page, mobile) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await page.type('[data-testid="otp-mobile"]', mobile);
  await page.click('[data-testid="otp-send"]');
  await page.waitForSelector('[data-testid="otp-code"]');
  await page.type('[data-testid="otp-code"]', otpFor(mobile));
  await Promise.all([page.waitForFunction(() => location.pathname !== '/login', { timeout: 15000 }), page.click('[data-testid="otp-verify"]')]);
  await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
}
// Staff (admin, operational head, doctors, desk staff) sign in with email + password on the Staff tab.
async function signInStaff(page, email, password) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await page.click('[data-testid="tab-staff"]');
  await page.type('[data-testid="staff-email"]', email);
  await page.type('[data-testid="staff-password"]', password);
  await Promise.all([page.waitForFunction(() => location.pathname !== '/login', { timeout: 15000 }), page.click('[data-testid="staff-submit"]')]);
  await page.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
}
const staffToken = async (email, password) => (await api('POST', '/auth/login', { body: { identifier: email, password } })).body.data.token;
const pathOf = (page) => new URL(page.url()).pathname;
const STAFF = { ops: ['ops@cadovet.com', 'staff123'], doctor1: ['doctor@cadovet.com', 'doctor123'], admin: ['admin@cadovet.com', 'admin123'] };

let browser;
const pages = [];
async function main() {
  step('Setup: fresh isolated database, backend :5002, website :5174');
  const db = spawnSync('node', ['cadovet-server/tests/setup-db.js'], { cwd: ROOT, env: { ...process.env, TEST_DATABASE_URL: TEST_DB }, encoding: 'utf8' });
  check(db.status === 0, 'database built from schema + seeds + migrations', db.stderr);
  start('node', ['server.js'], {
    cwd: path.join(ROOT, 'cadovet-server'),
    env: { PATH: process.env.PATH, PORT: String(API_PORT), DATABASE_URL: TEST_DB, NODE_ENV: 'test', JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-12', OTP_TEST_CODE: '', OTP_TEST_MOBILES: '', CORS_ORIGIN: WEB, PUBLIC_BOOKING_RATE_LIMIT: '1000' },
  }, (l) => { const m = l.match(/\[otp\] .*code for <\+?(\d+)>: (\d{6})/); if (m) otpCodes.set(m[1], m[2]); const r = l.match(/\[password-reset\] .*code for [^<]*<([^>]+)>: (\d{6})/); if (r) resetCodes.set(r[1].toLowerCase(), r[2]); });
  start('npx', ['vite', '--port', String(WEB_PORT), '--strictPort'], { cwd: path.join(ROOT, 'cadovet-client'), env: { ...process.env, VITE_API_URL: API } });
  await waitFor(async () => (await fetch(`${API}/../health`.replace('/api/../', '/'))).ok, 'backend');
  await waitFor(async () => (await fetch(WEB)).ok, 'website');
  check(true, 'backend and website are up');

  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const errors = [];

  // ---------------------------------------------------------------------------------------------------------------
  step('1. WEBSITE: a visitor books a doorstep visit (no account)');
  const guestMobile = mobile(1);
  const { page: web } = await newPage(browser, errors);
  await web.goto(WEB, { waitUntil: 'networkidle0' });
  await fillByPlaceholder(web, 'Owner Name', 'E2E Guest');
  await fillByPlaceholder(web, 'Phone Number', guestMobile);
  await fillByPlaceholder(web, 'e.g. Dog, Cat, Puppy', 'Cat');
  await setDate(web, nextMonday(2));
  await fillByPlaceholder(web, 'Address', '12 Lake Road, Kolkata');
  await (await web.$$('form button[type=submit]')).at(-1).click();
  await waitText(web, 'Home visit scheduled');
  const guestApptId = Number((await bodyText(web)).match(/Appointment #(\d+)/)?.[1]);
  check(guestApptId > 0, `the site confirms the request (appointment #${guestApptId})`);

  const ops = await staffToken(...STAFF.ops);
  const guestAppt = (await api('GET', `/appointments/${guestApptId}`, { token: ops })).body.data;
  check(guestAppt.status === 'PENDING' && guestAppt.doctor_id === null, 'the website booking waits as PENDING with no doctor', `${guestAppt.status}/${guestAppt.doctor_id}`);
  check(guestAppt.source === 'WEBSITE' && guestAppt.customer_mobile === guestMobile, 'it is marked WEBSITE and the phone is stored in the canonical form');

  step('2. WEBSITE: a failed booking is never reported as a success');
  await web.goto(WEB, { waitUntil: 'networkidle0' });
  await fillByPlaceholder(web, 'Owner Name', 'Bad Phone');
  await fillByPlaceholder(web, 'Phone Number', 'not-a-number');
  await fillByPlaceholder(web, 'Address', '1 Nowhere Street');
  await (await web.$$('form button[type=submit]')).at(-1).click();
  await waitText(web, '⚠️');
  const t2 = await bodyText(web);
  check(!t2.includes('Home visit scheduled') && !t2.includes('request submitted'), 'the visitor sees a warning, not a success message');

  // ---------------------------------------------------------------------------------------------------------------
  step('3. MOBILE APP (API): a customer signs up with OTP, adds a pet and requests an appointment (no doctor)');
  const appMobile = mobile(2);
  const appEmail = `e2e.app.${Date.now()}@example.com`;
  await api('POST', '/auth/otp/send', { body: { mobile: appMobile, purpose: 'signup', email: appEmail } });
  const su = await api('POST', '/auth/otp/signup', { body: { name: 'E2E App User', mobile: appMobile, email: appEmail, code: otpFor(appMobile) } });
  check(su.status === 201, 'OTP sign-up succeeded', JSON.stringify(su.body));
  const appToken = su.body.data.token;
  const pet = await api('POST', '/pets', { token: appToken, body: { name: 'Pixel', species: 'Dog', breed: 'Pug' } });
  check(pet.status === 201, 'pet added');
  const av = await api('GET', `/appointments/availability?date=${nextMonday(3)}`, { token: appToken });
  check(av.body.data.slots.some((s) => s.time === '10:30 AM' && s.available), 'the app offers clinic time slots (no doctor to choose)');
  const req = await api('POST', '/appointments', { token: appToken, body: { pet_id: pet.body.data.id, service_id: 1, appointment_date: nextMonday(3), appointment_time: '10:30 AM', reason: 'Booked in the app' } });
  check(req.status === 201 && req.body.data.status === 'PENDING' && req.body.data.doctor_id === null, 'the request is PENDING and unassigned', JSON.stringify(req.body));
  const appApptId = req.body.data?.id;

  // ---------------------------------------------------------------------------------------------------------------
  step('4. OPERATIONAL HEAD (browser): signs in with email + password and finds both requests in the queue');
  const { page: opsPage } = await newPage(browser, errors);
  await opsPage.goto(`${WEB}/admin/appointments`, { waitUntil: 'networkidle0' });
  check(pathOf(opsPage) === '/login', 'the panel redirects a logged-out visitor to the login page');
  await signInStaff(opsPage, ...STAFF.ops);
  check(pathOf(opsPage) === '/admin', 'sign-in lands on the operational head\'s dashboard', pathOf(opsPage));
  await waitText(opsPage, 'Waiting for a doctor');
  const waiting = Number(await opsPage.$eval('[data-testid="stat-Waiting for a doctor"]', (e) => e.textContent));
  check(waiting >= 2, `the dashboard counts the waiting requests (${waiting})`);
  await opsPage.goto(`${WEB}/admin/appointments`, { waitUntil: 'networkidle0' });
  await waitText(opsPage, 'E2E App User');
  const queueText = await bodyText(opsPage);
  check(queueText.includes('E2E Guest') && queueText.includes('E2E App User'), 'the website request and the app request are both in the "Needs doctor" queue');
  check(queueText.includes('Needs a doctor') && queueText.includes('Pixel'), 'each shows "Needs a doctor" and the pet');
  check(queueText.includes('Website') && queueText.includes('App'), 'the source of each request is shown');

  step('5. OPERATIONAL HEAD assigns the app request to Dr. (doctor 1) in the panel');
  await opsPage.evaluate(() => { document.querySelector(`[data-testid^="assign-"]`); });
  await opsPage.click(`[data-testid="assign-${appApptId}"]`);
  await opsPage.waitForSelector('[data-testid="assign-doctor"]');
  await opsPage.select('[data-testid="assign-doctor"]', '1');
  await opsPage.waitForFunction(() => document.querySelector('[data-testid="assign-time"]')?.value !== '', { timeout: 15000 });
  check(true, 'the modal loads the doctor\'s free slots and keeps the customer\'s requested time');
  await opsPage.click('[data-testid="assign-submit"]');
  await waitText(opsPage, 'appointment confirmed');
  const assigned = (await api('GET', `/appointments/${appApptId}`, { token: appToken })).body.data;
  check(assigned.status === 'CONFIRMED' && assigned.doctor_id === 1 && !!assigned.doctor_name, 'the APP now shows the request as CONFIRMED with the doctor', `${assigned.status}/${assigned.doctor_id}`);
  await opsPage.waitForFunction((id) => !document.querySelector(`[data-testid="appt-${id}"]`), { timeout: 10000 }, appApptId);
  check(true, 'it leaves the "Needs doctor" queue');

  // ---------------------------------------------------------------------------------------------------------------
  step('6. DOCTOR (browser): sees only the appointment assigned to them, and completes it');
  const { page: docPage } = await newPage(browser, errors);
  await signInStaff(docPage, ...STAFF.doctor1);
  check(pathOf(docPage) === '/admin', 'a doctor signs in with email + password and lands on the doctor dashboard');
  await docPage.goto(`${WEB}/admin/appointments`, { waitUntil: 'networkidle0' });
  await waitText(docPage, 'E2E App User');
  const docText = await bodyText(docPage);
  check(docText.includes('E2E App User') && docText.includes('Pixel'), 'the assigned visit is listed');
  check(!docText.includes('E2E Guest'), 'the unassigned website request is NOT visible to the doctor');
  check(!docText.includes('Assign doctor') && !docText.includes('Book for a caller'), 'no assign or booking controls are offered to a doctor');
  const doctorSeesGuest = await api('GET', `/appointments/${guestApptId}`, { token: await staffToken(...STAFF.doctor1) });
  check(doctorSeesGuest.status === 404, 'the API also hides the unassigned request from the doctor (404)');
  const completed = await docPage.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('E2E App User'));
    const btn = row?.querySelector('button[title="Mark as Completed"]');
    if (btn) btn.click();
    return !!btn;
  });
  check(completed, 'clicked "Complete" on the assigned visit');
  await waitText(docPage, 'Appointment status changed to COMPLETED');
  const seenByApp = await api('GET', `/appointments/${appApptId}`, { token: appToken });
  check(seenByApp.body?.data?.status === 'COMPLETED', 'the app now reports COMPLETED', seenByApp.body?.data?.status);
  await docPage.goto(`${WEB}/admin/users`, { waitUntil: 'networkidle0' });
  check(pathOf(docPage) !== '/admin/users', 'a doctor cannot open the staff-management page', pathOf(docPage));

  // ---------------------------------------------------------------------------------------------------------------
  step('7. CALL-IN: the operational head registers a caller, who then signs in with just their mobile number');
  const callerMobile = mobile(4);
  await opsPage.goto(`${WEB}/admin/customers?new=1`, { waitUntil: 'networkidle0' });
  await opsPage.waitForSelector('[data-testid="customer-name"]');
  await opsPage.type('[data-testid="customer-name"]', 'E2E Caller');
  await opsPage.type('[data-testid="customer-mobile"]', `+91 ${callerMobile.slice(0, 5)} ${callerMobile.slice(5)}`);
  await opsPage.click('[data-testid="customer-submit"]');
  await waitText(opsPage, 'sign in with their mobile number');
  check(true, 'the panel registers the customer with just a name and a mobile number (no password field)');
  const callerLogin = await (async () => { await api('POST', '/auth/otp/send', { body: { mobile: callerMobile, purpose: 'login' } }); return api('POST', '/auth/otp/login', { body: { mobile: callerMobile, code: otpFor(callerMobile) } }); })();
  check(callerLogin.status === 200 && callerLogin.body.data.user.name === 'E2E Caller', 'the caller signs in directly with their mobile number and an OTP');
  const callerCustomerId = (await api('GET', `/customers?search=${callerMobile}`, { token: ops })).body.data[0]?.customer_id;
  const callerPet = await api('POST', '/pets', { token: ops, body: { name: 'Tiger', species: 'Cat', customer_id: callerCustomerId } });
  check(callerPet.status === 201, 'the operational head adds the caller\'s pet');
  await opsPage.goto(`${WEB}/admin/appointments`, { waitUntil: 'networkidle0' });
  await opsPage.click('[data-testid="schedule-btn"]');
  await opsPage.waitForSelector('[data-testid="book-customer"]');
  await opsPage.select('[data-testid="book-customer"]', String(callerCustomerId));
  await opsPage.select('[data-testid="book-pet"]', String(callerPet.body.data.id));
  await setDate(opsPage, nextMonday(4));
  await opsPage.waitForFunction(() => document.querySelectorAll('[data-testid="book-time"] option:not([disabled])').length > 1, { timeout: 15000 });
  const firstSlot = await opsPage.$eval('[data-testid="book-time"]', (sel) => [...sel.options].find((o) => o.value && !o.disabled).value);
  await opsPage.select('[data-testid="book-time"]', firstSlot);
  await opsPage.click('[data-testid="book-submit"]');
  await waitText(opsPage, 'Request added to the queue');
  const callerAppts = (await api('GET', '/appointments', { token: callerLogin.body.data.token })).body.data;
  check(callerAppts.length === 1 && callerAppts[0].status === 'PENDING' && callerAppts[0].source === 'STAFF', 'the caller sees the booking made for them, waiting for a doctor');

  // ---------------------------------------------------------------------------------------------------------------
  step('8. WEBSITE: the visitor from step 1 signs in with an OTP and sees their request');
  const { page: cust } = await newPage(browser, errors);
  await cust.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await cust.type('[data-testid="otp-mobile"]', guestMobile);
  await cust.click('[data-testid="otp-send"]');
  await cust.waitForSelector('[data-testid="otp-code"]');
  await cust.type('[data-testid="otp-code"]', '000000');
  await cust.click('[data-testid="otp-verify"]');
  await waitText(cust, 'incorrect or has expired');
  check(true, 'a wrong code is rejected with a clear message');
  await clearInput(cust, '[data-testid="otp-code"]');
  await cust.type('[data-testid="otp-code"]', otpFor(guestMobile));
  await Promise.all([cust.waitForFunction(() => location.pathname === '/dashboard', { timeout: 15000 }), cust.click('[data-testid="otp-verify"]')]);
  await waitText(cust, 'E2E Guest');
  check(pathOf(cust) === '/dashboard', 'the guest lands on the customer dashboard');
  await cust.evaluate(() => [...document.querySelectorAll('button')].find((b) => /appointments/i.test(b.innerText))?.click());
  await waitText(cust, 'AWAITING CONFIRMATION').catch(() => {});
  check((await bodyText(cust)).includes('AWAITING CONFIRMATION'), 'their request shows as "Awaiting confirmation" until a doctor is assigned');
  await cust.goto(`${WEB}/admin/appointments`, { waitUntil: 'networkidle0' });
  check(pathOf(cust) !== '/admin/appointments', 'a customer is turned away from the admin panel', cust.url());

  // ---------------------------------------------------------------------------------------------------------------
  step('9. WEBSITE: a new customer signs up with OTP, and can then use the MOBILE APP with the same number');
  const newMobile = mobile(3);
  const { page: reg } = await newPage(browser, errors);
  await reg.goto(`${WEB}/signup`, { waitUntil: 'networkidle0' });
  await reg.type('[data-testid="signup-name"]', 'E2E Web Signup');
  await reg.type('[data-testid="signup-mobile"]', `+91 ${newMobile.slice(0, 5)} ${newMobile.slice(5)}`);
  await reg.type('[data-testid="signup-email"]', `e2e.web.${Date.now()}@example.com`);
  await reg.click('[data-testid="signup-send"]');
  await reg.waitForSelector('[data-testid="otp-code"]');
  await reg.type('[data-testid="otp-code"]', otpFor(newMobile));
  await Promise.all([reg.waitForFunction(() => location.pathname === '/dashboard', { timeout: 15000 }), reg.click('[data-testid="otp-verify"]')]);
  check(pathOf(reg) === '/dashboard', 'sign-up on the website ends on the dashboard');
  await api('POST', '/auth/otp/send', { body: { mobile: newMobile, purpose: 'login' } });
  const appLogin = await api('POST', '/auth/otp/login', { body: { mobile: newMobile, code: otpFor(newMobile) } });
  check(appLogin.status === 200 && appLogin.body.data.user.name === 'E2E Web Signup', 'the same number signs in to the mobile app');
  check((await api('POST', '/auth/otp/send', { body: { mobile: newMobile, purpose: 'signup' } })).status === 409, 'signing up again with that number is refused');

  // ---------------------------------------------------------------------------------------------------------------
  step('10. STAFF SECURITY: wrong password, OTP cannot reach staff, temporary password must be changed, forgot password');
  const { page: sec } = await newPage(browser, errors);
  await sec.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await sec.click('[data-testid="tab-staff"]');
  await sec.type('[data-testid="staff-email"]', 'admin@cadovet.com');
  await sec.type('[data-testid="staff-password"]', 'definitely-wrong-1');
  await sec.click('[data-testid="staff-submit"]');
  await waitText(sec, 'Incorrect email or password');
  check(pathOf(sec) === '/login', 'a wrong password is refused with a clear message and no session');

  await sec.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await sec.type('[data-testid="otp-mobile"]', '9876543212'); // the operational head's own mobile number
  await sec.click('[data-testid="otp-send"]');
  await waitText(sec, 'No account found');
  check(true, 'the customer OTP sign-in refuses a staff member\'s mobile number (it is not a way into a staff account)');

  const adminTok = await staffToken(...STAFF.admin);
  const tempEmail = `e2e.doctor.${Date.now()}@cadovet.test`;
  const made = await api('POST', '/doctors', { token: adminTok, body: { name: 'Dr. Temp Password', email: tempEmail, password: 'Temp-pass1', specialization: 'General practice' } });
  check(made.status === 201, 'the admin adds a doctor with an email and a temporary password', JSON.stringify(made.body));
  const { page: newDoc } = await newPage(browser, errors);
  await signInStaff(newDoc, tempEmail, 'Temp-pass1');
  await waitText(newDoc, 'Choose a new password');
  check(true, 'first sign-in with the temporary password forces a new password before anything else');
  await newDoc.type('[data-testid="cp-current"]', 'Temp-pass1');
  await newDoc.type('[data-testid="cp-new"]', 'MyOwn-pass22');
  await newDoc.type('[data-testid="cp-confirm"]', 'MyOwn-pass22');
  await newDoc.click('[data-testid="cp-submit"]');
  await newDoc.waitForFunction(() => !document.body.innerText.includes('Choose a new password'), { timeout: 10000 });
  check((await api('POST', '/auth/login', { body: { identifier: tempEmail, password: 'Temp-pass1' } })).status === 401, 'the temporary password stops working');
  const changed = await api('POST', '/auth/login', { body: { identifier: tempEmail, password: 'MyOwn-pass22' } });
  check(changed.status === 200 && changed.body.data.user.must_change_password === false, 'the new password works and the "must change" flag is cleared');

  // voluntary change from the panel header, on a session that must also survive the change
  await newDoc.click('[data-testid="change-password-btn"]');
  await newDoc.waitForSelector('[data-testid="cp-current"]');
  await newDoc.type('[data-testid="cp-current"]', 'MyOwn-pass22');
  await newDoc.type('[data-testid="cp-new"]', 'Another-pass33');
  await newDoc.type('[data-testid="cp-confirm"]', 'Another-pass33');
  await newDoc.click('[data-testid="cp-submit"]');
  await waitText(newDoc, 'Password changed');
  check(pathOf(newDoc) === '/admin', 'changing the password from the header keeps this session signed in');
  check((await api('POST', '/auth/login', { body: { identifier: tempEmail, password: 'MyOwn-pass22' } })).status === 401, 'and the previous password is rejected');

  // forgot password: a code by email, then a new password
  await sec.goto(`${WEB}/login`, { waitUntil: 'networkidle0' });
  await sec.click('[data-testid="tab-staff"]');
  await sec.click('[data-testid="forgot-link"]');
  await sec.waitForSelector('[data-testid="fp-email"]');
  await sec.type('[data-testid="fp-email"]', tempEmail);
  await sec.click('[data-testid="fp-send"]');
  await sec.waitForSelector('[data-testid="fp-code"]');
  await sleep(500);
  const resetCode = resetCodes.get(tempEmail.toLowerCase());
  check(/^\d{6}$/.test(resetCode || ''), 'a 6-digit reset code is sent to the staff email');
  await sec.type('[data-testid="fp-code"]', resetCode);
  await sec.type('[data-testid="fp-new"]', 'Reset-pass44');
  await sec.type('[data-testid="fp-confirm"]', 'Reset-pass44');
  await sec.click('[data-testid="fp-reset"]');
  await sec.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });
  await waitText(sec, 'Password updated');
  check((await api('POST', '/auth/login', { body: { identifier: tempEmail, password: 'Reset-pass44' } })).status === 200, 'the reset password signs the doctor in');
  const oldSession = await api('GET', '/auth/me', { token: changed.body.data.token });
  check(oldSession.status === 401, 'every older session ended when the password was reset');

  step('11. Browser health');
  check(errors.length === 0, 'no uncaught page errors or unexpected console errors in any page', errors.slice(0, 3).join(' | '));
}

let exitCode = 0;
try { await main(); } catch (e) {
  console.error('\nE2E aborted:', e.message);
  results.push({ step: current, what: `aborted: ${e.message}`, ok: false });
  // Show what each browser tab was displaying, to make the failure diagnosable.
  for (const [i, pg] of pages.entries()) {
    try {
      const file = `/private/tmp/claude-501/e2e-fail-${i}.png`;
      await pg.screenshot({ path: file });
      console.log(`--- tab ${i}: ${pg.url()}  (screenshot ${file})\n${(await bodyText(pg)).replace(/\n+/g, ' | ').slice(0, 500)}`);
    } catch { /* tab already closed */ }
  }
}
finally {
  await browser?.close().catch(() => {});
  for (const p of children) p.kill('SIGTERM');
  spawnSync('sh', ['-c', `lsof -nP -iTCP:${API_PORT} -iTCP:${WEB_PORT} -sTCP:LISTEN -t | xargs -r kill`]);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(`  - [${f.step}] ${f.what}`)); exitCode = 1; }
  process.exit(exitCode);
}
