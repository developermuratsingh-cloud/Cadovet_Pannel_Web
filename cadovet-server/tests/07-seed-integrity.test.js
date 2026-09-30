// The README documents test accounts. This proves that a fresh install (schema + seeds + migrations) really contains
// them, that they work, and that the database has the protections the API relies on.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const { api } = h;
before(h.start);
after(h.stop);

const STAFF = [
  ['admin@cadovet.com', 'admin123', 'ADMIN', '9876543210'],
  ['doctor@cadovet.com', 'doctor123', 'DOCTOR', '9876543211'],
  ['meera@cadovet.com', 'doctor123', 'DOCTOR', '9876543215'],
  ['ops@cadovet.com', 'staff123', 'OPERATIONAL_HEAD', '9876543212'],
  ['operations.head@cadovet.com', 'OpsHead!2026#Cado', 'OPERATIONAL_HEAD', '9876543218'],
  // Seeded as SUBADMIN by migrate_phase5_6, then migrate_split_subadmin moves each to the role matching its
  // department (MEDICINE -> PHARMACY, INVENTORY -> INVENTORY) and deletes the SUBADMIN role entirely.
  ['inventory@cadovet.com', 'admin123', 'INVENTORY', '9876543216'],
  ['pharmacy@cadovet.com', 'admin123', 'PHARMACY', '9876543217'],
];
const CUSTOMERS = [['customer@cadovet.com', '9876543213'], ['sarah@cadovet.com', '9876543214']];

describe('Documented test accounts', () => {
  for (const [email, password, role, mobile] of STAFF) {
    it(`staff ${email} signs in with email + password and has role ${role}`, async () => {
      const r = await api.post('/api/auth/login', { identifier: email, password });
      assert.equal(r.status, 200, `${email}: ${JSON.stringify(r.body)}`);
      const me = await api.get('/api/auth/me', { token: r.body.data.token });
      assert.equal(me.body.data.role_name, role);
      assert.equal(me.body.data.must_change_password, false);
    });
    it(`staff ${email} cannot use the customer OTP sign-in, even with its own mobile number`, async () => {
      assert.equal((await api.post('/api/auth/otp/send', { mobile, purpose: 'login' })).status, 404);
      await h.db.query('DELETE FROM otp_codes WHERE mobile = $1', [mobile]);
      assert.equal((await api.post('/api/auth/otp/login', { mobile, code: '123456' })).status, 400);
    });
  }
  for (const [email, mobile] of CUSTOMERS) {
    it(`customer ${email} signs in with mobile ${mobile} + OTP, and cannot use a password`, async () => {
      const otp = await h.loginWithOtp(mobile);
      assert.equal(otp.status, 200, `${mobile}: ${JSON.stringify(otp.body)}`);
      assert.equal((await api.get('/api/auth/me', { token: otp.body.data.token })).body.data.role_name, 'CUSTOMER');
      assert.equal((await api.post('/api/auth/login', { identifier: email, password: 'customer123' })).status, 401);
    });
  }
  it('the seeded customers come with pets (the app and website have something to show)', async () => {
    const r = await h.loginWithOtp('9876543213');
    const pets = await api.get('/api/pets', { token: r.body.data.token });
    assert.ok(pets.body.data.length >= 1);
  });
});

describe('Database protections the API relies on', () => {
  const has = async (sql, params = []) => (await h.db.query(sql, params)).rowCount > 0;
  it('has the unique index that prevents double-booking a doctor slot', async () => {
    assert.ok(await has("SELECT 1 FROM pg_indexes WHERE indexname = 'uq_appointments_active_slot'"));
  });
  it('only allows known appointment statuses', async () => {
    await assert.rejects(h.db.query("UPDATE appointments SET status = 'HACKED' WHERE id = (SELECT id FROM appointments LIMIT 1)"), /appointments_status_check/);
  });
  it('the slot index rejects a second active booking even when the application check is bypassed', async () => {
    const c = await h.signupCustomer(); const pet = await h.createPet(c.token);
    const cid = (await h.db.query('SELECT id FROM customers WHERE user_id = $1', [c.userId])).rows[0].id;
    const date = h.futureDate(120, 1);
    const ins = (t) => h.db.query("INSERT INTO appointments (customer_id, pet_id, doctor_id, appointment_date, appointment_time, status) VALUES ($1,$2,1,$3,$4,'CONFIRMED')", [cid, pet.id, date, t]);
    await ins('09:00 AM');
    await assert.rejects(ins('09:00 am'), /uq_appointments_active_slot/);
    await ins('09:30 AM'); // a different slot is fine
    // doorstep windows from the website are not clock slots and may repeat
    await ins('10:00 AM to 12:00 PM');
    await ins('10:00 AM to 12:00 PM');
  });
  it('emails and mobile numbers are unique', async () => {
    await assert.rejects(h.db.query("INSERT INTO users (name, mobile, password_hash, identifier_type, role_id) VALUES ('Dup', '9876543213', 'x', 'MOBILE', 3)"), /unique|duplicate/i);
  });
});
