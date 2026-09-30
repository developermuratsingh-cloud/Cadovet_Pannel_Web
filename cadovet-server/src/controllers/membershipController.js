const db = require('../database');

// GET /api/membership-offers  (public marketing content, like /api/blogs)
exports.listOffers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, slug, title, subtitle, pet_type, price, original_price, badge, description, inclusions, image_url, rating, reviews_count
       FROM membership_offers WHERE is_active = TRUE ORDER BY sort_order, id`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listOffers error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
