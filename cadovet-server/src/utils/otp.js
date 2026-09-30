const crypto = require('crypto');
const db = require('../database');
const { sendMobileCode, smsConfigured } = require('./notify');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

// Same rule as authController.getIdentifierType: optional plus, 7-15 digits.
const MOBILE = /^\+?[0-9]{7,15}$/;
const isMobile = (v) => MOBILE.test(String(v || '').trim());

// Local testing only: OTP_TEST_CODE (6 digits) replaces the random code for the numbers listed in OTP_TEST_MOBILES, so
// testers need not read the server console. It is ignored in production and whenever a real SMS provider is configured,
// and it never applies to a number that is not on the list.
const testCodeFor = (mobile) => {
  const code = process.env.OTP_TEST_CODE;
  if (!code || process.env.NODE_ENV === 'production' || smsConfigured()) return null;
  const allowed = String(process.env.OTP_TEST_MOBILES || '').split(',').map((m) => m.trim()).filter(Boolean);
  return /^\d{6}$/.test(code) && allowed.includes(mobile) ? code : null;
};
if (process.env.OTP_TEST_CODE && (process.env.NODE_ENV === 'production' || smsConfigured())) {
  console.warn('[otp] OTP_TEST_CODE is set but ignored (production or a real SMS provider is configured).');
}

const hashCode = (purpose, mobile, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret').update(`${purpose}:${mobile}:${code}`).digest('hex');

// Creates a fresh code (invalidating earlier ones) and delivers it by SMS. Returns { error } when the caller has asked
// for too many codes; delivery problems are logged, never surfaced, so a provider outage cannot be probed from outside.
exports.issueOtp = async (purpose, mobile) => {
  const recent = await db.query(
    "SELECT COUNT(*)::int AS n FROM otp_codes WHERE mobile = $1 AND purpose = $2 AND created_at > NOW() - INTERVAL '1 hour'",
    [mobile, purpose]
  );
  if (recent.rows[0].n >= MAX_REQUESTS_PER_HOUR) {
    return { error: { status: 429, message: 'Too many codes requested. Please try again in an hour.' } };
  }
  const code = testCodeFor(mobile) || String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await db.query('UPDATE otp_codes SET used_at = NOW() WHERE mobile = $1 AND purpose = $2 AND used_at IS NULL', [mobile, purpose]);
  await db.query(
    "INSERT INTO otp_codes (purpose, mobile, code_hash, expires_at) VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)",
    [purpose, mobile, hashCode(purpose, mobile, code), String(CODE_TTL_MINUTES)]
  );
  sendMobileCode(mobile, code, CODE_TTL_MINUTES).catch((err) =>
    console.error(`[otp] SMS delivery to ${mobile} failed: ${err.message}`)
  );
  return { ok: true };
};

// Checks the latest unused code and consumes it on success. Wrong guesses are counted; after MAX_ATTEMPTS the code is dead.
exports.verifyOtp = async (purpose, mobile, code) => {
  const bad = (status, message) => ({ error: { status, message } });
  if (!/^\d{6}$/.test(String(code || ''))) return bad(400, 'Enter the 6-digit code');

  const found = await db.query(
    'SELECT id, code_hash, attempts FROM otp_codes WHERE mobile = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
    [mobile, purpose]
  );
  const row = found.rows[0];
  if (!row) return bad(400, 'Invalid or expired code');
  if (row.attempts >= MAX_ATTEMPTS) return bad(429, 'Too many attempts. Please request a new code.');

  const expected = Buffer.from(row.code_hash, 'hex');
  const given = Buffer.from(hashCode(purpose, mobile, code), 'hex');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return bad(400, 'Invalid or expired code');
  }
  // Single use: the UPDATE only matches while unused, so two concurrent verifications cannot both succeed.
  const used = await db.query('UPDATE otp_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL', [row.id]);
  return used.rowCount === 1 ? { ok: true } : bad(400, 'Invalid or expired code');
};

exports.isMobile = isMobile;
