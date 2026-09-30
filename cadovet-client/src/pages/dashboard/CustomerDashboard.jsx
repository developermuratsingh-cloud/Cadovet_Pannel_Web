import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { getPets, createPet, updatePet, deletePet } from '../../services/petApi';
import { getAppointments, createAppointment, cancelAppointment, getAvailability } from '../../services/appointmentApi';
import { getMedicalRecords } from '../../services/medicalRecordApi';
import { getInvoices } from '../../services/invoiceApi';
import { getServices } from '../../services/serviceApi';
import { getDoctors } from '../../services/doctorApi';
import { getDocuments, getDocumentLink, resolveDocumentUrl } from '../../services/documentApi';
import { getPublicLocations } from '../../services/locationApi';

const SPECIES_ICONS = {
  Dog: '🐕',
  Cat: '🐈',
  Bird: '🦜',
  Rabbit: '🐇',
  Other: '🐾',
};

const CustomerDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'pets' | 'appointments' | 'medical' | 'invoices'
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [prescriptionDocs, setPrescriptionDocs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [toast, setToast] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);

  // Form State
  const initialForm = {
    name: '',
    species: 'Dog',
    breed: '',
    gender: 'MALE',
    date_of_birth: '',
    weight: '',
    color: '',
    microchip_number: '',
    blood_group: '',
    is_vaccinated: true,
    is_neutered: false,
    allergies: '',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    pet_id: '',
    service_id: '',
    location_id: '',
    preferred_date: new Date().toISOString().split('T')[0],
    preferred_time: '',
    notes: '',
  });

  // Which branches exist — a picker only shows up if there's more than one; a single-branch clinic never bothers
  // the customer with the choice.
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    getPublicLocations().then((res) => {
      const locs = res.data.data || [];
      setLocations(locs);
      if (locs.length === 1) setBookingForm((f) => ({ ...f, location_id: locs[0].id }));
    }).catch(() => {});
  }, []);

  // The clinic's free times for the chosen date at the chosen branch. A customer picks a time, not a doctor: the
  // operational head assigns one.
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  useEffect(() => {
    if (!showBookingModal || !bookingForm.preferred_date) return undefined;
    let live = true;
    setLoadingSlots(true);
    getAvailability({ date: bookingForm.preferred_date, location_id: bookingForm.location_id || undefined })
      .then((r) => { if (live) { setSlots(r.data.data.slots || []); setBookingForm((f) => ({ ...f, preferred_time: '' })); } })
      .catch(() => live && setSlots([]))
      .finally(() => live && setLoadingSlots(false));
    return () => { live = false; };
  }, [showBookingModal, bookingForm.preferred_date, bookingForm.location_id]);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchCustomerData = async () => {
    setLoadingPets(true);
    try {
      const [petsRes, apptRes, mrRes, invRes, srvRes, docRes, rxDocRes] = await Promise.allSettled([
        getPets({ limit: 50 }),
        getAppointments({ limit: 50 }),
        getMedicalRecords({ limit: 50 }),
        getInvoices({ limit: 50 }),
        getServices({ is_active: true }),
        getDoctors({ limit: 50 }),
        getDocuments({ category: 'PRESCRIPTION' })
      ]);
      if (petsRes.status === 'fulfilled') setPets(petsRes.value.data.data || []);
      if (apptRes.status === 'fulfilled') setAppointments(apptRes.value.data.data || []);
      if (mrRes.status === 'fulfilled') setMedicalRecords(mrRes.value.data.data || []);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.data.data || []);
      if (srvRes.status === 'fulfilled') setServices(srvRes.value.data.data || []);
      if (docRes.status === 'fulfilled') setDoctors(docRes.value.data.data || []);
      if (rxDocRes.status === 'fulfilled') setPrescriptionDocs(rxDocRes.value.data.data || []);
    } catch (e) {
      console.error('Failed to load customer workspace data:', e);
    } finally {
      setLoadingPets(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const handleCreatePet = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.species) {
      setFormError('Pet name and species are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createPet(formData);
      setShowAddModal(false);
      setFormData(initialForm);
      await fetchMyPets();
      showToastMsg(`🐾 ${formData.name} was successfully registered!`);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to add pet');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePet = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.species) {
      setFormError('Pet name and species are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updatePet(selectedPet.id, formData);
      setShowEditModal(false);
      await fetchMyPets();
      showToastMsg(`🐾 ${formData.name}'s info was updated!`);
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to update pet');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePet = async (pet) => {
    if (!window.confirm(`Are you sure you want to remove ${pet.name} from your profile?`)) return;
    try {
      await deletePet(pet.id);
      await fetchMyPets();
      showToastMsg(`${pet.name} has been removed.`);
    } catch (e) {
      showToastMsg('Failed to remove pet.');
    }
  };

  const openEdit = (pet) => {
    setSelectedPet(pet);
    setFormData({
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

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingForm.pet_id || !bookingForm.preferred_date || !bookingForm.preferred_time) {
      alert('Please choose a pet, a date and a time for the appointment.');
      return;
    }
    if (locations.length > 1 && !bookingForm.location_id) {
      alert('Please choose which branch you\'d like to visit.');
      return;
    }
    try {
      await createAppointment({
        pet_id: bookingForm.pet_id,
        service_id: bookingForm.service_id || null,
        location_id: bookingForm.location_id || undefined,
        source: 'WEBSITE',
        appointment_date: bookingForm.preferred_date,
        appointment_time: bookingForm.preferred_time,
        reason: bookingForm.notes || 'Veterinary Consultation'
      });
      setShowBookingModal(false);
      showToastMsg('✅ Request sent! Our team will assign a doctor and confirm your visit shortly.');
      fetchCustomerData();
      setActiveTab('appointments');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to book appointment');
    }
  };

  const handleCancelAppt = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await cancelAppointment(id);
      showToastMsg('Appointment cancelled.');
      fetchCustomerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel appointment');
    }
  };

  // A visit still ahead of the customer: not yet completed/cancelled, and its date hasn't passed.
  const upcomingCount = appointments.filter(a =>
    ['PENDING', 'CONFIRMED'].includes(a.status) && String(a.appointment_date).slice(0, 10) >= new Date().toISOString().split('T')[0]
  ).length;

  const menuItems = [
    { icon: '🐾', title: 'My Pets', desc: `${pets.length} pet${pets.length === 1 ? '' : 's'} registered`, bg: '#1BAFBF', action: () => setActiveTab('pets') },
    { icon: '📅', title: 'Book Appointment', desc: 'Schedule a clinic visit', bg: '#4CAF50', action: () => setShowBookingModal(true) },
    { icon: '📋', title: 'My Appointments', desc: `${appointments.length} scheduled visits`, bg: '#FF9800', action: () => setActiveTab('appointments') },
    // Counts both a doctor's typed-up visit note and a scanned/photographed prescription — a photo-only
    // prescription with no separate clinical note previously showed as "0 clinical records" here, hiding it.
    { icon: '💊', title: 'Prescriptions', desc: `${medicalRecords.length + prescriptionDocs.length} record${medicalRecords.length + prescriptionDocs.length === 1 ? '' : 's'}`, bg: '#E91E63', action: () => setActiveTab('medical') },
    { icon: '💳', title: 'Billing & Receipts', desc: `${invoices.length} invoices`, bg: '#9C27B0', action: () => setActiveTab('invoices') },
    { icon: '💉', title: 'Vaccinations', desc: `${pets.filter(p => p.is_vaccinated).length} vaccinated`, bg: '#2196F3', action: () => setActiveTab('pets') },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)', fontFamily: 'Poppins, sans-serif' }}>
      {/* Toast Notification */}
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

      {/* Announcement Bar */}
      <div className="announcement-bar" style={{ background: '#1a2332', color: '#fff', padding: '8px 24px', fontSize: '12px', textAlign: 'center' }}>
        🚨 24X7 Emergency &amp; Veterinary Ambulance — Call Emergency Desk: <strong>+91 922 041 0777</strong>
      </div>

      {/* Header */}
      <header style={{
        background: '#fff',
        boxShadow: 'var(--shadow-sm)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '68px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
          }}>🐾</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.3px' }}>CADOVET</div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Pet Parent Portal</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              background: activeTab === 'overview' ? 'rgba(27,175,191,0.12)' : 'none',
              color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-medium)',
              border: activeTab === 'overview' ? '1.5px solid var(--primary)' : '1px solid transparent',
              padding: '7px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600'
            }}
          >
            🏠 Overview
          </button>
          <button
            onClick={() => setActiveTab('pets')}
            style={{
              background: activeTab === 'pets' ? 'rgba(27,175,191,0.12)' : 'none',
              color: activeTab === 'pets' ? 'var(--primary)' : 'var(--text-medium)',
              border: activeTab === 'pets' ? '1.5px solid var(--primary)' : '1px solid transparent',
              padding: '7px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600'
            }}
          >
            🐾 My Pets ({pets.length})
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            style={{
              background: activeTab === 'appointments' ? 'rgba(27,175,191,0.12)' : 'none',
              color: activeTab === 'appointments' ? 'var(--primary)' : 'var(--text-medium)',
              border: activeTab === 'appointments' ? '1.5px solid var(--primary)' : '1px solid transparent',
              padding: '7px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600'
            }}
          >
            📅 Appointments ({appointments.length})
          </button>
          <button
            onClick={() => setActiveTab('medical')}
            style={{
              background: activeTab === 'medical' ? 'rgba(27,175,191,0.12)' : 'none',
              color: activeTab === 'medical' ? 'var(--primary)' : 'var(--text-medium)',
              border: activeTab === 'medical' ? '1.5px solid var(--primary)' : '1px solid transparent',
              padding: '7px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600'
            }}
          >
            🩺 Medical & Rx ({medicalRecords.length + prescriptionDocs.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            style={{
              background: activeTab === 'invoices' ? 'rgba(27,175,191,0.12)' : 'none',
              color: activeTab === 'invoices' ? 'var(--primary)' : 'var(--text-medium)',
              border: activeTab === 'invoices' ? '1.5px solid var(--primary)' : '1px solid transparent',
              padding: '7px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600'
            }}
          >
            💳 Invoices ({invoices.length})
          </button>
        </div>

        {/* User / Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: '#fff', fontWeight: '700'
          }}>
            {user?.name?.[0]?.toUpperCase() || '👤'}
          </div>
          <div style={{ display: 'none', md: 'block' }}>
            <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>{user?.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Pet Parent</div>
          </div>
          <button onClick={logout} style={{
            background: 'none', border: '1.5px solid var(--border)',
            color: 'var(--text-medium)', padding: '6px 16px', borderRadius: 'var(--radius-full)',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'Poppins, sans-serif', transition: 'all 0.2s'
          }}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ padding: '32px 24px', maxWidth: '1120px', margin: '0 auto' }}>
        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === 'overview' && (
          <>
            {/* Welcome Banner */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, #0d9aaa 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 32px',
              color: '#fff',
              marginBottom: '28px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{ position: 'absolute', right: -20, top: -20, fontSize: '130px', opacity: 0.1 }}>🐾</div>
              <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '4px' }}>👋 Welcome back,</div>
              <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>{user?.name}!</h1>
              <p style={{ fontSize: '14px', opacity: 0.9, maxWidth: '480px', lineHeight: 1.5 }}>
                Manage your pet's healthcare, view vaccination records, and schedule consultations with top veterinarians.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="btn-secondary"
                  style={{ padding: '10px 22px', fontSize: '13.5px', fontWeight: '700' }}
                >
                  📅 Book Appointment
                </button>
                <button
                  onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
                  style={{
                    padding: '10px 22px', fontSize: '13.5px', fontWeight: '700',
                    background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer'
                  }}
                >
                  + Add New Pet
                </button>
              </div>
            </div>

            {/* Dynamic Quick Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '32px'
            }}>
              <div
                onClick={() => setActiveTab('pets')}
                style={{
                  background: '#fff', borderRadius: 'var(--radius-md)', padding: '20px',
                  boxShadow: 'var(--shadow-sm)', textAlign: 'center', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '6px' }}>🐾</div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)' }}>
                  {loadingPets ? '...' : pets.length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '600' }}>My Registered Pets</div>
              </div>

              <div
                onClick={() => setShowBookingModal(true)}
                style={{
                  background: '#fff', borderRadius: 'var(--radius-md)', padding: '20px',
                  boxShadow: 'var(--shadow-sm)', textAlign: 'center', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '6px' }}>📅</div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#4CAF50' }}>{upcomingCount}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '600' }}>Upcoming Visit{upcomingCount === 1 ? '' : 's'}</div>
              </div>

              <div
                style={{
                  background: '#fff', borderRadius: 'var(--radius-md)', padding: '20px',
                  boxShadow: 'var(--shadow-sm)', textAlign: 'center', border: '1px solid var(--border)'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '6px' }}>💉</div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#9C27B0' }}>
                  {pets.filter(p => p.is_vaccinated).length} / {pets.length}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '600' }}>Vaccination Status</div>
              </div>
            </div>

            {/* Quick Pets Preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>My Pets</h2>
              <button
                onClick={() => setActiveTab('pets')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer' }}
              >
                View All ({pets.length}) →
              </button>
            </div>

            {loadingPets ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>Loading pets...</div>
            ) : pets.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '44px', marginBottom: '10px' }}>🐾</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>No pets registered yet</div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px', marginBottom: '16px' }}>
                  Add your dog, cat, or other pet to manage vaccinations and appointments.
                </div>
                <button
                  onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
                  className="btn-primary"
                  style={{ padding: '9px 20px', fontSize: '13.5px' }}
                >
                  + Add Your First Pet
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {pets.slice(0, 3).map(pet => (
                  <div
                    key={pet.id}
                    className="card"
                    style={{ padding: '20px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => openDetail(pet)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(27,175,191,0.2), rgba(247,148,29,0.2))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
                      }}>
                        {SPECIES_ICONS[pet.species] || '🐾'}
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)' }}>{pet.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{pet.species} • {pet.breed || 'Mixed'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <span style={{
                        background: pet.is_vaccinated ? '#f0fff4' : '#fff5f5',
                        color: pet.is_vaccinated ? '#276749' : '#c53030',
                        padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: '600'
                      }}>
                        {pet.is_vaccinated ? '✓ Vaccinated' : '⚠️ Due for shots'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>View Profile →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Portal Modules Grid */}
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '16px' }}>Services &amp; Health Hub</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              {menuItems.map(({ icon, title, desc, bg, action }) => (
                <div
                  key={title}
                  onClick={action}
                  style={{
                    background: '#fff', borderRadius: 'var(--radius-md)', padding: '22px 20px',
                    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = bg; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                    background: `${bg}15`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '22px', marginBottom: '12px'
                  }}>
                    {icon}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '4px' }}>{title}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-light)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ================= MY PETS TAB ================= */}
        {activeTab === 'pets' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-dark)' }}>My Pets</h1>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
                  Keep track of all your pets' medical profiles and vaccinations
                </div>
              </div>
              <button
                onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>🐾</span> Add New Pet
              </button>
            </div>

            {loadingPets ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>Loading your pets...</div>
            ) : pets.length === 0 ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '14px' }}>🐾</div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>No pets registered yet</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-light)', maxWidth: '400px', margin: '8px auto 20px' }}>
                  Register your pet to easily book appointments, track vaccination schedules, and store medical records.
                </p>
                <button
                  onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
                  className="btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  + Add New Pet
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {pets.map(pet => {
                  const icon = SPECIES_ICONS[pet.species] || '🐾';
                  let ageStr = '—';
                  if (pet.date_of_birth) {
                    const birth = new Date(pet.date_of_birth);
                    const years = new Date().getFullYear() - birth.getFullYear();
                    ageStr = years > 0 ? `${years} year${years > 1 ? 's' : ''} old` : 'Under 1 year';
                  }

                  return (
                    <div
                      key={pet.id}
                      className="card"
                      style={{
                        padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        {/* Pet Card Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(27,175,191,0.2), rgba(247,148,29,0.2))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0
                          }}>
                            {icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)', margin: 0 }}>{pet.name}</h3>
                              <span style={{
                                background: 'rgba(27,175,191,0.1)', color: 'var(--primary)',
                                padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: '700'
                              }}>
                                {pet.species}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
                              {pet.breed || 'Breed Mixed'} • {pet.gender}
                            </div>
                          </div>
                        </div>

                        {/* Pet Key Details */}
                        <div style={{
                          background: 'var(--bg-light)', padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', fontSize: '12px'
                        }}>
                          <div>
                            <span style={{ color: 'var(--text-light)' }}>Age: </span>
                            <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{ageStr}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-light)' }}>Weight: </span>
                            <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{pet.weight ? `${pet.weight} kg` : '—'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-light)' }}>Color: </span>
                            <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{pet.color || '—'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-light)' }}>Blood: </span>
                            <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{pet.blood_group || '—'}</span>
                          </div>
                        </div>

                        {/* Health Status Badges */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          <span style={{
                            background: pet.is_vaccinated ? '#f0fff4' : '#fff5f5',
                            color: pet.is_vaccinated ? '#276749' : '#c53030',
                            border: `1px solid ${pet.is_vaccinated ? '#c6f6d5' : '#fed7d7'}`,
                            borderRadius: 'var(--radius-full)', padding: '2px 10px', fontSize: '11px', fontWeight: '600'
                          }}>
                            {pet.is_vaccinated ? '✓ Vaccinated' : '⚠️ Unvaccinated'}
                          </span>
                          {pet.is_neutered && (
                            <span style={{
                              background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #bee3f8',
                              borderRadius: 'var(--radius-full)', padding: '2px 10px', fontSize: '11px', fontWeight: '600'
                            }}>
                              ✂️ Neutered
                            </span>
                          )}
                        </div>

                        {pet.allergies && (
                          <div style={{ fontSize: '12px', color: '#e53e3e', marginBottom: '12px', background: '#fff5f5', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                            ⚠️ Allergy: {pet.allergies}
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        <button
                          onClick={() => openDetail(pet)}
                          style={{
                            flex: 1, padding: '7px 0', background: 'none', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                            color: 'var(--text-dark)'
                          }}
                        >
                          👁️ Profile
                        </button>
                        <button
                          onClick={() => openEdit(pet)}
                          style={{
                            flex: 1, padding: '7px 0', background: 'none', border: '1px solid var(--primary)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                            color: 'var(--primary)'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeletePet(pet)}
                          style={{
                            padding: '7px 12px', background: 'none', border: '1px solid #fed7d7',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px',
                            color: '#e53e3e'
                          }}
                          title="Remove Pet"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= APPOINTMENTS TAB ================= */}
        {activeTab === 'appointments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>My Veterinary Visits</h2>
                <p style={{ color: 'var(--text-light)', fontSize: '13.5px', marginTop: '2px' }}>
                  Track your scheduled appointments, consultation times, and doctor assignments
                </p>
              </div>
              <button
                onClick={() => setShowBookingModal(true)}
                className="btn-primary"
                style={{ padding: '10px 22px', fontSize: '13.5px' }}
              >
                📅 Book New Visit
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
                <h3 style={{ fontWeight: '700', color: 'var(--text-dark)' }}>No Appointments Yet</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-light)', marginTop: '4px' }}>
                  You haven't scheduled any veterinary appointments yet.
                </p>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="btn-primary"
                  style={{ marginTop: '16px', padding: '10px 24px' }}
                >
                  Schedule Your First Visit
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {appointments.map(appt => (
                  <div key={appt.id} className="card" style={{ padding: '22px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>🐾</span>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-dark)' }}>{appt.pet_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{appt.pet_species} • {appt.pet_breed || 'Standard'}</div>
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                        background: appt.status === 'CONFIRMED' ? '#e6fffa' : appt.status === 'COMPLETED' ? '#f0fff4' : appt.status === 'PENDING' ? '#fffaf0' : '#fff5f5',
                        color: appt.status === 'CONFIRMED' ? '#234e52' : appt.status === 'COMPLETED' ? '#22543d' : appt.status === 'PENDING' ? '#7b341e' : '#742a2a'
                      }}>
                        {appt.status === 'PENDING' ? 'AWAITING CONFIRMATION' : appt.status}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-light)', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--primary-dark)' }}>
                        📅 {new Date(appt.appointment_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ color: 'var(--text-medium)', marginTop: '2px' }}>⏰ Time: {appt.appointment_time}</div>
                      {appt.is_emergency && <div style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', background: '#fee2e2', color: '#b91c1c' }}>🚨 EMERGENCY VISIT</div>}
                      <div style={{ color: 'var(--text-medium)', marginTop: '2px' }}>🩺 Doctor: {appt.doctor_name || 'To be assigned'}</div>
                      {appt.service_name && (
                        <div style={{ color: 'var(--text-dark)', fontWeight: '600', marginTop: '2px' }}>
                          ✨ {appt.service_name} (₹{appt.charged_price ?? appt.service_price})
                        </div>
                      )}
                    </div>

                    {appt.reason && (
                      <div style={{ fontSize: '12px', color: 'var(--text-medium)', marginBottom: '12px' }}>
                        <strong>Reason:</strong> {appt.reason}
                      </div>
                    )}

                    {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #edf2f7', paddingTop: '10px' }}>
                        <button
                          onClick={() => handleCancelAppt(appt.id)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', border: '1px solid #fed7d7',
                            background: '#fff5f5', color: '#c53030', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                          }}
                        >
                          Cancel Appointment
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= MEDICAL RECORDS & RX TAB ================= */}
        {activeTab === 'medical' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>Medical Records & Digital Prescriptions</h2>
              <p style={{ color: 'var(--text-light)', fontSize: '13.5px', marginTop: '2px' }}>
                View your pets' clinical examination notes, doctor diagnoses, and prescribed medication plans
              </p>
            </div>

            {prescriptionDocs.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '10px' }}>
                  📎 Prescriptions from your doctor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {prescriptionDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={async () => {
                        try {
                          const res = await getDocumentLink(doc.id);
                          window.open(resolveDocumentUrl(res.data.data.path), '_blank', 'noopener');
                        } catch (e) {
                          showToastMsg('Could not open this file right now');
                        }
                      }}
                      className="card"
                      style={{ padding: '14px 16px', textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer', background: '#fff' }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--primary)' }}>{doc.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                        {doc.pet_name ? `${doc.pet_name} • ` : ''}{new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {medicalRecords.length === 0 && prescriptionDocs.length === 0 ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🩺</div>
                <h3 style={{ fontWeight: '700', color: 'var(--text-dark)' }}>No Clinical Records Found</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-light)', marginTop: '4px' }}>
                  Doctor examination notes and prescriptions will appear here after a veterinary visit.
                </p>
              </div>
            ) : medicalRecords.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {medicalRecords.map(rec => (
                  <div key={rec.id} className="card" style={{ padding: '24px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                        }}>
                          🩺
                        </div>
                        <div>
                          <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-dark)' }}>
                            {rec.pet_name} — {rec.diagnosis}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                            Visit Date: {new Date(rec.visit_date).toLocaleDateString()} • Attending: {rec.doctor_name || 'Clinic Team'}
                          </div>
                        </div>
                      </div>

                      {rec.weight_kg && (
                        <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '10px', background: 'var(--bg-light)', color: 'var(--text-dark)' }}>
                          Weight: {rec.weight_kg} kg
                        </span>
                      )}
                    </div>

                    {rec.treatment_notes && (
                      <div style={{ fontSize: '13px', color: 'var(--text-medium)', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '14px' }}>
                        <strong>Doctor's Advice:</strong> {rec.treatment_notes}
                      </div>
                    )}

                    {rec.prescriptions && rec.prescriptions.length > 0 && (
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '8px' }}>
                          💊 Prescribed Medications:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                          {rec.prescriptions.map((rx, idx) => (
                            <div key={idx} style={{ background: '#ebf8ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bee3f8' }}>
                              <div style={{ fontWeight: '700', fontSize: '13px', color: '#2b6cb0' }}>{rx.medicine_name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-medium)', marginTop: '2px' }}>
                                {rx.dosage} • {rx.frequency} ({rx.duration_days} days)
                              </div>
                              {rx.instructions && (
                                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                                  Instructions: {rx.instructions}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= INVOICES TAB ================= */}
        {activeTab === 'invoices' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>Billing Statements & Receipts</h2>
              <p style={{ color: 'var(--text-light)', fontSize: '13.5px', marginTop: '2px' }}>
                Review hospital treatment invoices, medication fees, and payment status
              </p>
            </div>

            {invoices.length === 0 ? (
              <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
                <h3 style={{ fontWeight: '700', color: 'var(--text-dark)' }}>No Invoices Issued</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-light)', marginTop: '4px' }}>
                  Invoices for consultations and pharmacy orders will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {invoices.map(inv => (
                  <div key={inv.id} className="card" style={{ padding: '22px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontFamily: 'monospace', fontSize: '15px', color: 'var(--primary-dark)' }}>
                          {inv.invoice_number}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                          {new Date(inv.invoice_date).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                        background: inv.payment_status === 'PAID' ? '#f0fff4' : '#fffaf0',
                        color: inv.payment_status === 'PAID' ? '#22543d' : '#7b341e'
                      }}>
                        {inv.payment_status}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-light)', padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-light)' }}>Patient:</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{inv.pet_name || 'General Clinic'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-light)' }}>Payment Method:</span>
                        <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{inv.payment_method}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '6px' }}>
                        <span>Total Paid:</span>
                        <span style={{ color: 'var(--primary-dark)' }}>₹{inv.total_amount}</span>
                      </div>
                    </div>

                    {inv.notes && (
                      <div style={{ fontSize: '12px', color: 'var(--text-medium)' }}>
                        <strong>Details:</strong> {inv.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= ADD PET MODAL ================= */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '540px', padding: '28px', borderRadius: 'var(--radius-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>🐾 Register Your Pet</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>⚠️ {formError}</div>}

            <form onSubmit={handleCreatePet}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Pet Name *</label>
                  <input
                    className="form-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Charlie"
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
                    placeholder="e.g. Labrador Retriever"
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
                    placeholder="e.g. 12.5"
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
                    placeholder="e.g. Brown / White"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Microchip No. (if any)</label>
                  <input
                    className="form-input"
                    value={formData.microchip_number}
                    onChange={e => setFormData({ ...formData, microchip_number: e.target.value })}
                    placeholder="e.g. 981098123"
                  />
                </div>
              </div>

              {/* Switches */}
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
                <label className="form-label">Known Allergies (if any)</label>
                <input
                  className="form-input"
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="e.g. Sensitive to certain kibble"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes for the Vet</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special habits, previous medical history, etc."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {saving ? '⏳ Registering...' : '✓ Register Pet'}
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
          <div className="card" style={{ width: '100%', maxWidth: '540px', padding: '28px', borderRadius: 'var(--radius-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
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
                  <label className="form-label">Color</label>
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
                <label className="form-label">Notes for the Vet</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {saving ? '⏳ Saving...' : '✓ Save Changes'}
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
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '28px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 50, height: 50, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px'
                }}>
                  {SPECIES_ICONS[selectedPet.species] || '🐾'}
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)', margin: 0 }}>{selectedPet.name}</h2>
                  <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {selectedPet.species} • {selectedPet.breed || 'Mixed'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--bg-light)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Gender &amp; Weight</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{selectedPet.gender} • {selectedPet.weight ? `${selectedPet.weight} kg` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Date of Birth</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>
                  {selectedPet.date_of_birth ? new Date(selectedPet.date_of_birth).toLocaleDateString('en-IN') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Color</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{selectedPet.color || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Blood Group</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{selectedPet.blood_group || '—'}</div>
              </div>
            </div>

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

            {selectedPet.allergies && (
              <div style={{ marginBottom: '14px', fontSize: '13px', color: '#c53030', background: '#fff5f5', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <strong>⚠️ Known Allergies:</strong> {selectedPet.allergies}
              </div>
            )}

            {selectedPet.notes && (
              <div style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--text-dark)', background: '#fafafa', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <strong>Notes:</strong> {selectedPet.notes}
              </div>
            )}

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

      {/* ================= BOOK APPOINTMENT MODAL ================= */}
      {showBookingModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '28px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>📅 Schedule Veterinary Visit</h3>
              <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleBookAppointment}>
              <div className="form-group">
                <label className="form-label">Select Pet *</label>
                <select
                  className="form-input"
                  value={bookingForm.pet_id}
                  onChange={e => setBookingForm({ ...bookingForm, pet_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Your Pet --</option>
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.species} - {p.breed || 'Mixed'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Service Required</label>
                <select
                  className="form-input"
                  value={bookingForm.service_id}
                  onChange={e => setBookingForm({ ...bookingForm, service_id: e.target.value })}
                >
                  <option value="">-- Choose Hospital Service --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (₹{s.price}{s.emergency_price !== null && s.emergency_price !== undefined ? ` · ₹${s.emergency_price} from 9 PM to 9 AM` : ''})</option>
                  ))}
                </select>
              </div>

              {locations.length > 1 && (
                <div className="form-group">
                  <label className="form-label">Branch *</label>
                  <select
                    className="form-input"
                    value={bookingForm.location_id}
                    onChange={e => setBookingForm({ ...bookingForm, location_id: e.target.value })}
                    required
                  >
                    <option value="">-- Choose a Branch --</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Preferred Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bookingForm.preferred_date}
                    onChange={e => setBookingForm({ ...bookingForm, preferred_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Time *</label>
                  <select
                    className="form-input"
                    value={bookingForm.preferred_time}
                    onChange={e => setBookingForm({ ...bookingForm, preferred_time: e.target.value })}
                    disabled={loadingSlots || slots.length === 0}
                    required
                  >
                    <option value="">{loadingSlots ? 'Loading times…' : slots.length ? 'Select a time' : 'No times available that day'}</option>
                    {slots.map((sl) => <option key={sl.time} value={sl.time} disabled={!sl.available}>{sl.time}{sl.emergency ? ' 🚨 emergency' : ''}{sl.available ? '' : ' — full'}</option>)}
                  </select>
                </div>
              </div>

              {(() => {
                // A visit that starts between 9 PM and 9 AM is an emergency visit; say so, and what it costs, before booking.
                const chosen = slots.find((sl) => sl.time === bookingForm.preferred_time);
                if (!chosen || !chosen.emergency) return null;
                const svc = services.find((s) => String(s.id) === String(bookingForm.service_id));
                const price = svc ? (svc.emergency_price ?? svc.price) : null;
                return (
                  <div role="note" data-testid="emergency-note" style={{ marginBottom: '14px', padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}>
                    🚨 Emergency hours (9 PM – 9 AM). This visit is handled as an emergency{price !== null ? ` — ${svc.name} costs ₹${price}.` : '.'}
                  </div>
                );
              })()}

              <div className="form-group">
                <label className="form-label">Reason for Visit / Symptoms</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={bookingForm.notes}
                  onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  placeholder="Describe symptoms or reasons for visit..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  ✓ Request Appointment
                </button>
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
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
    </div>
  );
};

export default CustomerDashboard;
