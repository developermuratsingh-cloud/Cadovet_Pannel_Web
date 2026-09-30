const db = require('../database');
const { isEmergencyTime, effectivePrice } = require('../utils/emergency');

const toDto = (c) => ({
  code: c.code,
  title: c.title,
  description: c.description,
  discount_type: c.discount_type,
  discount_value: c.discount_value,
  min_amount: c.min_amount,
  max_discount: c.max_discount,
  valid_until: c.valid_until,
});

const ACTIVE_WHERE = `is_active = TRUE AND (valid_from IS NULL OR valid_from <= CURRENT_DATE) AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`;

// Discount for an order amount. Returns { coupon } or { error }.
const resolveCoupon = async (rawCode, amount) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { error: 'Enter a coupon code' };
  const res = await db.query(`SELECT * FROM coupons WHERE code = $1 AND ${ACTIVE_WHERE}`, [code]);
  const coupon = res.rows[0];
  if (!coupon) return { error: 'This coupon is not valid' };

  const total = Number(amount) || 0;
  if (total < Number(coupon.min_amount || 0)) return { error: `This coupon needs a minimum amount of ₹${Number(coupon.min_amount)}` };

  let discount = coupon.discount_type === 'PERCENT' ? (total * Number(coupon.discount_value)) / 100 : Number(coupon.discount_value);
  if (coupon.max_discount) discount = Math.min(discount, Number(coupon.max_discount));
  discount = Math.min(Math.round(discount * 100) / 100, total);
  return { coupon, discount, payable: Math.round((total - discount) * 100) / 100 };
};
exports.resolveCoupon = resolveCoupon;

// GET /api/coupons
exports.listCoupons = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM coupons WHERE ${ACTIVE_WHERE} ORDER BY id`);
    res.json({ success: true, data: result.rows.map(toDto) });
  } catch (err) {
    console.error('listCoupons error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/coupons/validate  { code, service_id }  -> the amount comes from the service, never from the client
exports.validateCoupon = async (req, res) => {
  try {
    const { code, service_id } = req.body;
    if (!service_id) return res.status(400).json({ success: false, message: 'Select a service first' });
    const svc = await db.query('SELECT price, emergency_price FROM services WHERE id = $1', [service_id]);
    if (!svc.rows.length) return res.status(404).json({ success: false, message: 'Service not found' });

    // In emergency hours (9 PM - 9 AM) the service costs its emergency price, so the discount is worked out on that.
    const emergency = isEmergencyTime(req.body.appointment_time);
    const amount = effectivePrice(svc.rows[0], emergency);
    const r = await resolveCoupon(code, amount);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: { code: r.coupon.code, title: r.coupon.title, original: amount, discount: r.discount, payable: r.payable, emergency } });
  } catch (err) {
    console.error('validateCoupon error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
