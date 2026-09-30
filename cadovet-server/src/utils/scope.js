const db = require('../database');

// Resolves whether the authenticated user is a CUSTOMER and, if so, their customers.id.
// Used to enforce ownership on single-record endpoints (staff roles are unrestricted).
exports.getCustomerScope = async (userId) => {
  const roleRes = await db.query(
    'SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
    [userId]
  );
  if (roleRes.rows[0]?.name !== 'CUSTOMER') return { isCustomer: false, customerId: null };

  const custRes = await db.query('SELECT id FROM customers WHERE user_id = $1', [userId]);
  return { isCustomer: true, customerId: custRes.rows[0]?.id ?? null };
};
