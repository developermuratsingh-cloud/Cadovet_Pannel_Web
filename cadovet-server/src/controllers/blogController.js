const db = require('../database');

// GET /api/blogs?category=&limit=   (public) — list without the full article body
exports.listBlogs = async (req, res) => {
  try {
    const { category } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const params = [];
    let where = 'WHERE is_published = TRUE';
    if (category) {
      params.push(category);
      where += ` AND category = $${params.length}`;
    }
    params.push(limit);

    const result = await db.query(
      `SELECT id, slug, title, category, author, excerpt, image_url, read_minutes, published_at
       FROM blog_posts ${where}
       ORDER BY published_at DESC, id DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listBlogs error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/blogs/:slug   (public) — full article
exports.getBlog = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, slug, title, category, author, excerpt, content, image_url, read_minutes, published_at
       FROM blog_posts WHERE slug = $1 AND is_published = TRUE`,
      [req.params.slug]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('getBlog error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
