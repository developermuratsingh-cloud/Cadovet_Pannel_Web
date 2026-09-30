process.env.PUBLIC_BOOKING_RATE_LIMIT = '1000'; // the throttle itself is tested in 06-hardening
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const h = require('./helpers');

const { api } = h;
let admin;
const payload = (over = {}) => ({
  owner_name: 'Web Guest', phone: h.uniqueMobile(), pet_name: 'Simba', species: 'Dog', service_id: 1,
  appointment_date: h.futureDate(5), appointment_time: '10:00 AM to 12:00 PM', address: '12 MG Road, Bengaluru', ...over,
});

before(async () => { await h.start(); admin = await h.loginStaff('admin@cadovet.com'); });
after(h.stop);

describe('Website booking (no login)', () => {
  it('creates the customer, pet, appointment and invoice, and returns a reference', async () => {
    const body = payload({ total_amount: 599 });
    const r = await api.post('/api/appointments/public', body);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(r.body.data.appointment_id);
    assert.match(r.body.data.invoice_number, /^INV-/);
    const row = (await h.db.query(`SELECT u.name, u.mobile, u.role_id, r.name AS role, c.address, p.name AS pet, a.status, i.total_amount
       FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN users u ON u.id = c.user_id JOIN roles r ON r.id = u.role_id
       JOIN pets p ON p.id = a.pet_id LEFT JOIN invoices i ON i.appointment_id = a.id WHERE a.id = $1`, [r.body.data.appointment_id])).rows[0];
    assert.equal(row.role, 'CUSTOMER');
    assert.equal(row.mobile, body.phone);
    assert.equal(row.pet, 'Simba');
    assert.equal(row.address, '12 MG Road, Bengaluru');
    assert.equal(Number(row.total_amount), 599);
  });
  it('requires an owner name and a valid phone number', async () => {
    assert.equal((await api.post('/api/appointments/public', payload({ owner_name: '' }))).status, 400);
    assert.equal((await api.post('/api/appointments/public', payload({ phone: '' }))).status, 400);
    assert.equal((await api.post('/api/appointments/public', payload({ phone: undefined }))).status, 400);
    for (const phone of ['abc', '12345', '0000000000', '<script>', 123, {}, ['9876543210']]) {
      const r = await api.post('/api/appointments/public', payload({ phone }));
      assert.equal(r.status, 400, `phone=${JSON.stringify(phone)} -> ${r.status}`);
    }
  });
  it('garbage phone numbers never collapse into one shared account', async () => {
    const before = (await h.db.query("SELECT COUNT(*)::int AS n FROM users WHERE mobile = '9999999999'")).rows[0].n;
    await api.post('/api/appointments/public', payload({ phone: 'no digits at all' }));
    await api.post('/api/appointments/public', payload({ phone: '---' }));
    const after = (await h.db.query("SELECT COUNT(*)::int AS n FROM users WHERE mobile = '9999999999'")).rows[0].n;
    assert.equal(after, before);
  });
  it('accepts formatted numbers and stores the canonical form', async () => {
    const m = h.uniqueMobile();
    const r = await api.post('/api/appointments/public', payload({ phone: `+91 ${m.slice(0, 5)}-${m.slice(5)}` }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const u = await h.db.query('SELECT mobile FROM users WHERE mobile = $1', [m]);
    assert.equal(u.rowCount, 1);
  });
  it('the same phone twice reuses one customer (and one pet of the same name)', async () => {
    const phone = h.uniqueMobile();
    await api.post('/api/appointments/public', payload({ phone, pet_name: 'Tommy' }));
    await api.post('/api/appointments/public', payload({ phone, pet_name: 'tommy' }));
    const users = await h.db.query('SELECT id FROM users WHERE mobile = $1', [phone]);
    assert.equal(users.rowCount, 1);
    const pets = await h.db.query('SELECT p.id FROM pets p JOIN customers c ON c.id = p.customer_id WHERE c.user_id = $1', [users.rows[0].id]);
    assert.equal(pets.rowCount, 1);
  });
  it('guest accounts have an unusable password: no default credential exists', async () => {
    const phone = h.uniqueMobile();
    await api.post('/api/appointments/public', payload({ phone }));
    for (const password of ['admin123', 'password', 'customer123', phone, 'guest']) {
      assert.equal((await api.post('/api/auth/login', { identifier: `${phone}@guest.cadovet.com`, password })).status, 401, password);
      assert.equal((await api.post('/api/auth/login', { identifier: phone, password })).status, 400, 'mobile is not a login identifier');
    }
    // and no two guest accounts share a hash
    const a = h.uniqueMobile(); const b = h.uniqueMobile();
    await api.post('/api/appointments/public', payload({ phone: a }));
    await api.post('/api/appointments/public', payload({ phone: b }));
    const hashes = (await h.db.query('SELECT password_hash FROM users WHERE mobile = ANY($1)', [[a, b]])).rows.map((r) => r.password_hash);
    assert.notEqual(hashes[0], hashes[1]);
  });
  it('never attaches a public booking to a staff account', async () => {
    const adminMobile = (await h.db.query("SELECT mobile FROM users WHERE email = 'admin@cadovet.com'")).rows[0].mobile;
    const petsBefore = (await h.db.query("SELECT COUNT(*)::int AS n FROM pets p JOIN customers c ON c.id = p.customer_id JOIN users u ON u.id = c.user_id WHERE u.email = 'admin@cadovet.com'")).rows[0].n;
    const r = await api.post('/api/appointments/public', payload({ phone: adminMobile }));
    assert.ok([400, 403, 409].includes(r.status), `expected refusal, got ${r.status}`);
    const petsAfter = (await h.db.query("SELECT COUNT(*)::int AS n FROM pets p JOIN customers c ON c.id = p.customer_id JOIN users u ON u.id = c.user_id WHERE u.email = 'admin@cadovet.com'")).rows[0].n;
    assert.equal(petsAfter, petsBefore);
  });
  it('does not overwrite an existing customer\'s saved address', async () => {
    const c = await h.signupCustomer();
    await api.patch('/api/auth/me', { address: 'Original Address 1' }, { token: c.token });
    await api.post('/api/appointments/public', payload({ phone: c.mobile, address: 'Attacker Street 99' }));
    const me = await api.get('/api/auth/me', { token: c.token });
    assert.equal(me.body.data.address, 'Original Address 1');
  });
  it('validates amounts, lengths and cart shape', async () => {
    for (const total_amount of [-5, 'abc', 1e12, 'NaN', 'Infinity', '-1', true, {}]) {
      const r = await api.post('/api/appointments/public', payload({ total_amount }));
      assert.equal(r.status, 400, `total_amount=${total_amount} -> ${r.status}`);
    }
    assert.equal((await api.post('/api/appointments/public', payload({ owner_name: 'x'.repeat(500) }))).status, 400);
    assert.equal((await api.post('/api/appointments/public', payload({ notes: 'x'.repeat(5000) }))).status, 400);
    assert.equal((await api.post('/api/appointments/public', payload({ cart_items: 'not-an-array' }))).status, 400);
    assert.equal((await api.post('/api/appointments/public', payload({ cart_items: Array.from({ length: 200 }, () => ({ title: 't', price: 1 })) }))).status, 400);
  });
  it('rejects a past appointment date', async () => {
    assert.equal((await api.post('/api/appointments/public', payload({ appointment_date: '2020-01-01' }))).status, 400);
  });
  it('an unknown service falls back safely instead of failing with a 500', async () => {
    const r = await api.post('/api/appointments/public', payload({ service_id: 999999 }));
    assert.ok(r.status < 500, `status ${r.status}`);
  });
  it('20 simultaneous bookings all succeed with unique invoice numbers', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => api.post('/api/appointments/public', payload({ total_amount: 100 }))));
    assert.equal(results.filter((r) => r.status === 201).length, 20, results.map((r) => r.status).join(','));
    const numbers = results.map((r) => r.body.data.invoice_number);
    assert.equal(new Set(numbers).size, 20);
  });
  it('is not confused by SQL / HTML in text fields', async () => {
    const r = await api.post('/api/appointments/public', payload({ owner_name: "Robert'); DROP TABLE users;--", pet_name: '<img src=x onerror=alert(1)>', address: "'; DELETE FROM pets;--" }));
    assert.ok(r.status === 201 || r.status === 400, `status ${r.status}`);
    assert.ok((await h.db.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n > 5);
  });
});

describe('Website booking is visible to the admin portal', () => {
  it('appears in the admin appointment, customer and invoice lists with the right names', async () => {
    const body = payload({ owner_name: 'Portal Visible', pet_name: 'Zorro', total_amount: 750 });
    const r = await api.post('/api/appointments/public', body);
    const id = r.body.data.appointment_id;
    const appt = await api.get(`/api/appointments/${id}`, { token: admin });
    assert.equal(appt.status, 200);
    assert.equal(appt.body.data.customer_name, 'Portal Visible');
    assert.equal(appt.body.data.pet_name, 'Zorro');
    assert.equal(appt.body.data.customer_mobile, body.phone);
    const customers = await api.get(`/api/customers?search=${body.phone}`, { token: admin });
    assert.ok(customers.body.data.some((c) => c.mobile === body.phone));
    const invoices = await api.get(`/api/invoices?search=${r.body.data.invoice_number}`, { token: admin });
    assert.ok(invoices.body.data.some((i) => i.invoice_number === r.body.data.invoice_number));
  });
});
