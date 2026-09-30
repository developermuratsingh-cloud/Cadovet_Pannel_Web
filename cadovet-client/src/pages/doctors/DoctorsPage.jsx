import React, { useState, useEffect, useContext, useRef } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getDoctors, getDoctor, updateDoctor, createDoctor } from '../../services/doctorApi';
import { getInventory, getInventoryTransactions, dispenseToDoctor, uploadSlipImage } from '../../services/inventoryApi';
import { getLocations } from '../../services/locationApi';
import { AuthContext } from '../../context/AuthContext';

const DoctorsPage = () => {
  const { hasPermission } = useContext(AuthContext);
  const canSeeStock = hasPermission('INVENTORY_VIEW') || hasPermission('MEDICINE_VIEW');
  const canDispense = hasPermission('INVENTORY_MANAGE');
  // A Pharmacy/Inventory desk can dispense but never manages doctor profiles — for them this whole page is
  // really "medicine assigned to doctors", so they get that list + an Assign button instead of the doctor
  // directory (which only ADMIN, or anyone else with doctor-management rights, actually needs).
  const isDeskOnly = canDispense && !hasPermission('DOCTOR_CREATE') && !hasPermission('DOCTOR_UPDATE');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [viewDoctor, setViewDoctor] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [presetDoctorId, setPresetDoctorId] = useState(null);
  // Admin/Operational Head can see both the doctor directory and the cross-doctor medicine-assignment log —
  // kept as separate tabs rather than one long stacked page.
  const [activeTab, setActiveTab] = useState('doctors');

  const [formData, setFormData] = useState({
    specialization: '',
    qualification: '',
    experience_years: 0,
    consultation_fee: 500,
    available_days: 'Mon,Tue,Wed,Thu,Fri,Sat',
    available_from: '09:00:00',
    available_to: '18:00:00',
    bio: ''
  });
  const [saving, setSaving] = useState(false);

  // Add a doctor: a person who signs in with their mobile number (OTP) plus the profile appointments are assigned to.
  const blankNew = { name: '', email: '', password: '', mobile: '', specialization: '', qualification: '', experience_years: 0, consultation_fee: 500, available_days: 'Mon,Tue,Wed,Thu,Fri,Sat', available_from: '09:00', available_to: '18:00', location_ids: [] };
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoctor, setNewDoctor] = useState(blankNew);
  const [addError, setAddError] = useState('');
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const toggleDay = (d) => {
    const days = newDoctor.available_days.split(',').filter(Boolean);
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    setNewDoctor({ ...newDoctor, available_days: DAYS.filter((x) => next.includes(x)).join(',') });
  };
  const toggleLocation = (id) => setNewDoctor(d => ({
    ...d, location_ids: d.location_ids.includes(id) ? d.location_ids.filter(x => x !== id) : [...d.location_ids, id],
  }));
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!newDoctor.available_days) { setAddError('Choose at least one working day.'); return; }
    if (newDoctor.location_ids.length === 0) { setAddError('Assign at least one branch for this doctor.'); return; }
    if (newDoctor.password.length < 8 || !/[A-Za-z]/.test(newDoctor.password) || !/\d/.test(newDoctor.password)) { setAddError('The temporary password needs at least 8 characters, with a letter and a number.'); return; }
    setSaving(true);
    try {
      await createDoctor({ ...newDoctor, experience_years: Number(newDoctor.experience_years), consultation_fee: Number(newDoctor.consultation_fee) });
      setShowAddModal(false);
      setNewDoctor(blankNew);
      showToast('Doctor added — they sign in with their email and must change the temporary password at first sign-in.');
      fetchDoctorsList();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Could not add the doctor');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchDoctorsList = async () => {
    setLoading(true);
    try {
      const res = await getDoctors({ limit: 50 });
      setDoctors(res.data.data || []);
    } catch (e) {
      console.error('Failed to load doctors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorsList();
    getLocations().then((res) => setLocations((res.data.data || []).filter((l) => l.status === 'ACTIVE'))).catch(() => {});
  }, []);

  // Only fetched for a role that can actually dispense — this is department-scoped server side (a Pharmacy desk
  // account only gets its own MEDICINE-department stock, Inventory desk only its own, ops/admin get both).
  useEffect(() => {
    if (!canDispense) return;
    getInventory({ limit: 200 }).then((res) => setInventoryItems(res.data.data || [])).catch(() => {});
  }, [canDispense]);

  const handleOpenEdit = async (doc) => {
    setSelectedDoctor(doc);
    setFormData({
      specialization: doc.specialization || '',
      qualification: doc.qualification || '',
      experience_years: doc.experience_years || 0,
      consultation_fee: doc.consultation_fee || 500,
      available_days: doc.available_days || 'Mon,Tue,Wed,Thu,Fri,Sat',
      available_from: doc.available_from || '09:00:00',
      available_to: doc.available_to || '18:00:00',
      bio: doc.bio || '',
      location_ids: [],
    });
    setShowEditModal(true);
    // The list doesn't carry their branch roster — fetch the full profile for that.
    try {
      const res = await getDoctor(doc.id);
      setFormData((f) => ({ ...f, location_ids: (res.data.data.locations || []).map((l) => l.id) }));
    } catch { /* keep editing the rest even if this fails */ }
  };

  const toggleEditLocation = (id) => setFormData((f) => ({
    ...f, location_ids: f.location_ids.includes(id) ? f.location_ids.filter((x) => x !== id) : [...f.location_ids, id],
  }));

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (formData.location_ids.length === 0) { alert('A doctor must be rostered at least one branch.'); return; }
    setSaving(true);
    try {
      await updateDoctor(selectedDoctor.id, formData);
      showToast('Doctor profile updated successfully! 🩺');
      setShowEditModal(false);
      fetchDoctorsList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update doctor profile');
    } finally {
      setSaving(false);
    }
  };

  // "Delete" a doctor who has left: soft — flips the profile and their login to INACTIVE rather than a hard
  // row delete, which the database itself refuses once there's any dispense/appointment history against them.
  // They drop out of the active directory and booking immediately; reactivating (if they ever rejoin) is the
  // same call with status: 'ACTIVE'.
  const [removingId, setRemovingId] = useState(null);
  const handleRemoveDoctor = async (doc) => {
    if (!window.confirm(`Remove ${doc.name}? They'll no longer appear in the doctor directory or be bookable for appointments, and won't be able to sign in. Their past appointments, prescriptions and medicine records stay on file.`)) return;
    setRemovingId(doc.id);
    try {
      await updateDoctor(doc.id, { status: 'INACTIVE' });
      showToast(`${doc.name} removed — their history is kept, but they're no longer active.`);
      fetchDoctorsList();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not remove this doctor');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <AdminLayout>
      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff',
            padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span>✓</span> {toast}
          </div>
        )}

        {showAssignModal && (
          <AssignMedicineModal
            doctors={doctors}
            items={inventoryItems}
            initialDoctorId={presetDoctorId}
            onClose={() => setShowAssignModal(false)}
            onDone={(msg) => { setShowAssignModal(false); showToast(msg); }}
          />
        )}

        {isDeskOnly ? (
          <AssignedMedicineList
            doctors={doctors}
            onAssign={() => { setPresetDoctorId(null); setShowAssignModal(true); }}
          />
        ) : (
        <>
        {/* Header */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
                Veterinary Specialists & Medical Staff
              </h1>
              {activeTab === 'doctors' && !loading && (
                <span style={{ fontSize: '12px', fontWeight: '800', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(27,175,191,0.1)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                  👥 {doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'} connected
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>
              Registered clinic doctors, surgical specialists, consulting hours, and credentials
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {hasPermission('DOCTOR_CREATE') && activeTab === 'doctors' && (
              <button onClick={() => setShowAddModal(true)} data-testid="add-doctor" className="btn-primary" style={{ padding: '12px 22px', borderRadius: '12px' }}>+ Add doctor</button>
            )}
          </div>
        </div>

        {(canSeeStock || canDispense) && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            {[
              { key: 'doctors', label: '🩺 Doctors' },
              { key: 'medicine', label: '💊 Medicine Assigned to Doctors' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: '700', fontSize: '14px',
                  color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-light)',
                  borderBottom: activeTab === tab.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'medicine' && (canSeeStock || canDispense) ? (
          <AssignedMedicineList doctors={doctors} readOnly />
        ) : (
        <>
        {/* Doctor Listing */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div>Loading veterinary specialists...</div>
          </div>
        ) : doctors.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
            No doctors connected yet.
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Doctor</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Specialization</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Experience</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}></th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doc) => (
                  <tr key={doc.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #1BAFBF, #4CAF50)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                        }}>
                          🩺
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark)' }}>{doc.name}</div>
                          <div style={{ fontSize: '11px', color: '#ecc94b' }}>★ {doc.rating || '4.9'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-dark)', fontWeight: '600' }}>{doc.specialization}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-medium)' }}>{doc.experience_years} yrs</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-light)', fontSize: '12px' }}>
                      <div>{doc.email}</div>
                      {doc.mobile && <div>{doc.mobile}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setViewDoctor(doc)}
                          style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--primary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          View
                        </button>
                        {hasPermission('DOCTOR_UPDATE') && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(doc)}
                              title="Change this doctor's specialization, fee, working days and hours"
                              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-dark)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveDoctor(doc)}
                              disabled={removingId === doc.id}
                              title="Doctor left the organisation — deactivate their profile and login. Appointment/prescription/medicine history is kept."
                              style={{
                                padding: '6px 14px', borderRadius: '8px', border: '1px solid #fed7d7',
                                background: '#fff', color: '#c53030', fontWeight: '700', fontSize: '12px',
                                cursor: removingId === doc.id ? 'default' : 'pointer', whiteSpace: 'nowrap',
                                opacity: removingId === doc.id ? 0.6 : 1,
                              }}
                            >
                              {removingId === doc.id ? 'Removing…' : 'Remove'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
        </>
        )}

        {viewDoctor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div className="modal-scroll" style={{ background: '#fff', borderRadius: '20px', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #1BAFBF, #4CAF50)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                  }}>
                    🩺
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>{viewDoctor.name}</h2>
                    <div style={{ fontSize: '12px', color: '#ecc94b' }}>★ {viewDoctor.rating || '4.9'}</div>
                  </div>
                </div>
                <button onClick={() => setViewDoctor(null)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
              </div>

              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-dark)', marginBottom: '2px' }}>{viewDoctor.specialization}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '16px' }}>
                {viewDoctor.qualification} • {viewDoctor.experience_years} Years Exp
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-medium)', lineHeight: '1.6', marginBottom: '16px' }}>
                {viewDoctor.bio || 'Experienced veterinarian dedicated to animal health, diagnostics, and surgical excellence.'}
              </p>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>Available Days:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{viewDoctor.available_days}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>Working Hours:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{viewDoctor.available_from?.slice(0, 5)} - {viewDoctor.available_to?.slice(0, 5)}</span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>📧 {viewDoctor.email}</div>
                {viewDoctor.mobile && <div>📱 {viewDoctor.mobile}</div>}
              </div>
            </div>
          </div>
        )}

        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div className="modal-scroll" style={{ background: '#fff', borderRadius: '20px', maxWidth: '600px', width: '100%', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Add a doctor</h2>
                <button onClick={() => setShowAddModal(false)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer' }}>✕</button>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '18px' }}>The doctor signs in with their email and the temporary password you set (they must change it at first sign-in). The operational head assigns appointments within the hours you set here.</p>
              {addError && <div className="alert alert-error" role="alert" style={{ marginBottom: '16px' }}>{addError}</div>}
              <form onSubmit={handleAddDoctor}>
                <div className="form-group"><label className="form-label">Full name *</label>
                  <input className="form-input" data-testid="doctor-name" value={newDoctor.name} onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })} placeholder="Dr. Asha Rao" required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group"><label className="form-label">Email (sign-in) *</label>
                    <input className="form-input" type="email" data-testid="doctor-email" value={newDoctor.email} onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Temporary password *</label>
                    <input className="form-input" type="text" autoComplete="off" data-testid="doctor-password" value={newDoctor.password} onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })} placeholder="Welcome2Cadovet" required /></div>
                </div>
                <div className="form-group"><label className="form-label">Mobile (optional)</label>
                  <input className="form-input" type="tel" data-testid="doctor-mobile" value={newDoctor.mobile} onChange={(e) => setNewDoctor({ ...newDoctor, mobile: e.target.value })} placeholder="9876543210" /></div>
                <div className="form-group"><label className="form-label">Specialization *</label>
                  <input className="form-input" data-testid="doctor-spec" value={newDoctor.specialization} onChange={(e) => setNewDoctor({ ...newDoctor, specialization: e.target.value })} placeholder="Canine medicine & surgery" required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div className="form-group"><label className="form-label">Qualification</label>
                    <input className="form-input" value={newDoctor.qualification} onChange={(e) => setNewDoctor({ ...newDoctor, qualification: e.target.value })} placeholder="BVSc & AH" /></div>
                  <div className="form-group"><label className="form-label">Experience (yrs)</label>
                    <input className="form-input" type="number" min="0" max="70" value={newDoctor.experience_years} onChange={(e) => setNewDoctor({ ...newDoctor, experience_years: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Fee (₹)</label>
                    <input className="form-input" type="number" min="0" value={newDoctor.consultation_fee} onChange={(e) => setNewDoctor({ ...newDoctor, consultation_fee: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Working days *</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {DAYS.map((d) => {
                      const on = newDoctor.available_days.split(',').includes(d);
                      return <button type="button" key={d} onClick={() => toggleDay(d)} aria-pressed={on} style={{ padding: '7px 14px', borderRadius: '20px', border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--primary)' : '#f7fafc', color: on ? '#fff' : 'var(--text-medium)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>{d}</button>;
                    })}
                  </div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group"><label className="form-label">From *</label>
                    <input className="form-input" type="time" value={newDoctor.available_from} onChange={(e) => setNewDoctor({ ...newDoctor, available_from: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">To *</label>
                    <input className="form-input" type="time" value={newDoctor.available_to} onChange={(e) => setNewDoctor({ ...newDoctor, available_to: e.target.value })} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Branch(es) *</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {locations.map((l) => {
                      const on = newDoctor.location_ids.includes(l.id);
                      return <button type="button" key={l.id} onClick={() => toggleLocation(l.id)} aria-pressed={on} style={{ padding: '7px 14px', borderRadius: '20px', border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--primary)' : '#f7fafc', color: on ? '#fff' : 'var(--text-medium)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>🏢 {l.name}</button>;
                    })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>Pick more than one if this doctor covers multiple branches — they'll get a switcher to move between them.</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" disabled={saving} data-testid="doctor-submit" className="btn-primary" style={{ flex: 1, padding: '12px' }}>{saving ? 'Saving…' : '✓ Add doctor'}</button>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedDoctor && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div className="modal-scroll" style={{
              background: '#fff', borderRadius: '20px', maxWidth: '600px', width: '100%',
              padding: '32px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>
                  Edit {selectedDoctor.name} Profile
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Specialization *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.specialization}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Qualification</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.qualification}
                      onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Experience (Years)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.experience_years}
                      onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Consultation Fee (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.consultation_fee}
                      onChange={(e) => setFormData(prev => ({ ...prev, consultation_fee: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Available Days</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Mon,Tue,Wed,Thu,Fri,Sat"
                    value={formData.available_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, available_days: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Working Hours From</label>
                    <input
                      type="time"
                      className="form-input"
                      value={formData.available_from}
                      onChange={(e) => setFormData(prev => ({ ...prev, available_from: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Working Hours To</label>
                    <input
                      type="time"
                      className="form-input"
                      value={formData.available_to}
                      onChange={(e) => setFormData(prev => ({ ...prev, available_to: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Professional Biography</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch(es) *</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {locations.map((l) => {
                      const on = formData.location_ids.includes(l.id);
                      return <button type="button" key={l.id} onClick={() => toggleEditLocation(l.id)} aria-pressed={on} style={{ padding: '7px 14px', borderRadius: '20px', border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--primary)' : '#f7fafc', color: on ? '#fff' : 'var(--text-medium)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>🏢 {l.name}</button>;
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)',
                      background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: '#fff', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(27,175,191,0.35)'
                    }}
                  >
                    {saving ? 'Updating...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

// Shared by every date-range filter on this page (the medicine-assignment list below).
const toISODate = (d) => d.toISOString().slice(0, 10);

// A Pharmacy/Inventory desk's real job on this page: what medicine has been assigned to which doctor, and a way
// to assign more. Replaces the doctor directory entirely for a desk account (see isDeskOnly above) — they have
// no reason to browse doctor profiles, only to hand out and track stock against a doctor's name.
// Admin/Operational Head see this same list further down their doctor directory, in `readOnly` mode — a
// consolidated audit trail across every doctor, since they can already dispense/view stock per doctor card above.
const AssignedMedicineList = ({ doctors, onAssign, readOnly }) => {
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(toISODate(monthAgo));
  const [dateTo, setDateTo] = useState(toISODate(today));
  const [doctorFilter, setDoctorFilter] = useState('');
  const [viewTxn, setViewTxn] = useState(null);

  const fetchTransactions = (from, to, doctorId) => {
    setLoading(true);
    const params = { type: 'DISPENSE_TO_DOCTOR', date_from: from, date_to: to };
    if (doctorId) params.doctor_id = doctorId;
    getInventoryTransactions(params)
      .then((res) => setTransactions(res.data.data || []))
      .catch((e) => console.error('Failed to load assigned medicine:', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions(dateFrom, dateTo, doctorFilter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDoctorFilter = (id) => {
    setDoctorFilter(id);
    fetchTransactions(dateFrom, dateTo, id);
  };

  return (
    <div>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
            Medicine Assigned to Doctors
          </h1>
          <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>
            {readOnly
              ? 'Read-only record of every medicine dispensed to a doctor, with the physical slip photo where one was attached — assign or dispense from a doctor\'s card above.'
              : 'Everything your desk has dispensed to a doctor, with the physical slip photo where one was attached'}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={onAssign}
            style={{ padding: '12px 22px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
          >
            💊 Assign Medicine to Doctor
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px', marginBottom: '20px', padding: '14px', background: '#fff', borderRadius: '14px', border: '1px solid var(--border)' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Doctor</label>
          <select className="form-input" value={doctorFilter} onChange={(e) => handleDoctorFilter(e.target.value)} style={{ padding: '7px 10px', fontSize: '13px' }}>
            <option value="">All doctors</option>
            {(doctors || []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>From</label>
          <input type="date" className="form-input" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '7px 10px', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>To</label>
          <input type="date" className="form-input" value={dateTo} min={dateFrom} max={toISODate(today)} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '7px 10px', fontSize: '13px' }} />
        </div>
        <button type="button" onClick={() => fetchTransactions(dateFrom, dateTo, doctorFilter)} className="btn-primary" style={{ padding: '9px 18px', fontSize: '13px' }}>
          🔍 Search
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>Nothing assigned in this date range.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Doctor</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Item</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Notes</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Slip</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-medium)', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-dark)' }}>{t.doctor_name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-dark)' }}>{t.item_name}</td>
                  <td style={{ padding: '12px 16px' }}>{t.quantity}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-light)', fontSize: '12px' }}>{t.notes || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.slip_image_url ? (
                      <a href={t.slip_image_url} target="_blank" rel="noreferrer" title="View medicine slip photo">
                        <img src={t.slip_image_url} alt="Medicine slip" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)', display: 'block' }} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      type="button"
                      onClick={() => setViewTxn(t)}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--primary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewTxn && <AssignedMedicineDetailModal txn={viewTxn} onClose={() => setViewTxn(null)} />}
    </div>
  );
};

// The full record behind one "View" click in AssignedMedicineList — same data the row already carries, laid
// out to read comfortably (and a bigger look at the slip photo, not just the 36px thumbnail).
const AssignedMedicineDetailModal = ({ txn, onClose }) => {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)', textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div className="modal-scroll" style={{ background: '#fff', borderRadius: '20px', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>💊 Assignment Detail</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        {row('Date', new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}
        {row('Doctor', txn.doctor_name || '—')}
        {row('Item', txn.item_name)}
        {row('Quantity', txn.quantity)}
        {txn.department_name && row('Department', txn.department_name)}
        {txn.performed_by_name && row('Assigned by', txn.performed_by_name)}
        {row('Notes', txn.notes || '—')}

        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '8px' }}>Medicine Slip</div>
          {txn.slip_image_url ? (
            <a href={txn.slip_image_url} target="_blank" rel="noreferrer">
              <img src={txn.slip_image_url} alt="Medicine slip" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', display: 'block', background: 'var(--bg-light)' }} />
            </a>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px', background: 'var(--bg-light)', borderRadius: '10px' }}>No slip photo attached</div>
          )}
        </div>
      </div>
    </div>
  );
};

// A single medicine row's item picker: looks like the old <select>, but clicking it drops down a small panel
// with its own search box on top and the matching medicines listed below — the search lives inside the dropdown
// instead of sitting as a separate box above the whole medicine list.
const MedicineCombobox = ({ items, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const boxRef = useRef(null);

  const selected = items.find((it) => String(it.id) === String(value));

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const q = search.trim().toLowerCase();
  const options = q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items;

  const pick = (it) => {
    if (it.stock_quantity <= 0) return;
    onChange(String(it.id));
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: 2 }}>
      <button
        type="button"
        className="form-input"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', background: '#fff',
          color: selected ? 'var(--text-dark)' : 'var(--text-light)', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', gap: '8px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.name} — ${selected.stock_quantity} in stock${selected.department_name ? ` (${selected.department_name})` : ''}` : 'Select item'}
        </span>
        <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--text-light)' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
          background: '#fff', border: '1px solid var(--border)', borderRadius: '10px',
          boxShadow: '0 12px 28px rgba(0,0,0,0.15)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search medicine by name…"
              className="form-input"
              style={{ padding: '7px 10px', fontSize: '13px' }}
            />
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {options.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>No medicines match your search</div>
            ) : (
              options.map((it) => {
                const disabled = it.stock_quantity <= 0;
                const isSelected = String(it.id) === String(value);
                return (
                  <div
                    key={it.id}
                    onClick={() => pick(it)}
                    style={{
                      padding: '9px 12px', fontSize: '13px', cursor: disabled ? 'default' : 'pointer',
                      color: disabled ? 'var(--text-light)' : 'var(--text-dark)',
                      background: isSelected ? 'var(--bg-light)' : '#fff', fontWeight: isSelected ? '700' : '500',
                    }}
                    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg-light)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'var(--bg-light)' : '#fff'; }}
                  >
                    {it.name} — {disabled ? 'out of stock' : `${it.stock_quantity} in stock`}{it.department_name ? ` (${it.department_name})` : ''}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Lets a Pharmacy/Inventory desk (or ops/admin) hand stock to a doctor directly from the Doctors/Staff section,
// instead of navigating to the Pharmacy or Inventory page first. The item list is already department-scoped by
// the backend for a desk account.
// One form: pick the doctor, add as many medicines (item + quantity) as this hand-off covers, and optionally
// attach a photo of the physical slip — covering the whole batch, not one line each. Opens either from the
// page-level "Assign Medicine to Doctor" button (doctor picked here) or a doctor card's "+ Dispense" (pre-filled,
// still changeable) — same form either way.
const AssignMedicineModal = ({ doctors, items, initialDoctorId, onClose, onDone }) => {
  const [doctorId, setDoctorId] = useState(initialDoctorId ? String(initialDoctorId) : '');
  const [rows, setRows] = useState([{ itemId: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [slipImageUrl, setSlipImageUrl] = useState('');
  const [slipUploading, setSlipUploading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const doctor = doctors.find((d) => String(d.id) === String(doctorId));

  const handleSlipFile = async (file) => {
    if (!file) return;
    setError('');
    setSlipUploading(true);
    try {
      const res = await uploadSlipImage(file);
      setSlipImageUrl(res.data.data.url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload slip image');
    } finally {
      setSlipUploading(false);
    }
  };

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { itemId: '', quantity: 1 }]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!doctorId) return setError('Select a doctor.');

    const validRows = rows.filter((r) => r.itemId);
    if (validRows.length === 0) return setError('Add at least one medicine.');
    for (const r of validRows) {
      const item = items.find((i) => String(i.id) === String(r.itemId));
      const qty = Number(r.quantity);
      if (!Number.isInteger(qty) || qty <= 0) return setError(`Enter a valid quantity for ${item?.name || 'each medicine'}.`);
      if (item && qty > item.stock_quantity) return setError(`Only ${item.stock_quantity} of ${item.name} in stock.`);
    }

    setSaving(true);
    try {
      const results = [];
      for (const r of validRows) {
        const item = items.find((i) => String(i.id) === String(r.itemId));
        await dispenseToDoctor(r.itemId, {
          doctor_id: doctorId, quantity: Number(r.quantity), notes: notes.trim() || undefined,
          slip_image_url: slipImageUrl || undefined,
        });
        results.push(`${r.quantity} × ${item?.name || 'item'}`);
      }
      onDone(`${results.join(', ')} assigned to ${doctor?.name || 'doctor'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign medicine');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="modal-scroll" style={{ background: '#fff', borderRadius: '20px', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>💊 Assign Medicine to Doctor</h2>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
      </div>
      <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Doctor *</label>
            <select className="form-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              <option value="">Select doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
              ))}
            </select>
          </div>

          <label className="form-label">Medicines *</label>
          {rows.map((row, i) => {
            const selected = items.find((it) => String(it.id) === String(row.itemId));
            return (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                <MedicineCombobox
                  items={items}
                  value={row.itemId}
                  onChange={(id) => updateRow(i, 'itemId', id)}
                />
                <input
                  type="number" min="1" max={selected?.stock_quantity} className="form-input"
                  value={row.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                  style={{ width: '80px', flexShrink: 0 }}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  title="Remove this medicine"
                  style={{
                    padding: '8px 10px', borderRadius: '8px', border: 'none', flexShrink: 0,
                    background: rows.length === 1 ? 'var(--bg-light)' : '#fed7d7', color: rows.length === 1 ? 'var(--text-light)' : '#742a2a',
                    cursor: rows.length === 1 ? 'default' : 'pointer', fontWeight: '700',
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addRow}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px dashed var(--border)', background: '#fff', color: 'var(--primary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}
          >
            + Add another medicine
          </button>

          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Notes</label>
            <input type="text" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — typed detail, applies to this whole hand-off" />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Medicine Slip Photo</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: slipUploading ? 'var(--bg-light)' : '#fff', color: 'var(--text-dark)',
                  fontWeight: '600', fontSize: '13px', cursor: slipUploading ? 'default' : 'pointer', textAlign: 'center',
                }}
              >
                {slipUploading ? 'Uploading…' : slipImageUrl ? '✓ Slip attached — tap to replace' : '📷 Upload slip photo (optional)'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={slipUploading}
                  onChange={(e) => { handleSlipFile(e.target.files?.[0]); e.target.value = ''; }}
                  style={{ display: 'none' }}
                />
              </label>
              {slipImageUrl && (
                <img src={slipImageUrl} alt="Slip preview" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', flexShrink: 0 }} />
              )}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '4px' }}>
              Use text (item + quantity above), a photo of the handwritten slip, or both — whatever's easiest.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || slipUploading} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Assigning…' : 'Assign Medicine'}</button>
          </div>
      </form>
      </div>
    </div>
  );
};

export default DoctorsPage;
