const db = require('../database');
const { getStaffScope } = require('../utils/staffScope');
const { validatePetFields } = require('../utils/validation');

// GET /api/pets — admin sees all, customer sees own
exports.listPets = async (req, res) => {
  try {
    const { search, species, customer_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Get role
    const userResult = await db.query(
      'SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    const role = userResult.rows[0]?.role_name;

    let where = ["p.status = 'ACTIVE'"];
    let params = [];
    let idx = 1;

    // Customers can only see their own pets
    if (role === 'CUSTOMER') {
      let custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length) {
        custResult = await db.query('INSERT INTO customers (user_id) VALUES ($1) RETURNING id', [req.user.id]);
      }
      where.push(`p.customer_id = $${idx++}`);
      params.push(custResult.rows[0].id);
    } else {
      // A doctor's patients are the pets that have an appointment assigned to them; nobody else's.
      const scope = await getStaffScope(req.user.id);
      if (scope.isDoctor) {
        where.push(`EXISTS (SELECT 1 FROM appointments ap WHERE ap.pet_id = p.id AND ap.doctor_id = $${idx++} AND ap.assigned_at IS NOT NULL)`);
        params.push(scope.doctorId);
      }
      if (customer_id) {
        where.push(`p.customer_id = $${idx++}`);
        params.push(customer_id);
      }
    }

    if (search) {
      where.push(`(p.name ILIKE $${idx} OR p.breed ILIKE $${idx} OR p.species ILIKE $${idx} OR u.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (species && species !== 'ALL') {
      where.push(`p.species = $${idx++}`);
      params.push(species);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await db.query(
      `SELECT COUNT(*) 
       FROM pets p
       JOIN customers c ON p.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       ${whereClause}`,
      params
    );

    const result = await db.query(
      `SELECT p.id, p.name, p.species, p.breed, p.gender, p.date_of_birth, p.weight,
              p.color, p.profile_image, p.blood_group, p.microchip_number,
              p.is_neutered, p.is_vaccinated, p.allergies, p.notes, p.status, p.created_at,
              u.name as owner_name, u.mobile as owner_mobile, u.email as owner_email,
              c.id as customer_id
       FROM pets p
       JOIN customers c ON p.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0]?.count || 0),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((countRes.rows[0]?.count || 0) / limit)
      }
    });
  } catch (err) {
    console.error('listPets error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/pets/:id
exports.getPet = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.name as owner_name, u.email as owner_email, u.mobile as owner_mobile, c.id as customer_id
       FROM pets p
       JOIN customers c ON p.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Pet not found' });

    // Ownership check for customers
    const userResult = await db.query(
      'SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    const role = userResult.rows[0]?.role_name;
    if (role === 'CUSTOMER') {
      const custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length || result.rows[0].customer_id !== custResult.rows[0].id) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only view your own pets.' });
      }
    }
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor) {
      const assigned = await db.query('SELECT 1 FROM appointments WHERE pet_id = $1 AND doctor_id = $2 AND assigned_at IS NOT NULL LIMIT 1', [req.params.id, scope.doctorId]);
      if (!assigned.rows.length) return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('getPet error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/pets
exports.createPet = async (req, res) => {
  try {
    const {
      name, species, breed, gender, date_of_birth, weight, color,
      microchip_number, blood_group, is_neutered, is_vaccinated,
      allergies, notes, customer_id
    } = req.body;

    if (!name || !species) {
      return res.status(400).json({ success: false, message: 'Pet name and species are required' });
    }
    const fieldError = validatePetFields({ name, weight, date_of_birth });
    if (fieldError) return res.status(400).json({ success: false, message: fieldError });

    let custId = customer_id;

    // Check user role
    const userResult = await db.query(
      'SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    const role = userResult.rows[0]?.role_name;

    // If customer is adding their own pet, enforce their customer_id
    if (role === 'CUSTOMER' || !custId) {
      let custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length) {
        custResult = await db.query('INSERT INTO customers (user_id) VALUES ($1) RETURNING id', [req.user.id]);
      }
      custId = custResult.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO pets (
         customer_id, name, species, breed, gender, date_of_birth,
         weight, color, microchip_number, blood_group, is_neutered,
         is_vaccinated, allergies, notes, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        custId, name, species, breed || null, gender || 'UNKNOWN',
        date_of_birth || null, weight || null, color || null,
        microchip_number || null, blood_group || null,
        Boolean(is_neutered), Boolean(is_vaccinated),
        allergies || null, notes || null, req.user.id
      ]
    );

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'PET_CREATED', 'PETS', result.rows[0].id, JSON.stringify({ name, species, breed, customer_id: custId }), req.ip]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: `${name} has been added successfully!`
    });
  } catch (err) {
    console.error('createPet error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/pets/:id
exports.updatePet = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, species, breed, gender, date_of_birth, weight, color,
      microchip_number, blood_group, is_neutered, is_vaccinated,
      allergies, notes, status
    } = req.body;

    const fieldError = validatePetFields({ name, weight, date_of_birth }, { partial: true });
    if (fieldError) return res.status(400).json({ success: false, message: fieldError });

    const existing = await db.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Pet not found' });

    // Ownership check for customers
    const userResult = await db.query(
      'SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    const role = userResult.rows[0]?.role_name;
    if (role === 'CUSTOMER') {
      const custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length || existing.rows[0].customer_id !== custResult.rows[0].id) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only update your own pets.' });
      }
    }

    const result = await db.query(
      `UPDATE pets SET
         name = COALESCE($1, name),
         species = COALESCE($2, species),
         breed = COALESCE($3, breed),
         gender = COALESCE($4, gender),
         date_of_birth = COALESCE($5, date_of_birth),
         weight = COALESCE($6, weight),
         color = COALESCE($7, color),
         microchip_number = COALESCE($8, microchip_number),
         blood_group = COALESCE($9, blood_group),
         is_neutered = COALESCE($10, is_neutered),
         is_vaccinated = COALESCE($11, is_vaccinated),
         allergies = COALESCE($12, allergies),
         notes = COALESCE($13, notes),
         status = COALESCE($14, status),
         updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        name, species, breed, gender, date_of_birth, weight, color,
        microchip_number, blood_group, is_neutered, is_vaccinated,
        allergies, notes, status, id
      ]
    );

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'PET_UPDATED', 'PETS', id, JSON.stringify(req.body), req.ip]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Pet details updated successfully!'
    });
  } catch (err) {
    console.error('updatePet error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// DELETE /api/pets/:id (Soft delete)
exports.deletePet = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Pet not found' });

    // Ownership check for customers
    const userResult = await db.query(
      'SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );
    const role = userResult.rows[0]?.role_name;
    if (role === 'CUSTOMER') {
      const custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length || existing.rows[0].customer_id !== custResult.rows[0].id) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only remove your own pets.' });
      }
    }

    await db.query("UPDATE pets SET status = 'INACTIVE', updated_at = NOW() WHERE id = $1", [id]);

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, old_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'PET_DEACTIVATED', 'PETS', id, JSON.stringify({ name: existing.rows[0].name }), req.ip]
    );

    res.json({ success: true, message: 'Pet removed successfully' });
  } catch (err) {
    console.error('deletePet error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
