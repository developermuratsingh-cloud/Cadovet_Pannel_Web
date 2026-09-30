const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { sendResetCode } = require('../utils/notify');
const { validatePassword } = require('../utils/validation');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 3;
const GENERIC_MESSAGE = 'If an account exists for this email or mobile number, a verification code has been sent.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^\+?[0-9]{7,15}$/;

const hashCode = (userId, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret').update(`${userId}:${code}`).digest('hex');

const { normalizeIdentifier } = require('../utils/mobile');

const findUser = async (identifier) => {
  const id = String(normalizeIdentifier(String(identifier || ''))).trim();
  const column = EMAIL.test(id) ? 'email' : MOBILE.test(id) ? 'mobile' : null;
  if (!column) return { invalid: true };
  const res = await db.query(`SELECT u.id, u.name, u.email, u.mobile, u.status, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.${column} = $1`, [id]);
  // The channel the user typed decides where the code is sent: an email address -> email, a mobile number -> SMS.
  return { user: res.rows[0] || null, channel: column };
};

// POST /api/auth/forgot-password  { identifier }
// Always answers the same way so the endpoint cannot be used to discover which accounts exist.
exports.forgotPassword = async (req, res) => {
  try {
    const { user, channel, invalid } = await findUser(req.body.identifier);
    if (invalid) return res.status(400).json({ success: false, message: 'Enter a valid email address or mobile number' });

    let devCode;
    // Only staff have passwords to reset. A customer (or unknown address) gets the same reply and no code.
    if (user && user.status === 'ACTIVE' && user.role !== 'CUSTOMER') {
      const recent = await db.query(
        "SELECT COUNT(*)::int AS n FROM password_resets WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
        [user.id]
      );
      if (recent.rows[0].n < MAX_REQUESTS_PER_HOUR) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await db.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
        await db.query(
          "INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)",
          [user.id, hashCode(user.id, code), String(CODE_TTL_MINUTES)]
        );
        // Not awaited: provider latency must not differ between existing and unknown accounts (that would reveal which
        // accounts exist), and a provider outage must not turn into an error the caller can observe.
        sendResetCode(user, code, CODE_TTL_MINUTES, channel).catch((err) =>
          console.error(`[password-reset] delivery via ${channel} failed for user ${user.id}: ${err.message}`)
        );
        if (process.env.RESET_CODE_IN_RESPONSE === 'true') devCode = code; // local testing only; never enable in production
      }
    }

    res.json({ success: true, message: GENERIC_MESSAGE, ...(devCode ? { dev_code: devCode } : {}) });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/auth/reset-password  { identifier, code, password }
exports.resetPassword = async (req, res) => {
  const bad = (status, message) => res.status(status).json({ success: false, message });
  try {
    const { identifier, code, password } = req.body;
    if (!/^\d{6}$/.test(String(code || ''))) return bad(400, 'Enter the 6-digit code');
    const passwordError = validatePassword(password);
    if (passwordError) return bad(400, passwordError);

    const { user, invalid } = await findUser(identifier);
    if (invalid || !user || user.status !== 'ACTIVE' || user.role === 'CUSTOMER') return bad(400, 'Invalid or expired code');

    const reset = await db.query(
      'SELECT id, code_hash, attempts FROM password_resets WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    const row = reset.rows[0];
    if (!row) return bad(400, 'Invalid or expired code');
    if (row.attempts >= MAX_ATTEMPTS) return bad(429, 'Too many attempts. Please request a new code.');

    const expected = Buffer.from(row.code_hash, 'hex');
    const given = Buffer.from(hashCode(user.id, code), 'hex');
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      await db.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      return bad(400, 'Invalid or expired code');
    }

    const hash = await bcrypt.hash(password, 10);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET password_hash = $1, must_change_password = FALSE, password_changed_at = NOW(), token_version = token_version + 1, updated_at = NOW() WHERE id = $2', [hash, user.id]);
      await client.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
      // A reset signs the account out everywhere.
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
      await client.query('INSERT INTO audit_logs (user_id, action, module, ip_address) VALUES ($1,$2,$3,$4)', [user.id, 'PASSWORD_RESET', 'AUTH', req.ip]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Your password has been updated. Please sign in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
