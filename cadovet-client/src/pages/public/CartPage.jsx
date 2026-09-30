import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { useCart } from '../../context/CartContext';
import { API_URL } from '../../config';

const CartPage = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal, showToast } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  const [form, setForm] = useState({
    owner_name: '',
    phone: '',
    email: '',
    pet_name: '',
    species: 'Dog',
    address: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00 AM to 12:00 PM',
    payment_method: 'CASH',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [confirmedData, setConfirmedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (couponCode.trim().toUpperCase() === 'CADO10' || couponCode.trim().toUpperCase() === 'WELCOME10') {
      setDiscountPercent(10);
      showToast('🎉 Coupon applied! 10% discount added.');
    } else {
      showToast('❌ Invalid coupon code. Try WELCOME10');
    }
  };

  const discountAmount = Math.round((cartTotal * discountPercent) / 100);
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!form.owner_name.trim() || !form.phone.trim() || !form.address.trim()) {
      setErrorMsg('Please provide your name, phone number, and doorstep visit address.');
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
        address: form.address,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        notes: `${form.notes} [Doorstep Checkout with ${cartItems.length} items]`,
        cart_items: cartItems,
        total_amount: finalTotal,
        payment_method: form.payment_method
      };

      const res = await fetch(`${API_URL}/appointments/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmedData(data.data);
        clearCart();
        showToast('🎉 Doorstep booking confirmed! Coordinator will call shortly.');
      } else {
        setErrorMsg(data.message || 'Checkout failed. Please try again or call our helpline.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMsg('Network error connecting to Cadovet server. Please call +91 922 041 0777');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-page" style={{ fontFamily: 'Poppins, sans-serif', color: '#1e293b', background: '#fff', minHeight: '100vh' }}>
      <PublicHeader />

      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '30px 20px 80px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', marginBottom: '8px' }}>
          Your Cart & Doorstep Checkout
        </h1>
        <p style={{ color: '#64748b', fontSize: '14.5px', marginBottom: '32px' }}>
          Review your selected veterinary packages, enter your home visit address, and schedule a verified doctor visit.
        </p>

        {confirmedData ? (
          /* Confirmation State */
          <div style={{
            background: '#fff',
            border: '1px solid #d1e8ec',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            maxWidth: '650px',
            margin: '0 auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: '#dcfce7',
              color: '#16a34a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              margin: '0 auto 20px'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', marginBottom: '8px' }}>
              Order & Visit Confirmed!
            </h2>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: '1.7', marginBottom: '24px' }}>
              Thank you, <strong>{confirmedData.customer_name}</strong>! Your doorstep appointment for <strong>{confirmedData.pet_name}</strong> has been booked in the Cadovet system.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              fontSize: '13.5px',
              marginBottom: '28px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Appointment ID:</span>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>#{confirmedData.appointment_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Date & Slot:</span>
                <span style={{ fontWeight: '700', color: '#1BAFBF' }}>{confirmedData.appointment_date} ({confirmedData.appointment_time})</span>
              </div>
              {confirmedData.invoice_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <span style={{ color: '#64748b' }}>Invoice Number:</span>
                  <span style={{ fontWeight: '800', color: '#0f172a' }}>{confirmedData.invoice_number}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Visit Status:</span>
                <span style={{ fontWeight: '800', color: '#16a34a' }}>CONFIRMED</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: '15px' }}>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>Total Amount:</span>
                <span style={{ fontWeight: '900', color: '#0f172a' }}>₹{confirmedData.total_amount}.00</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                👤 View in your Cadovet account
              </button>
              <button
                onClick={() => navigate('/')}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : cartItems.length === 0 ? (
          /* Empty Cart */
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Your Cart is Empty</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              Explore our puppy bundles, cat vaccination packs, grooming, and diagnostics.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/dogs-packages')}
                style={{ background: '#1BAFBF', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Explore Dogs Packages
              </button>
              <button
                onClick={() => navigate('/cat-packages')}
                style={{ background: '#84cc16', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Explore Cat Packages
              </button>
            </div>
          </div>
        ) : (
          /* Cart + Checkout Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '40px', alignItems: 'start' }}>
            {/* Left: Items List */}
            <div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#fff', marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', fontSize: '15px' }}>
                  Items in Cart ({cartItems.length})
                </div>

                <div style={{ padding: '10px 20px' }}>
                  {cartItems.map(item => (
                    <div
                      key={item.slug || item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 0',
                        borderBottom: '1px solid #f1f5f9',
                        gap: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img src={item.image} alt={item.title} style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#f8fafc', borderRadius: '8px' }} />
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '14.5px', color: '#0f172a' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>₹{item.price} each</div>
                          <button
                            onClick={() => removeFromCart(item.slug || item.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', padding: 0, cursor: 'pointer', marginTop: '4px', textDecoration: 'underline' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Qty Control */}
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                          <button
                            onClick={() => updateQuantity(item.slug || item.id, (item.qty || 1) - 1)}
                            style={{ background: '#f8fafc', border: 'none', padding: '4px 10px', cursor: 'pointer', fontWeight: '700' }}
                          >
                            −
                          </button>
                          <span style={{ padding: '0 8px', fontSize: '13px', fontWeight: '800' }}>{item.qty || 1}</span>
                          <button
                            onClick={() => updateQuantity(item.slug || item.id, (item.qty || 1) + 1)}
                            style={{ background: '#f8fafc', border: 'none', padding: '4px 10px', cursor: 'pointer', fontWeight: '700' }}
                          >
                            +
                          </button>
                        </div>

                        <div style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', minWidth: '75px', textAlign: 'right' }}>
                          ₹{(item.price * (item.qty || 1)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coupon Code */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', background: '#fff', marginBottom: '24px' }}>
                <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Coupon Code (e.g. WELCOME10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                  />
                  <button
                    type="submit"
                    style={{ background: '#1BAFBF', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Apply
                  </button>
                </form>
              </div>

              {/* Bill Breakdown */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', background: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Order Summary</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13.5px', color: '#475569' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>₹{cartTotal.toLocaleString()}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13.5px', color: '#475569' }}>
                  <span>Doorstep Visit & Cold-Chain Fee:</span>
                  <span style={{ fontWeight: '700', color: '#16a34a' }}>FREE (Included)</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13.5px', color: '#ef4444' }}>
                    <span>Coupon Discount ({discountPercent}%):</span>
                    <span style={{ fontWeight: '700' }}>-₹{discountAmount.toLocaleString()}.00</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: '10px', borderTop: '2px solid #e2e8f0', fontSize: '18px' }}>
                  <span style={{ fontWeight: '900', color: '#0f172a' }}>Final Total:</span>
                  <span style={{ fontWeight: '900', color: '#1BAFBF' }}>₹{finalTotal.toLocaleString()}.00</span>
                </div>
              </div>
            </div>

            {/* Right: Doorstep Appointment Details Form */}
            <div style={{ border: '1.5px solid #d1e8ec', borderRadius: '16px', padding: '30px', background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 6px 0' }}>
                Doorstep Visit & Contact Details
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px 0' }}>
                Enter your residential address for the veterinarian team to arrive.
              </p>

              {errorMsg && (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCheckoutSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Pet Parent Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Mehra"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Contact Mobile *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Email (For Invoice & Card)
                    </label>
                    <input
                      type="email"
                      placeholder="vikram@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Pet Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bruno"
                      value={form.pet_name}
                      onChange={(e) => setForm({ ...form, pet_name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Species
                    </label>
                    <select
                      value={form.species}
                      onChange={(e) => setForm({ ...form, species: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    >
                      <option value="Dog">Dog</option>
                      <option value="Cat">Cat</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Home Visit Address (Delhi, Noida, Grtr. Noida, Ghaziabad) *
                  </label>
                  <textarea
                    required
                    rows="2"
                    placeholder="House/Flat number, Building name, Street, Sector or Locality..."
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Visit Date
                    </label>
                    <input
                      type="date"
                      value={form.appointment_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Preferred Slot
                    </label>
                    <select
                      value={form.appointment_time}
                      onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px', boxSizing: 'border-box' }}
                    >
                      <option value="09:00 AM to 11:00 AM">09:00 AM to 11:00 AM</option>
                      <option value="11:00 AM to 01:00 PM">11:00 AM to 01:00 PM</option>
                      <option value="02:00 PM to 04:00 PM">02:00 PM to 04:00 PM</option>
                      <option value="04:00 PM to 06:00 PM">04:00 PM to 06:00 PM</option>
                      <option value="06:00 PM to 08:00 PM">06:00 PM to 08:00 PM</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '13.5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="payment_method"
                        value="CASH"
                        checked={form.payment_method === 'CASH'}
                        onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      />
                      💵 Cash / UPI on Home Visit
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="payment_method"
                        value="UPI"
                        checked={form.payment_method === 'UPI'}
                        onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      />
                      📱 Online Card / UPI
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1BAFBF, #066aab)',
                    color: '#fff',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '800',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(27,175,191,0.3)'
                  }}
                >
                  {loading ? 'Confirming Visit...' : `Confirm & Schedule Doorstep Visit (₹${finalTotal})`}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
};

export default CartPage;
