const db = require('../database');
const { getStaffScope } = require('../utils/staffScope');
const { getCustomerScope } = require('../utils/scope');

// GET /api/medical-records
exports.listMedicalRecords = async (req, res) => {
  try {
    const { pet_id, doctor_id, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Check user role
    const userResult = await db.query(`
      SELECT u.id, r.name as role_name, d.name as dept_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
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
        return res.json({ success: true, data: [], pagination: { total: 0 } });
      }
      where.push(`p.customer_id = $${idx++}`);
      params.push(custResult.rows[0].id);
    } else {
      // A doctor sees the records of their own patients (pets with an appointment assigned to them).
      const scope = await getStaffScope(req.user.id);
      if (scope.isDoctor) {
        where.push(`EXISTS (SELECT 1 FROM appointments ap WHERE ap.pet_id = mr.pet_id AND ap.doctor_id = $${idx++} AND ap.assigned_at IS NOT NULL)`);
        params.push(scope.doctorId);
      }
    }

    if (pet_id) {
      where.push(`mr.pet_id = $${idx++}`);
      params.push(pet_id);
    }

    if (doctor_id) {
      where.push(`mr.doctor_id = $${idx++}`);
      params.push(doctor_id);
    }

    if (search) {
      where.push(`(p.name ILIKE $${idx} OR mr.diagnosis ILIKE $${idx} OR u_doc.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countQuery = `
      SELECT COUNT(*) 
      FROM medical_records mr
      JOIN pets p ON mr.pet_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      LEFT JOIN users u_doc ON d.user_id = u_doc.id
      ${whereClause}
    `;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataQuery = `
      SELECT 
        mr.*,
        p.name as pet_name,
        p.species as pet_species,
        p.breed as pet_breed,
        c.id as customer_id,
        u_cust.name as owner_name,
        u_cust.mobile as owner_mobile,
        u_doc.name as doctor_name,
        d.specialization as doctor_specialization,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rx.id,
              'medicine_name', rx.medicine_name,
              'dosage', rx.dosage,
              'frequency', rx.frequency,
              'duration_days', rx.duration_days,
              'instructions', rx.instructions
            )
          ) FILTER (WHERE rx.id IS NOT NULL), '[]'
        ) as prescriptions
      FROM medical_records mr
      JOIN pets p ON mr.pet_id = p.id
      JOIN customers c ON p.customer_id = c.id
      JOIN users u_cust ON c.user_id = u_cust.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      LEFT JOIN users u_doc ON d.user_id = u_doc.id
      LEFT JOIN prescriptions rx ON mr.id = rx.medical_record_id
      ${whereClause}
      GROUP BY mr.id, p.name, p.species, p.breed, c.id, u_cust.name, u_cust.mobile, u_doc.name, d.specialization
      ORDER BY mr.visit_date DESC, mr.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(limit, offset);
    const result = await db.query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('listMedicalRecords error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch medical records', error: error.message });
  }
};

// GET /api/medical-records/:id
exports.getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        mr.*,
        p.name as pet_name,
        p.species as pet_species,
        p.breed as pet_breed,
        p.gender as pet_gender,
        p.date_of_birth as pet_dob,
        p.allergies as pet_allergies,
        c.id as customer_id,
        u_cust.name as owner_name,
        u_cust.email as owner_email,
        u_cust.mobile as owner_mobile,
        u_doc.name as doctor_name,
        d.specialization as doctor_specialization,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rx.id,
              'medicine_name', rx.medicine_name,
              'dosage', rx.dosage,
              'frequency', rx.frequency,
              'duration_days', rx.duration_days,
              'instructions', rx.instructions
            )
          ) FILTER (WHERE rx.id IS NOT NULL), '[]'
        ) as prescriptions
      FROM medical_records mr
      JOIN pets p ON mr.pet_id = p.id
      JOIN customers c ON p.customer_id = c.id
      JOIN users u_cust ON c.user_id = u_cust.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      LEFT JOIN users u_doc ON d.user_id = u_doc.id
      LEFT JOIN prescriptions rx ON mr.id = rx.medical_record_id
      WHERE mr.id = $1
      GROUP BY mr.id, p.name, p.species, p.breed, p.gender, p.date_of_birth, p.allergies, c.id, u_cust.name, u_cust.email, u_cust.mobile, u_doc.name, d.specialization
    `;

    const result = await db.query(query, [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Medical record not found' });
    }

    const { isCustomer, customerId } = await getCustomerScope(req.user.id);
    if (isCustomer && result.rows[0].customer_id !== customerId) {
      return res.status(404).json({ success: false, message: 'Medical record not found' });
    }
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor) {
      const assigned = await db.query('SELECT 1 FROM appointments WHERE pet_id = $1 AND doctor_id = $2 AND assigned_at IS NOT NULL LIMIT 1', [result.rows[0].pet_id, scope.doctorId]);
      if (!assigned.rows.length) return res.status(404).json({ success: false, message: 'Medical record not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getMedicalRecordById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve record', error: error.message });
  }
};

// POST /api/medical-records
exports.createMedicalRecord = async (req, res) => {
  const client = await db.getClient ? await db.getClient() : db;
  try {
    const {
      pet_id,
      doctor_id,
      appointment_id,
      visit_date,
      symptoms,
      diagnosis,
      temperature_f,
      weight_kg,
      treatment_notes,
      follow_up_date,
      prescriptions = [],
      note_only = false
    } = req.body;

    if (!pet_id || !diagnosis) {
      return res.status(400).json({ success: false, message: 'Pet ID and Diagnosis are required' });
    }

    // A doctor writes records only for their own patients, and always under their own name.
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor) {
      const assigned = await db.query('SELECT 1 FROM appointments WHERE pet_id = $1 AND doctor_id = $2 AND assigned_at IS NOT NULL LIMIT 1', [pet_id, scope.doctorId]);
      if (!assigned.rows.length) return res.status(403).json({ success: false, message: 'This pet has no appointment assigned to you' });
    }

    // Determine doctor_id if not provided and caller is a doctor
    let effectiveDoctorId = scope.isDoctor ? scope.doctorId : doctor_id;
    if (!effectiveDoctorId) {
      const docRes = await db.query('SELECT id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (docRes.rows.length) {
        effectiveDoctorId = docRes.rows[0].id;
      }
    }

    const recordRes = await db.query(`
      INSERT INTO medical_records (
        pet_id, doctor_id, appointment_id, visit_date, symptoms, diagnosis,
        temperature_f, weight_kg, treatment_notes, follow_up_date, is_prescription_note
      ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      pet_id,
      effectiveDoctorId || null,
      appointment_id || null,
      visit_date || null,
      symptoms || null,
      diagnosis,
      temperature_f || null,
      weight_kg || null,
      treatment_notes || null,
      follow_up_date || null,
      !!note_only
    ]);

    const newRecord = recordRes.rows[0];

    // Insert prescriptions if any
    const createdRx = [];
    if (Array.isArray(prescriptions) && prescriptions.length > 0) {
      for (const rx of prescriptions) {
        if (rx.medicine_name && rx.dosage) {
          const rxRes = await db.query(`
            INSERT INTO prescriptions (
              medical_record_id, pet_id, medicine_name, dosage, frequency, duration_days, instructions
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [
            newRecord.id,
            pet_id,
            rx.medicine_name,
            rx.dosage,
            rx.frequency || 'Once daily',
            rx.duration_days || 5,
            rx.instructions || null
          ]);
          createdRx.push(rxRes.rows[0]);
        }
      }
    }

    // If appointment_id is present, mark appointment as COMPLETED
    if (appointment_id) {
      await db.query(`
        UPDATE appointments 
        SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [appointment_id]);
    }

    newRecord.prescriptions = createdRx;

    res.status(201).json({
      success: true,
      message: 'Medical record and prescription created successfully',
      data: newRecord
    });
  } catch (error) {
    console.error('createMedicalRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to create medical record', error: error.message });
  }
};

// PUT /api/medical-records/:id
exports.updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      symptoms,
      diagnosis,
      temperature_f,
      weight_kg,
      treatment_notes,
      follow_up_date
    } = req.body;

    const result = await db.query(`
      UPDATE medical_records
      SET 
        symptoms = COALESCE($1, symptoms),
        diagnosis = COALESCE($2, diagnosis),
        temperature_f = COALESCE($3, temperature_f),
        weight_kg = COALESCE($4, weight_kg),
        treatment_notes = COALESCE($5, treatment_notes),
        follow_up_date = COALESCE($6, follow_up_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [symptoms, diagnosis, temperature_f, weight_kg, treatment_notes, follow_up_date, id]);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Medical record not found' });
    }

    res.json({
      success: true,
      message: 'Medical record updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('updateMedicalRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to update record', error: error.message });
  }
};

// DELETE /api/medical-records/:id
exports.deleteMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM medical_records WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Medical record not found' });
    }
    res.json({ success: true, message: 'Medical record removed successfully' });
  } catch (error) {
    console.error('deleteMedicalRecord error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete record', error: error.message });
  }
};
