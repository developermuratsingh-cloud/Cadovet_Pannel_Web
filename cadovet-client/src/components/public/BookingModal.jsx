import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { API_URL } from '../../config';
import { TIME_SLOTS, EMERGENCY_HOURS_TEXT, isEmergencySlot, slotDate, priceFor } from '../../constants/emergency';

const BookingModal = () => {
  const { bookingModalItem, closeBookingModal, showToast } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    owner_name: '',
    phone: '',
    email: '',
    pet_name: '',
    species: '',
    breed: '',
    age_years: '',
    gender: '',
    is_aggressive: '',
    appointment_date: '',
    slot_index: '', // position in TIME_SLOTS (09:00 AM appears twice: the first and the last)
    address: '',
    notes: '',
    payment_method: ''
  });

  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!bookingModalItem) return null;

  // In emergency hours the service costs its emergency price. The server works this out again and is the authority.
  const emergency = isEmergencySlot(form.slot_index);
  const price = priceFor(bookingModalItem, emergency, bookingModalItem.price);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.owner_name.trim() || !form.phone.trim() || !form.pet_name.trim() || !form.species.trim()
      || !form.breed.trim() || !form.age_years || !form.gender || !form.is_aggressive || !form.appointment_date || form.slot_index === ''
      || !form.address.trim() || !form.notes.trim() || !form.payment_method) {
      setErrorMsg('Please complete all booking fields. Email is optional.');
      return;
    }
    if (form.owner_name.trim().length > 30) {
      setErrorMsg('Owner name must be 30 characters or fewer.');
      return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      setErrorMsg('Mobile number must be exactly 10 digits.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        owner_name: form.owner_name,
        phone: form.phone,
        email: form.email,
        pet_name: form.pet_name || `${form.owner_name}'s ${form.species}`,
        species: form.species,
        breed: form.breed,
        age_years: form.age_years === '' ? undefined : Number(form.age_years),
        gender: form.gender || undefined,
        is_aggressive: form.is_aggressive === 'yes',
        service_name: bookingModalItem.title,
        appointment_date: slotDate(form.appointment_date, form.slot_index),
        appointment_time: TIME_SLOTS[form.slot_index],
        address: form.address,
        notes: `${form.notes} [Booked via Website Modal for ${bookingModalItem.title}]`,
        total_amount: price,
        payment_method: form.payment_method
      };

      const res = await fetch(`${API_URL}/appointments/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessData(data.data);
        showToast('🎉 Home visit appointment successfully booked!');
      } else {
        setErrorMsg(data.message || 'Booking failed. Please try again or call our helpline.');
      }
    } catch (err) {
      console.error('Booking error:', err);
      setErrorMsg('Could not connect to server. Please call our 24x7 helpline: +91 922 041 0777');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }} className="hide-scrollbar">
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
          color: '#fff',
          borderRadius: '16px 16px 0 0'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
              Schedule Doorstep Appointment
            </h3>
            <div style={{ fontSize: '12.5px', opacity: 0.9, marginTop: '2px' }}>
              {bookingModalItem.title} — ₹{price}.00{emergency ? ` (emergency rate, ${EMERGENCY_HOURS_TEXT})` : ''}
            </div>
          </div>
          <button
            onClick={closeBookingModal}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px' }}>
          {successData ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: '#dcfce7',
                color: '#16a34a',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 16px'
              }}>
                ✓
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
                Booking Confirmed!
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' }}>
                Thank you, <strong>{successData.customer_name}</strong>! Your home visit for <strong>{successData.pet_name}</strong> has been scheduled with Cadovet's veterinary team.
              </p>

              {/* Summary Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'left',
                fontSize: '13px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Appointment ID:</span>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>#{successData.appointment_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Service:</span>
                  <span style={{ fontWeight: '700', color: '#1BAFBF' }}>{bookingModalItem.title}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Date & Slot:</span>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>{successData.appointment_date} ({successData.appointment_time})</span>
                </div>
                {successData.invoice_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Invoice #:</span>
                    <span style={{ fontWeight: '700', color: '#1e293b' }}>{successData.invoice_number}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', paddingTop: '8px' }}>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>Total Fee:</span>
                  <span style={{ fontWeight: '800', color: '#16a34a', fontSize: '15px' }}>₹{successData.total_amount}.00</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => { closeBookingModal(); navigate('/login'); }}
                  style={{
                    background: '#1BAFBF',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  👤 View in your Cadovet account
                </button>
                <button
                  onClick={closeBookingModal}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {errorMsg && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px'
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Pet Parent Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aditi Roy"
                    maxLength={30}
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Pet Breed *</label>
                    <input type="text" required maxLength={100} placeholder="e.g. Labrador" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Pet Age (years) *</label>
                    <input type="number" required min="0" max="100" step="0.1" placeholder="e.g. 3" value={form.age_years} onChange={(e) => setForm({ ...form, age_years: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Pet Gender *</label>
                    <select required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                      <option value="">Select gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Is your pet aggressive? *</label>
                    <select required value={form.is_aggressive} onChange={(e) => setForm({ ...form, is_aggressive: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                      <option value="">Select</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Pet Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Leo / Bella"
                    value={form.pet_name}
                    required
                    onChange={(e) => setForm({ ...form, pet_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Pet Species *
                  </label>
                  <select
                    value={form.species}
                    required
                    onChange={(e) => setForm({ ...form, species: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="" disabled>Select species</option>
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    value={form.appointment_date}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Time Slot *
                  </label>
                  <select
                    value={form.slot_index}
                    required
                    onChange={(e) => setForm({ ...form, slot_index: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="" disabled>Select time</option>
                    {TIME_SLOTS.map((time, index) => <option key={`${time}-${index}`} value={index}>{time}{index === 24 ? ' (next day)' : ''}{isEmergencySlot(index) ? ' 🚨' : ''}</option>)}
                  </select>
                </div>
              </div>

              {emergency && (
                <div role="note" data-testid="emergency-note" style={{ marginBottom: '14px', padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>
                  🚨 Emergency hours ({EMERGENCY_HOURS_TEXT}). This visit is handled as an emergency and is charged the emergency rate: ₹{price}.
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Doorstep Home Address (Delhi / Noida / Grtr Noida / Ghaziabad) *
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="House/Flat No, Apartment/Street, Sector or Area..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Concerns / Visit Details (maximum 200 words) *
                </label>
                <textarea
                  rows="3"
                  placeholder="Tell us about your pet's concern or reason for the visit..."
                  value={form.notes}
                  required
                  onChange={(e) => setForm({ ...form, notes: e.target.value.split(/\s+/).filter(Boolean).slice(0, 200).join(' ') })}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Payment Option *
                </label>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_method"
                      value="CASH"
                      required
                      checked={form.payment_method === 'CASH'}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    />
                    Cash / UPI on Home Visit *
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_method"
                      value="UPI"
                      checked={form.payment_method === 'UPI'}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    />
                    Online UPI / Card
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeBookingModal}
                  style={{
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    padding: '11px 20px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#94a3b8' : '#1BAFBF',
                    color: '#fff',
                    border: 'none',
                    padding: '11px 24px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Confirming...' : `Confirm Home Booking (₹${price})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
