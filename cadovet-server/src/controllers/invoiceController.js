const db = require('../database');
const { getCustomerScope } = require('../utils/scope');

// GET /api/invoices
exports.listInvoices = async (req, res) => {
  try {
    const { status, customer_id, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const userResult = await db.query(`
      SELECT u.id, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [req.user.id]);

    const userRole = userResult.rows[0]?.role_name;

    let where = [];
    let params = [];
    let idx = 1;

    // Customer scoping
    if (userRole === 'CUSTOMER') {
      const custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length) {
        return res.json({ success: true, data: [], metrics: { totalRevenue: 0, pendingAmount: 0 }, pagination: { total: 0 } });
      }
      where.push(`i.customer_id = $${idx++}`);
      params.push(custResult.rows[0].id);
    } else if (customer_id) {
      where.push(`i.customer_id = $${idx++}`);
      params.push(customer_id);
    }

    if (status && status !== 'ALL') {
      where.push(`i.payment_status = $${idx++}`);
      params.push(status);
    }

    if (search) {
      where.push(`(i.invoice_number ILIKE $${idx} OR u.name ILIKE $${idx} OR p.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Calculate metrics
    const metricsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN i.payment_status = 'PAID' THEN i.total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN i.payment_status = 'PENDING' THEN i.total_amount ELSE 0 END), 0) as pending_amount,
        COUNT(CASE WHEN i.payment_status = 'PAID' THEN 1 END) as paid_count,
        COUNT(CASE WHEN i.payment_status = 'PENDING' THEN 1 END) as pending_count,
        COUNT(*) as total_count
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN pets p ON i.pet_id = p.id
      ${whereClause}
    `;
    const metricsRes = await db.query(metricsQuery, params);
    const metrics = metricsRes.rows[0] || {};

    // Fetch invoices
    const dataQuery = `
      SELECT 
        i.*,
        u.name as customer_name,
        u.email as customer_email,
        u.mobile as customer_mobile,
        p.name as pet_name,
        p.species as pet_species,
        a.appointment_date,
        s.name as service_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN pets p ON i.pet_id = p.id
      LEFT JOIN appointments a ON i.appointment_id = a.id
      LEFT JOIN services s ON a.service_id = s.id
      ${whereClause}
      ORDER BY i.invoice_date DESC, i.id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(limit, offset);
    const result = await db.query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      metrics: {
        totalRevenue: parseFloat(metrics.total_revenue || 0),
        pendingAmount: parseFloat(metrics.pending_amount || 0),
        paidCount: parseInt(metrics.paid_count || 0, 10),
        pendingCount: parseInt(metrics.pending_count || 0, 10),
        totalCount: parseInt(metrics.total_count || 0, 10)
      },
      pagination: {
        total: parseInt(metrics.total_count || 0, 10),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil((metrics.total_count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('listInvoices error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices', error: error.message });
  }
};

// GET /api/invoices/:id
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        i.*,
        u.name as customer_name,
        u.email as customer_email,
        u.mobile as customer_mobile,
        c.address as customer_address,
        p.name as pet_name,
        p.species as pet_species,
        p.breed as pet_breed,
        a.appointment_date,
        s.name as service_name,
        doc_u.name as doctor_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN pets p ON i.pet_id = p.id
      LEFT JOIN appointments a ON i.appointment_id = a.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users doc_u ON d.user_id = doc_u.id
      WHERE i.id = $1
    `;
    const result = await db.query(query, [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const { isCustomer, customerId } = await getCustomerScope(req.user.id);
    if (isCustomer && result.rows[0].customer_id !== customerId) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getInvoiceById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoice', error: error.message });
  }
};

// POST /api/invoices
exports.createInvoice = async (req, res) => {
  try {
    const {
      customer_id,
      pet_id,
      appointment_id,
      subtotal,
      tax = 0,
      discount = 0,
      payment_status = 'PAID',
      payment_method = 'CARD',
      invoice_date,
      notes
    } = req.body;

    if (!customer_id || subtotal === undefined) {
      return res.status(400).json({ success: false, message: 'Customer ID and subtotal are required' });
    }

    const sub = parseFloat(subtotal);
    const tx = parseFloat(tax || 0);
    const disc = parseFloat(discount || 0);
    const total = Math.max(0, sub + tx - disc);

    // Generate unique invoice number: INV-YEAR-RANDOM
    const year = new Date().getFullYear();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const invoice_number = `INV-${year}-${randNum}`;

    const result = await db.query(`
      INSERT INTO invoices (
        invoice_number, customer_id, pet_id, appointment_id,
        subtotal, tax, discount, total_amount,
        payment_status, payment_method, invoice_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_DATE), $12)
      RETURNING *
    `, [
      invoice_number,
      customer_id,
      pet_id || null,
      appointment_id || null,
      sub,
      tx,
      disc,
      total,
      payment_status,
      payment_method,
      invoice_date || null,
      notes || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('createInvoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to create invoice', error: error.message });
  }
};

// PATCH /api/invoices/:id/status
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_method } = req.body;

    if (!payment_status) {
      return res.status(400).json({ success: false, message: 'payment_status is required' });
    }

    const result = await db.query(`
      UPDATE invoices
      SET 
        payment_status = $1,
        payment_method = COALESCE($2, payment_method)
      WHERE id = $3
      RETURNING *
    `, [payment_status, payment_method || null, id]);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('updateInvoiceStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update invoice status', error: error.message });
  }
};

// DELETE /api/invoices/:id
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM invoices WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('deleteInvoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete invoice', error: error.message });
  }
};
