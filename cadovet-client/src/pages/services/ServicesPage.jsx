import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getServices, createService, updateService, deleteService, uploadServiceImage } from '../../services/serviceApi';
import { AuthContext } from '../../context/AuthContext';

// These match the public site's real catalog sections exactly — a service's category here is what actually
// determines which page it shows on (Dogs → /dogs-packages, Cats → /cat-packages, etc.) and how many show up.
const CATEGORIES = ['ALL', 'Dogs', 'Cats', 'Consultation', 'Lab Tests', 'Health Checkup', 'Grooming', 'Surgery'];

const ServicesPage = () => {
  const { hasPermission } = useContext(AuthContext);
  // A doctor can see the price list but has no SERVICE_MANAGE permission — read-only, no Add/Edit/Delete.
  const canManage = hasPermission('SERVICE_MANAGE');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [toast, setToast] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const initialForm = {
    name: '',
    category: 'Consultation',
    description: '',
    price: '',
    emergency_price: '',
    image_url: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const handleImageFile = async (file) => {
    if (!file) return;
    setFormError('');
    setImageUploading(true);
    try {
      const res = await uploadServiceImage(file);
      setFormData((prev) => ({ ...prev, image_url: res.data.data.url }));
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchServicesList = async () => {
    setLoading(true);
    try {
      const res = await getServices({
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined
      });
      setServices(res.data.data || []);
    } catch (e) {
      console.error('Failed to load services:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesList();
  }, [selectedCategory]);

  const handleOpenAdd = () => {
    setFormData(initialForm);
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (srv) => {
    setSelectedService(srv);
    setFormData({
      name: srv.name,
      category: srv.category,
      description: srv.description || '',
      price: srv.price,
      emergency_price: srv.emergency_price ?? '',
      image_url: srv.image_url || ''
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name || !formData.category || !formData.price) {
      setFormError('Name, Category, and Price are required.');
      return;
    }
    setSaving(true);
    try {
      await createService(formData);
      showToast('Hospital service created successfully! 🎉');
      setShowAddModal(false);
      fetchServicesList();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await updateService(selectedService.id, formData);
      showToast('Service updated successfully!');
      setShowEditModal(false);
      fetchServicesList();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}"?`)) return;
    try {
      await deleteService(id);
      showToast('Service deactivated.');
      fetchServicesList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete service');
    }
  };

  // Active/Inactive is no longer editable from the Add/Edit form, so a deactivated service needs its own
  // way back — this is the only path left to undo a Delete.
  const handleReactivate = async (id) => {
    try {
      await updateService(id, { is_active: true });
      showToast('Service reactivated.');
      fetchServicesList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reactivate service');
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

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
              Hospital Services & Pricing
            </h1>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>
              Manage clinical consultation packages, surgical procedures, vaccinations, and diagnostic fees
            </p>
          </div>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px',
                fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(27,175,191,0.35)'
              }}
            >
              <span>✨</span> Add New Service
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '9px 18px', borderRadius: '24px', fontSize: '13px', fontWeight: '600',
                border: selectedCategory === cat ? 'none' : '1.5px solid var(--border)',
                background: selectedCategory === cat ? 'var(--primary)' : '#fff',
                color: selectedCategory === cat ? '#fff' : 'var(--text-medium)',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                boxShadow: selectedCategory === cat ? '0 4px 12px rgba(27,175,191,0.3)' : 'none'
              }}
            >
              {cat === 'ALL' ? '🏥 All Services' : cat}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div>Loading hospital services catalog...</div>
          </div>
        ) : services.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <h3 style={{ color: 'var(--text-dark)', fontWeight: '700' }}>No Services In This Category</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-light)', marginTop: '4px' }}>Add a new clinical or grooming service to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {services.map((srv) => (
              <div
                key={srv.id}
                style={{
                  background: '#fff', borderRadius: '16px', padding: '24px',
                  boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                <div>
                  {srv.image_url ? (
                    <img
                      src={srv.image_url}
                      alt={srv.name}
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '10px', marginBottom: '14px' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '120px', borderRadius: '10px', marginBottom: '14px',
                      background: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-light)', fontSize: '12px', fontWeight: '600', textAlign: 'center', padding: '0 12px',
                    }}>
                      No image set — site shows a guessed stock photo
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                      padding: '4px 10px', borderRadius: '10px', background: 'var(--primary-light)',
                      color: 'var(--primary-dark)', letterSpacing: '0.5px'
                    }}>
                      {srv.category}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '8px',
                      background: srv.is_active ? '#e6fffa' : '#fff5f5',
                      color: srv.is_active ? '#234e52' : '#742a2a'
                    }}>
                      {srv.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '8px' }}>
                    {srv.name}
                  </h3>

                  <p style={{ fontSize: '13px', color: 'var(--text-medium)', lineHeight: '1.5', minHeight: '40px' }}>
                    {srv.description || 'Clinical veterinary procedure performed by certified specialists.'}
                  </p>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #edf2f7' }}>
                  <div style={{ marginBottom: canManage ? '14px' : 0 }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '600' }}>Price</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-dark)' }}>
                      ₹{srv.price}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#b45309', marginTop: '4px' }}>
                      🚨 Emergency (9 PM–9 AM): {srv.emergency_price !== null && srv.emergency_price !== undefined ? `₹${srv.emergency_price}` : 'not set'}
                    </div>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEdit(srv)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)',
                          background: '#f8fafc', color: 'var(--text-dark)', fontWeight: '600',
                          fontSize: '13px', cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      {srv.is_active ? (
                        <button
                          onClick={() => handleDelete(srv.id, srv.name)}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', border: 'none',
                            background: '#fed7d7', color: '#742a2a', fontWeight: '600',
                            fontSize: '13px', cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(srv.id)}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', border: 'none',
                            background: '#e6fffa', color: '#234e52', fontWeight: '600',
                            fontSize: '13px', cursor: 'pointer'
                          }}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add/Edit Service */}
        {(showAddModal || showEditModal) && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', maxWidth: '540px', width: '100%',
              padding: '32px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }} className="hide-scrollbar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>
                  {showAddModal ? 'Add Hospital Service' : 'Edit Service'}
                </h2>
                <button
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                  ✕
                </button>
              </div>

              {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{formError}</div>}

              <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit}>
                <div className="form-group">
                  <label className="form-label">Service Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. General Checkup & Vitals"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Image</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Paste an image URL, or upload from your device →"
                      value={formData.image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <label
                      style={{
                        flexShrink: 0, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: imageUploading ? 'var(--bg-light)' : '#fff', color: 'var(--text-dark)',
                        fontWeight: '600', fontSize: '13px', cursor: imageUploading ? 'default' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {imageUploading ? 'Uploading…' : '📁 Upload'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={imageUploading}
                        onChange={(e) => { handleImageFile(e.target.files?.[0]); e.target.value = ''; }}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {formData.image_url && (
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', flexShrink: 0 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
                    Left empty, the site shows a generic stock photo guessed from the service's name instead of a real one.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Category *</label>
                    <select
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      required
                    >
                      {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Emergency price (₹) — visits from 9 PM to 9 AM</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="Leave empty to charge the normal price"
                    value={formData.emergency_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_price: e.target.value }))}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
                    Charged instead of the normal price when the appointment starts between 9 PM and 9 AM. Those visits are also flagged as emergencies.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Provide details about what this service includes..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
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
                    {saving ? 'Saving...' : 'Save Service'}
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

export default ServicesPage;
