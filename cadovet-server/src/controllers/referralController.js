const crypto = require('crypto');
const db = require('../database');

// No look-alike characters (0/O, 1/I) so codes are easy to read out and type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');

const ensureReferralCode = async (userId) => {
  const existing = await db.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
  if (existing.rows[0]?.referral_code) return existing.rows[0].referral_code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const updated = await db.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE referral_code = $1) RETURNING referral_code',
      [code, userId]
    );
    if (updated.rows.length) return code;
    const again = await db.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    if (again.rows[0]?.referral_code) return again.rows[0].referral_code;
  }
  throw new Error('Could not generate a referral code');
};

// GET /api/referrals/me
exports.getMyReferral = async (req, res) => {
  try {
    const code = await ensureReferralCode(req.user.id);
    const joined = await db.query("SELECT COUNT(*)::int AS n FROM users WHERE referred_by = $1 AND status = 'ACTIVE'", [req.user.id]);
    const welcome = await db.query(
      `SELECT code, title, discount_type, discount_value FROM coupons
       WHERE code = 'WELCOME10' AND is_active = TRUE AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`
    );
    res.json({ success: true, data: { code, friends_joined: joined.rows[0].n, friend_coupon: welcome.rows[0] || null } });
  } catch (err) {
    console.error('getMyReferral error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// Used by signup: resolves a referral code to the referrer's user id (or null).
exports.findReferrerId = async (rawCode) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { code: null, id: null };
  const res = await db.query("SELECT id FROM users WHERE referral_code = $1 AND status = 'ACTIVE'", [code]);
  return { code, id: res.rows[0]?.id ?? null };
};
