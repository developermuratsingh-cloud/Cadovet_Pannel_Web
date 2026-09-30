const jwt = require('jsonwebtoken');
const db = require('../database');

exports.authenticateUser = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        // Fetch user basic info
        const userResult = await db.query('SELECT id, role_id, department_id, status, token_version FROM users WHERE id = $1', [decoded.id]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'The user belonging to this token no longer exists.' });
        }

        const user = userResult.rows[0];

        if (user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, message: 'User account is not active.' });
        }
        // A password change or reset bumps token_version, which invalidates every token issued before it.
        if ((decoded.tv ?? 0) !== user.token_version) {
            return res.status(401).json({ success: false, message: 'Your password was changed. Please sign in again.' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

exports.authorizePermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.role_id) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }

            const permResult = await db.query(`
                SELECT p.name 
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = $1 AND p.name = $2
            `, [req.user.role_id, permission]);

            if (permResult.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Forbidden: Missing required permission' });
            }

            next();
        } catch (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Server error during authorization' });
        }
    };
};

// Staff-only (any non-CUSTOMER role). Used for read endpoints that expose the permission model.
exports.staffOnly = async (req, res, next) => {
    try {
        const r = await db.query('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [req.user.id]);
        if (!r.rows[0] || r.rows[0].name === 'CUSTOMER') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
};

// Blocks the listed roles outright, regardless of what permissions they hold. Used where a role must never reach a
// feature (e.g. DOCTOR must never browse the staff/customer directories), so a later permission grant can't reopen it.
exports.blockRole = (...roleNames) => async (req, res, next) => {
    try {
        const r = await db.query('SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [req.user.id]);
        if (roleNames.includes(r.rows[0]?.name)) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
};

// Allows the request when the caller's role holds ANY of the listed permissions.
exports.authorizeAnyPermission = (...permissions) => async (req, res, next) => {
    try {
        if (!req.user || !req.user.role_id) return res.status(403).json({ success: false, message: 'Forbidden' });
        const r = await db.query(
            `SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1 AND p.name = ANY($2) LIMIT 1`,
            [req.user.role_id, permissions]
        );
        if (!r.rows.length) return res.status(403).json({ success: false, message: 'Forbidden: Missing required permission' });
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
};
