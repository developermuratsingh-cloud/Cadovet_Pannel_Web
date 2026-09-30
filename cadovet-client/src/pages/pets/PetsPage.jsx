import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getPets, createPet, updatePet, deletePet } from '../../services/petApi';
import { getCustomers } from '../../services/customerApi';
import { AuthContext } from '../../context/AuthContext';

const SPECIES_ICONS = {
  Dog: '🐕',
  Cat: '🐈',
  Bird: '🦜',
  Rabbit: '🐇',
  Other: '🐾',
};

const PetsPage = () => {
  const { hasPermission } = useContext(AuthContext);
  const [pets, setPets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('ALL');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [toast, setToast] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);

  // Form State
  const initialForm = {
    customer_id: '',
    name: '',
    species: 'Dog',
    breed: '',
    gender: 'MALE',
    date_of_birth: '',
    weight: '',
    color: '',
    microchip_number: '',
    blood_group: '',
    is_vaccinated: false,
    is_neutered: false,
    allergies: '',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchPets = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getPets({
        search,
        species: selectedSpecies,
        page,
        limit: 15
      });
      setPets(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, page: 1, pages: 1 });
    } catch (e) {
      console.error('Failed to load pets:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersList = async () => {
    try {
      const res = await getCustomers({ limit: 100 });
      setCustomers(res.data.data || []);
    } catch (e) {
      console.error('Failed to load customers for dropdown:', e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchPets(1), 300);
    return () => clearTimeout(timer);
  }, [search, selectedSpecies]);

  useEffect(() => {
    fetchCustomersList();
  }, []);

  const handleCreatePet = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.species || !formData.customer_id) {
      setFormError('Please fill in Pet Name, Species, and select an Owner.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createPet(formData);
      setShowAddModal(false);
      setFormData(initialForm);
      fetchPets(1);
      showToast(`🐾 ${formData.name} added successfully!`);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to add pet');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePet = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.species) {
      setFormError('Pet Name and Species are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updatePet(selectedPet.id, formData);
      setShowEditModal(false);
      fetchPets(pagination.page);
      showToast(`🐾 ${formData.name} updated successfully!`);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to update pet');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePet = async (pet) => {
    if (!window.confirm(`Are you sure you want to deactivate ${pet.name}?`)) return;
    try {
      await deletePet(pet.id);
      fetchPets(pagination.page);
      showToast(`${pet.name} has been removed.`);
    } catch (e) {
      showToast('Failed to remove pet.');
    }
  };

  const openEdit = (pet) => {
    setSelectedPet(pet);
    setFormData({
      customer_id: pet.customer_id || '',
      name: pet.name || '',
      species: pet.species || 'Dog',
      breed: pet.breed || '',
      gender: pet.gender || 'MALE',
      date_of_birth: pet.date_of_birth ? pet.date_of_birth.split('T')[0] : '',
      weight: pet.weight || '',
      color: pet.color || '',
      microchip_number: pet.microchip_number || '',
      blood_group: pet.blood_group || '',
      is_vaccinated: Boolean(pet.is_vaccinated),
      is_neutered: Boolean(pet.is_neutered),
      allergies: pet.allergies || '',
      notes: pet.notes || '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const openDetail = (pet) => {
    setSelectedPet(pet);
    setShowDetailModal(true);
  };

  // Stats calculation
  const totalCount = pagination.total || 0;
  const dogCount = pets.filter(p => p.species === 'Dog').length;
  const catCount = pets.filter(p => p.species === 'Cat').length;
  const vaccinatedCount = pets.filter(p => p.is_vaccinated).length;

  return (
    <AdminLayout>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#1BAFBF', color: '#fff', padding: '12px 24px',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          fontSize: '14px', fontWeight: '600'
        }}>
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-dark)' }}>Pets Management</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
            Registered pet patients and health profiles
          </div>
        </div>
        {hasPermission('PET_CREATE') && (
          <button
            onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🐾</span> Add New Pet
          </button>
        )}
      </div>

      {/* Quick Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'rgba(27,175,191,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🐾</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>{totalCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Total Pets</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'rgba(76,175,80,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🐕</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#4CAF50' }}>{dogCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Dogs Listed</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'rgba(255,152,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🐈</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#FF9800' }}>{catCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Cats Listed</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'rgba(156,39,176,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>💉</div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#9C27B0' }}>{vaccinatedCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Vaccinated</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search by pet name, breed, species, or owner..."
          className="form-input"
          style={{ maxWidth: '400px', flex: 1 }}
        />

        {/* Species Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['ALL', 'Dog', 'Cat', 'Bird', 'Rabbit', 'Other'].map(spec => (
            <button
              key={spec}
              onClick={() => setSelectedSpecies(spec)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedSpecies === spec ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: selectedSpecies === spec ? 'rgba(27,175,191,0.12)' : '#fff',
                color: selectedSpecies === spec ? 'var(--primary)' : 'var(--text-medium)',
                fontSize: '12.5px',
                fontWeight: selectedSpecies === spec ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {spec === 'ALL' ? 'All Species' : `${SPECIES_ICONS[spec] || '🐾'} ${spec}`}
            </button>
          ))}
        </div>
      </div>

      {/* Pets Table */}
      <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', fontSize: '14px' }}>Loading pets...</div>
        ) : pets.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🐾</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>No pets found</div>
            <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
              {search ? 'Try adjusting your search criteria' : 'Click "+ Add New Pet" to register a pet patient'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Pet', 'Species & Breed', 'Owner', 'Gender & Age', 'Health Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pets.map((pet, i) => {
                const icon = SPECIES_ICONS[pet.species] || '🐾';
                let ageStr = '—';
                if (pet.date_of_birth) {
                  const birth = new Date(pet.date_of_birth);
                  const years = new Date().getFullYear() - birth.getFullYear();
                  ageStr = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : 'Under 1 yr';
                }

                return (
                  <tr
                    key={pet.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-light)' }}>
                      {(pagination.page - 1) * 15 + i + 1}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(27,175,191,0.2), rgba(247,148,29,0.2))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', flexShrink: 0
                        }}>
                          {icon}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)' }}>{pet.name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-light)' }}>{pet.color || 'Unknown color'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: 'rgba(27,175,191,0.1)', color: 'var(--primary)',
                        padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11.5px', fontWeight: '700', marginRight: '6px'
                      }}>
                        {pet.species}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-medium)' }}>{pet.breed || 'Mixed'}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>{pet.owner_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{pet.owner_mobile || pet.owner_email || '—'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-dark)' }}>{pet.gender} • {ageStr}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{pet.weight ? `${pet.weight} kg` : 'Weight —'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: pet.is_vaccinated ? '#f0fff4' : '#fff5f5',
                          color: pet.is_vaccinated ? '#276749' : '#c53030',
                          border: `1px solid ${pet.is_vaccinated ? '#c6f6d5' : '#fed7d7'}`,
                          borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '11px', fontWeight: '600'
                        }}>
                          {pet.is_vaccinated ? '✓ Vaccinated' : '✕ Not Vaccinated'}
                        </span>
                        {pet.is_neutered && (
                          <span style={{
                            background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #bee3f8',
                            borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '11px', fontWeight: '600'
                          }}>
                            Neutered
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => openDetail(pet)}
                          title="View Pet Profile"
                          style={{
                            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-dark)'
                          }}
                        >
                          👁️ View
                        </button>
                        {hasPermission('PET_UPDATE') && (
                          <button
                            onClick={() => openEdit(pet)}
                            title="Edit Pet"
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                              padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--primary)'
                            }}
                          >
                            ✏️ Edit
                          </button>
                        )}
                        {hasPermission('PET_UPDATE') && (
                          <button
                            onClick={() => handleDeletePet(pet)}
                            title="Deactivate Pet"
                            style={{
                              background: 'none', border: '1px solid #fed7d7', borderRadius: 'var(--radius-sm)',
                              padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#e53e3e'
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => fetchPets(p)}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: pagination.page === p ? 'var(--primary)' : 'var(--border)',
                color: pagination.page === p ? '#fff' : 'var(--text-medium)',
                cursor: 'pointer', fontWeight: '600', fontSize: '13px'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ================= ADD PET MODAL ================= */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', padding: '28px', borderRadius: 'var(--radius-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>🐾 Add New Pet</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>⚠️ {formError}</div>}

            <form onSubmit={handleCreatePet}>
              {/* Owner Selector */}
              <div className="form-group">
                <label className="form-label">Select Pet Parent (Owner) *</label>
                <select
                  className="form-input"
                  value={formData.customer_id}
                  onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.customer_id || c.id} value={c.customer_id || c.id}>
                      {c.name} ({c.email || c.mobile || 'ID: ' + c.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pet Name & Species */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Pet Name *</label>
                  <input
                    className="form-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Max"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Species *</label>
                  <select
                    className="form-input"
                    value={formData.species}
                    onChange={e => setFormData({ ...formData, species: e.target.value })}
                    required
                  >
                    <option value="Dog">🐕 Dog</option>
                    <option value="Cat">🐈 Cat</option>
                    <option value="Bird">🦜 Bird</option>
                    <option value="Rabbit">🐇 Rabbit</option>
                    <option value="Other">🐾 Other</option>
                  </select>
                </div>
              </div>

              {/* Breed & Gender */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Breed</label>
                  <input
                    className="form-input"
                    value={formData.breed}
                    onChange={e => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="e.g. Golden Retriever"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>
              </div>

              {/* Date of Birth & Weight */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date_of_birth}
                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="e.g. 15.5"
                  />
                </div>
              </div>

              {/* Color & Microchip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Color / Markings</label>
                  <input
                    className="form-input"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g. Golden / White patches"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Microchip Number</label>
                  <input
                    className="form-input"
                    value={formData.microchip_number}
                    onChange={e => setFormData({ ...formData, microchip_number: e.target.value })}
                    placeholder="e.g. 981098123456789"
                  />
                </div>
              </div>

              {/* Health Switches */}
              <div style={{ display: 'flex', gap: '24px', margin: '14px 0', padding: '12px', background: 'var(--bg-light)', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_vaccinated}
                    onChange={e => setFormData({ ...formData, is_vaccinated: e.target.checked })}
                  />
                  💉 Vaccinated
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_neutered}
                    onChange={e => setFormData({ ...formData, is_neutered: e.target.checked })}
                  />
                  ✂️ Neutered / Spayed
                </label>
              </div>

              {/* Allergies & Notes */}
              <div className="form-group">
                <label className="form-label">Known Allergies</label>
                <input
                  className="form-input"
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="e.g. Chicken protein allergy, pollen sensitivity"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Medical / Behavioral Notes</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special diet, behavior around other pets, etc."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {saving ? '⏳ Saving...' : '✓ Add Pet'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1, padding: '12px', background: 'var(--bg-light)',
                    border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', fontSize: '14px', fontFamily: 'Poppins, sans-serif'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT PET MODAL ================= */}
      {showEditModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', padding: '28px', borderRadius: 'var(--radius-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>✏️ Edit Pet — {selectedPet?.name}</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>⚠️ {formError}</div>}

            <form onSubmit={handleUpdatePet}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Pet Name *</label>
                  <input
                    className="form-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Species *</label>
                  <select
                    className="form-input"
                    value={formData.species}
                    onChange={e => setFormData({ ...formData, species: e.target.value })}
                    required
                  >
                    <option value="Dog">🐕 Dog</option>
                    <option value="Cat">🐈 Cat</option>
                    <option value="Bird">🦜 Bird</option>
                    <option value="Rabbit">🐇 Rabbit</option>
                    <option value="Other">🐾 Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Breed</label>
                  <input
                    className="form-input"
                    value={formData.breed}
                    onChange={e => setFormData({ ...formData, breed: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date_of_birth}
                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Color / Markings</label>
                  <input
                    className="form-input"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Microchip Number</label>
                  <input
                    className="form-input"
                    value={formData.microchip_number}
                    onChange={e => setFormData({ ...formData, microchip_number: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', margin: '14px 0', padding: '12px', background: 'var(--bg-light)', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_vaccinated}
                    onChange={e => setFormData({ ...formData, is_vaccinated: e.target.checked })}
                  />
                  💉 Vaccinated
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_neutered}
                    onChange={e => setFormData({ ...formData, is_neutered: e.target.checked })}
                  />
                  ✂️ Neutered / Spayed
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Known Allergies</label>
                <input
                  className="form-input"
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Medical Notes</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {saving ? '⏳ Updating...' : '✓ Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    flex: 1, padding: '12px', background: 'var(--bg-light)',
                    border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', fontSize: '14px', fontFamily: 'Poppins, sans-serif'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= VIEW DETAIL MODAL ================= */}
      {showDetailModal && selectedPet && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '30px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px'
                }}>
                  {SPECIES_ICONS[selectedPet.species] || '🐾'}
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)', margin: 0 }}>{selectedPet.name}</h2>
                  <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {selectedPet.species} • {selectedPet.breed || 'Breed Unspecified'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Profile Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-light)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Owner</div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>{selectedPet.owner_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{selectedPet.owner_mobile || selectedPet.owner_email}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Gender & Weight</div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>{selectedPet.gender} • {selectedPet.weight ? `${selectedPet.weight} kg` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Date of Birth</div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>
                  {selectedPet.date_of_birth ? new Date(selectedPet.date_of_birth).toLocaleDateString('en-IN') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Blood Group</div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>{selectedPet.blood_group || '—'}</div>
              </div>
            </div>

            {/* Health Highlights */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)',
                background: selectedPet.is_vaccinated ? '#f0fff4' : '#fff5f5',
                border: `1px solid ${selectedPet.is_vaccinated ? '#c6f6d5' : '#fed7d7'}`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '16px' }}>{selectedPet.is_vaccinated ? '💉' : '⚠️'}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: selectedPet.is_vaccinated ? '#276749' : '#c53030' }}>
                  {selectedPet.is_vaccinated ? 'Vaccinated' : 'Unvaccinated'}
                </div>
              </div>
              <div style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)',
                background: selectedPet.is_neutered ? '#ebf8ff' : '#fafafa',
                border: `1px solid ${selectedPet.is_neutered ? '#bee3f8' : 'var(--border)'}`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '16px' }}>✂️</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: selectedPet.is_neutered ? '#2b6cb0' : 'var(--text-medium)' }}>
                  {selectedPet.is_neutered ? 'Neutered / Spayed' : 'Intact'}
                </div>
              </div>
            </div>

            {/* Microchip & Allergies */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)' }}>Microchip Number:</div>
              <div style={{ fontSize: '13px', color: 'var(--text-medium)' }}>{selectedPet.microchip_number || 'None registered'}</div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)' }}>Known Allergies:</div>
              <div style={{ fontSize: '13px', color: selectedPet.allergies ? '#e53e3e' : 'var(--text-medium)' }}>
                {selectedPet.allergies || 'None reported'}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)' }}>Notes:</div>
              <div style={{ fontSize: '13px', color: 'var(--text-medium)', background: '#fafafa', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                {selectedPet.notes || 'No special medical or behavioral notes.'}
              </div>
            </div>

            <button
              onClick={() => setShowDetailModal(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default PetsPage;
