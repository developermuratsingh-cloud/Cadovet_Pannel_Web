const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { validateName } = require('../utils/validation');
const { issueOtp, verifyOtp } = require('../utils/otp');
const { canonicalMobile } = require('../utils/mobile');
const { findReferrerId } = require('./referralController');
const { signAccessToken, issueRefreshToken } = require('./authController');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const serverError = (res, label, err) => {
  console.error(`${label} error:`, err);
  res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
};

// Same response shape as POST /auth/login, so clients treat every sign-in alike.
const sessionFor = async (user, req) => {
  await db.query('INSERT INTO audit_logs (user_id, action, module, ip_address) VALUES ($1, $2, $3, $4)', [user.id, 'LOGIN', 'AUTH', req.ip]);
  return {
    token: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
    user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, identifier_type: user.identifier_type },
  };
};

// POST /api/auth/otp/send  { mobile, purpose: 'login' | 'signup', email? }
// login: the number must belong to an active account. signup: the number (and email, if given) must be unused.
exports.sendOtp = async (req, res) => {
  try {
    const mobile = canonicalMobile(req.body.mobile);
    const purpose = String(req.body.purpose || '').toLowerCase();
    if (!mobile) return fail(res, 400, 'Enter a valid mobile number');

    if (purpose === 'login') {
      // OTP is the customers' sign-in. Staff accounts sign in with email + password, so a staff mobile number is treated
      // exactly like an unknown one: no code is sent and OTP can never be used to get into a staff account.
      const found = await db.query('SELECT u.status, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.mobile = $1', [mobile]);
      if (!found.rows[0] || found.rows[0].role !== 'CUSTOMER' || (found.rows[0].status && found.rows[0].status !== 'ACTIVE')) {
        return fail(res, 404, 'No account found for this mobile number');
      }
    } else if (purpose === 'signup') {
      const email = req.body.email ? String(req.body.email).trim() : null;
      if (email && !EMAIL.test(email)) return fail(res, 400, 'Enter a valid email address');
      const exists = await db.query('SELECT 1 FROM users WHERE mobile = $1 OR ($2::text IS NOT NULL AND email = $2)', [mobile, email]);
      if (exists.rows.length) return fail(res, 409, 'User with this email or mobile already exists');
    } else {
      return fail(res, 400, 'Invalid purpose');
    }

    const issued = await issueOtp(purpose.toUpperCase(), mobile);
    if (issued.error) return fail(res, issued.error.status, issued.error.message);
    res.json({ success: true, message: 'A 6-digit code has been sent to your mobile number.' });
  } catch (err) {
    serverError(res, 'sendOtp', err);
  }
};

// POST /api/auth/otp/login  { mobile, code }
exports.loginWithOtp = async (req, res) => {
  try {
    const mobile = canonicalMobile(req.body.mobile);
    if (!mobile) return fail(res, 400, 'Enter a valid mobile number');

    const userRes = await db.query('SELECT u.id, u.name, u.email, u.mobile, u.identifier_type, u.role_id, u.department_id, u.status, u.token_version, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.mobile = $1', [mobile]);
    const user = userRes.rows[0];
    const checked = await verifyOtp('LOGIN', mobile, req.body.code);
    if (checked.error) return fail(res, checked.error.status, checked.error.message);
    // Same answer as a wrong code, so the endpoint cannot be used to probe accounts.
    if (!user || user.role !== 'CUSTOMER' || (user.status && user.status !== 'ACTIVE')) return fail(res, 400, 'Invalid or expired code');

    res.json({ success: true, message: 'Login successful', data: await sessionFor(user, req) });
  } catch (err) {
    serverError(res, 'loginWithOtp', err);
  }
};

// POST /api/auth/otp/signup  { name, mobile, email?, referral_code?, code }
// Creates the customer once the code for that number is proven, and signs them in. There is no password: the account
// gets a random unusable hash, so it can only be entered with an OTP.
exports.signupWithOtp = async (req, res) => {
  try {
    const { name, referral_code: referralCode } = req.body;
    const mobile = canonicalMobile(req.body.mobile);
    const email = req.body.email ? String(req.body.email).trim() : null;

    if (!name || !req.body.mobile) return fail(res, 400, 'Name and mobile number are required');
    if (!mobile) return fail(res, 400, 'Enter a valid mobile number');
    if (email && !EMAIL.test(email)) return fail(res, 400, 'Enter a valid email address');
    const nameError = validateName(name);
    if (nameError) return fail(res, 400, nameError);

    const referral = await findReferrerId(referralCode);
    if (referral.code && !referral.id) return fail(res, 400, 'Referral code not found');

    const exists = await db.query('SELECT 1 FROM users WHERE mobile = $1 OR ($2::text IS NOT NULL AND email = $2)', [mobile, email]);
    if (exists.rows.length) return fail(res, 409, 'User with this email or mobile already exists');

    const roleResult = await db.query("SELECT id FROM roles WHERE name = 'CUSTOMER'");
    if (!roleResult.rows.length) return fail(res, 500, 'Customer role not found in system');

    // Checked last so a failed validation above does not burn one of the five guesses.
    const checked = await verifyOtp('SIGNUP', mobile, req.body.code);
    if (checked.error) return fail(res, checked.error.status, checked.error.message);

    const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const inserted = await db.query(
      `INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, referred_by)
       VALUES ($1, $2, $3, $4, 'MOBILE', $5, $6)
       RETURNING id, name, email, mobile, identifier_type, role_id, department_id`,
      [String(name).trim(), email, mobile, unusableHash, roleResult.rows[0].id, referral.id]
    );
    const user = inserted.rows[0];
    await db.query('INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);

    res.status(201).json({ success: true, message: 'User registered successfully', data: await sessionFor(user, req) });
  } catch (err) {
    // Lost a race with another sign-up for the same number/email.
    if (err.code === '23505') return fail(res, 409, 'User with this email or mobile already exists');
    serverError(res, 'signupWithOtp', err);
  }
};

// POST /api/auth/me/otp   (signed in) Sends a code to the account's own mobile number, to confirm account deletion.
exports.sendDeleteOtp = async (req, res) => {
  try {
    const found = await db.query('SELECT u.mobile, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [req.user.id]);
    if (!found.rows[0] || found.rows[0].role !== 'CUSTOMER') return fail(res, 403, 'This account type cannot be deleted from the app');
    const mobile = found.rows[0].mobile;
    if (!mobile) return fail(res, 400, 'This account has no mobile number to send a code to');
    const issued = await issueOtp('DELETE', mobile);
    if (issued.error) return fail(res, issued.error.status, issued.error.message);
    res.json({ success: true, message: 'A 6-digit code has been sent to your mobile number.' });
  } catch (err) {
    serverError(res, 'sendDeleteOtp', err);
  }
};
