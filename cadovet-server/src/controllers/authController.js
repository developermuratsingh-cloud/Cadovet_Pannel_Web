const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { validatePassword } = require('../utils/validation');
const { findReferrerId } = require('./referralController');
const { removeStoredFile } = require('./documentController');
const { verifyOtp } = require('../utils/otp');
const { normalizeIdentifier } = require('../utils/mobile');
const { failureTracker } = require('../utils/rateLimit');

// Brute-force protection for password sign-in (staff / website): 10 wrong passwords lock that account for 15 minutes.
const loginFailures = failureTracker({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_MAX_FAILURES || '10', 10),
});

const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

const signAccessToken = (user) =>
    jwt.sign(
        { id: user.id, role_id: user.role_id, department_id: user.department_id, tv: user.token_version || 0 },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

exports.signAccessToken = signAccessToken;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Opaque random refresh token; only its hash is persisted.
const issueRefreshToken = async (userId) => {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, hashToken(token), expiresAt]
    );
    return token;
};
exports.issueRefreshToken = issueRefreshToken;

// Helper to determine identifier type
const getIdentifierType = (identifier) => {
    // Simple regex for email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Simple regex for mobile (digits, optional plus, length 7-15)
    const mobileRegex = /^\+?[0-9]{7,15}$/;

    if (emailRegex.test(identifier)) return 'EMAIL';
    if (mobileRegex.test(identifier)) return 'MOBILE';
    return null;
};

// Staff sign-in (admin, operational head, doctors, desk staff): email + password. Customers do NOT use this: they have no
// password and sign in with a mobile number + OTP, so a customer account can never be entered here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A hash of a random string, compared against when the account does not exist, so "unknown email" and "wrong password"
// take the same time and cannot be told apart.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

exports.login = async (req, res) => {
    try {
        const { identifier: rawIdentifier, password } = req.body;
        if (!rawIdentifier || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        if (typeof rawIdentifier !== 'string' || typeof password !== 'string' || rawIdentifier.length > 255 || password.length > 200) {
            return res.status(400).json({ success: false, message: 'Invalid credentials format' });
        }
        const email = rawIdentifier.trim();
        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, message: 'Enter your email address' });
        }

        // Brute-force protection: 10 wrong passwords lock the account for 15 minutes.
        const throttleKey = email.toLowerCase();
        const wait = loginFailures.retryAfter(throttleKey);
        if (wait) {
            res.set('Retry-After', String(wait));
            return res.status(429).json({ success: false, message: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` });
        }

        const found = await db.query(
            'SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE LOWER(u.email) = LOWER($1)', [email]
        );
        const user = found.rows[0];
        const isMatch = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
        const allowed = user && isMatch && user.role_name !== 'CUSTOMER' && (!user.status || user.status === 'ACTIVE');
        if (!allowed) {
            loginFailures.fail(throttleKey);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        loginFailures.clear(throttleKey);

        const token = signAccessToken(user);
        const refreshToken = await issueRefreshToken(user.id);
        await db.query(
            'INSERT INTO audit_logs (user_id, action, module, ip_address) VALUES ($1, $2, $3, $4)',
            [user.id, 'LOGIN', 'AUTH', req.ip]
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    identifier_type: user.identifier_type,
                    role: user.role_name,
                    must_change_password: user.must_change_password
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    }
};

// POST /api/auth/change-password  { current_password, new_password }   (signed in, staff)
// Verifies the current password, applies the password policy, then signs the account out everywhere (older tokens and all
// refresh tokens stop working) and returns a fresh session so the user stays signed in on this device.
exports.changePassword = async (req, res) => {
    try {
        const { current_password: current, new_password: next } = req.body || {};
        if (typeof current !== 'string' || typeof next !== 'string' || !current || !next) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }
        const found = await db.query('SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [req.user.id]);
        const user = found.rows[0];
        if (!user || user.role_name === 'CUSTOMER') {
            return res.status(403).json({ success: false, message: 'This account has no password' });
        }

        const key = `pw:${user.id}`;
        const wait = loginFailures.retryAfter(key);
        if (wait) {
            res.set('Retry-After', String(wait));
            return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
        }
        if (!(await bcrypt.compare(current, user.password_hash))) {
            loginFailures.fail(key);
            // 403, not 401: the client must not mistake a wrong password for an expired session.
            return res.status(403).json({ success: false, message: 'Current password is incorrect' });
        }
        loginFailures.clear(key);

        const problem = validatePassword(next);
        if (problem) return res.status(400).json({ success: false, message: problem });
        if (next === current) return res.status(400).json({ success: false, message: 'Choose a password different from the current one' });

        const hash = await bcrypt.hash(next, 10);
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const bumped = await client.query('UPDATE users SET password_hash = $1, must_change_password = FALSE, password_changed_at = NOW(), token_version = token_version + 1, updated_at = NOW() WHERE id = $2 RETURNING token_version', [hash, user.id]);
            user.token_version = bumped.rows[0].token_version;
            await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
            await client.query('INSERT INTO audit_logs (user_id, action, module, ip_address) VALUES ($1,$2,$3,$4)', [user.id, 'PASSWORD_CHANGED', 'AUTH', req.ip]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            message: 'Password changed',
            data: { token: signAccessToken(user), refreshToken: await issueRefreshToken(user.id) }
        });
    } catch (err) {
        console.error('changePassword error:', err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    }
};

exports.me = async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const userResult = await db.query(`
            SELECT u.id, u.name, u.email, u.mobile, u.identifier_type, u.status, u.must_change_password,
                   r.name as role_name, d.name as department_name,
                   c.address, c.city, c.state, c.pincode,
                   u.active_location_id, al.name AS active_location_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN customers c ON c.user_id = u.id
            LEFT JOIN locations al ON al.id = u.active_location_id
            WHERE u.id = $1
        `, [req.user.id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = userResult.rows[0];

        // Fetch permissions for this role
        const permissionsResult = await db.query(`
            SELECT p.name
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = (SELECT role_id FROM users WHERE id = $1)
        `, [user.id]);

        const permissions = permissionsResult.rows.map(row => row.name);

        // Every branch this staff member is rostered at — the header switcher only renders when there's more
        // than one; empty for a customer or an ADMIN (never branch-locked).
        const locationsResult = await db.query(
            `SELECT l.id, l.name FROM user_locations ul JOIN locations l ON l.id = ul.location_id WHERE ul.user_id = $1 ORDER BY l.name`,
            [user.id]
        );

        res.json({
            success: true,
            data: {
                ...user,
                permissions,
                locations: locationsResult.rows,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    }
};

// POST /api/auth/refresh  { refreshToken }
// Rotates the refresh token: the presented token is revoked and a new pair is issued.
exports.refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token is required' });
        }

        const tokenRes = await db.query(
            `SELECT id, user_id FROM refresh_tokens
             WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
            [hashToken(refreshToken)]
        );
        if (tokenRes.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
        }

        const userRes = await db.query(
            'SELECT id, role_id, department_id, status, token_version FROM users WHERE id = $1',
            [tokenRes.rows[0].user_id]
        );
        const user = userRes.rows[0];
        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, message: 'User account is not active.' });
        }

        await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [tokenRes.rows[0].id]);

        res.json({
            success: true,
            data: {
                token: signAccessToken(user),
                refreshToken: await issueRefreshToken(user.id)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    }
};

// POST /api/auth/logout  { refreshToken? }
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (refreshToken) {
            await db.query(
                'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
                [hashToken(refreshToken)]
            );
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    }
};

// PATCH /api/auth/me  { name?, address?, city?, state?, pincode? }
// Self-service profile update for the authenticated user.
exports.updateMe = async (req, res) => {
    try {
        const { name, address, city, state, pincode } = req.body;

        if (name !== undefined && !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Name cannot be empty' });
        }

        if (name !== undefined) {
            await db.query('UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2', [String(name).trim(), req.user.id]);
        }

        const hasAddress = [address, city, state, pincode].some((v) => v !== undefined);
        if (hasAddress) {
            await db.query(
                `INSERT INTO customers (user_id, address, city, state, pincode)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id) DO UPDATE SET
                    address = COALESCE($2, customers.address),
                    city = COALESCE($3, customers.city),
                    state = COALESCE($4, customers.state),
                    pincode = COALESCE($5, customers.pincode),
                    updated_at = NOW()`,
                [req.user.id, address ?? null, city ?? null, state ?? null, pincode ?? null]
            );
        }

        return exports.me(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    }
};

// DELETE /api/auth/me  { password } or { code }  (code: the DELETE one-time passcode sent by POST /api/auth/me/otp)
// Deletes the signed-in customer's account by anonymising it. Rows are kept (not removed) because invoices and medical
// records are tied to it and must survive for legal/financial reasons, but they no longer identify the person:
// name/email/mobile/address are erased, the account is deactivated, sessions are revoked and upcoming
// appointments are cancelled. Everything happens in one transaction.
exports.deleteMe = async (req, res) => {
    const { password, code } = req.body || {};
    if (!password && !code) {
        return res.status(400).json({ success: false, message: 'A verification code or password is required to delete your account' });
    }

    const client = await db.pool.connect();
    let storedFiles = [];
    try {
        const userRes = await client.query(
            `SELECT u.id, u.mobile, u.password_hash, r.name AS role_name
             FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
            [req.user.id]
        );
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Staff accounts are managed by an administrator, never self-deleted from the customer app.
        if (user.role_name !== 'CUSTOMER') {
            return res.status(403).json({ success: false, message: 'This account type cannot be deleted from the app' });
        }
        // 403 (not 401) so the client does not mistake it for an expired session.
        if (code) {
            const checked = user.mobile ? await verifyOtp('DELETE', user.mobile, code) : { error: { status: 403, message: 'Verification code is incorrect or expired' } };
            if (checked.error) {
                return res.status(checked.error.status === 400 ? 403 : checked.error.status).json({ success: false, message: 'Verification code is incorrect or expired' });
            }
        } else if (!(await bcrypt.compare(password, user.password_hash))) {
            return res.status(403).json({ success: false, message: 'Password is incorrect' });
        }

        const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

        await client.query('BEGIN');
        const cust = await client.query('SELECT id FROM customers WHERE user_id = $1', [user.id]);
        if (cust.rows.length) {
            const customerId = cust.rows[0].id;
            await client.query(
                "UPDATE appointments SET status = 'CANCELLED', updated_at = NOW() WHERE customer_id = $1 AND status IN ('PENDING','CONFIRMED')",
                [customerId]
            );
            await client.query("UPDATE pets SET status = 'INACTIVE' WHERE customer_id = $1", [customerId]);
            // Uploaded health documents are personal data: remove the rows now and the files once the commit succeeds.
            const docs = await client.query('DELETE FROM documents WHERE customer_id = $1 RETURNING stored_name', [customerId]);
            storedFiles = docs.rows.map((d) => d.stored_name);
            await client.query(
                'UPDATE customers SET address = NULL, city = NULL, state = NULL, pincode = NULL, profile_image = NULL, notes = NULL, updated_at = NOW() WHERE id = $1',
                [customerId]
            );
        }
        await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
        await client.query(
            `UPDATE users SET name = 'Deleted User', email = $2, mobile = NULL, identifier_type = 'EMAIL',
                    password_hash = $3, status = 'INACTIVE', referral_code = NULL, referred_by = NULL, updated_at = NOW()
             WHERE id = $1`,
            [user.id, `deleted-${user.id}@deleted.invalid`, randomHash]
        );
        await client.query(
            'INSERT INTO audit_logs (user_id, action, module, record_id, ip_address) VALUES ($1,$2,$3,$4,$5)',
            [user.id, 'ACCOUNT_DELETED', 'AUTH', user.id, req.ip]
        );
        await client.query('COMMIT');
        await Promise.all(storedFiles.map(removeStoredFile));

        res.json({ success: true, message: 'Your account has been deleted' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('deleteMe error:', err);
        res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
    } finally {
        client.release();
    }
};
