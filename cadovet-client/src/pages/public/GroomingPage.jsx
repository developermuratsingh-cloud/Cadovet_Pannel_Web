import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { useCart } from '../../context/CartContext';
import { loadPublicServicesByCategory, selectServices } from '../../store/catalogSlice';

// Live from Services & Fees (category "Grooming") — was two hardcoded entries pulled from a static file;
// now whatever Operational Head/Admin manage under that category is what shows here.
const GroomingPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToCart, openBookingModal } = useCart();
  const groomingPackages = useSelector(selectServices);

  useEffect(() => {
    dispatch(loadPublicServicesByCategory('Grooming'));
  }, [dispatch]);

  return (
    <div className="public-page" style={{ fontFamily: 'Poppins, sans-serif', color: '#1e293b', background: '#fff', minHeight: '100vh' }}>
      <PublicHeader />
      <BookingModal />

      {/* Hero Header */}
      <section style={{
        background: 'linear-gradient(135deg, #0d9aaa 0%, #1BAFBF 100%)',
        color: '#fff',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.2)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: '700',
            marginBottom: '14px',
            letterSpacing: '1px'
          }}>
            PROFESSIONAL PET SPA & STYLING
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '0 0 14px 0' }}>
            In-Home Pet Grooming Services
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0, lineHeight: 1.6 }}>
            Pamper your dog with certified hygienic groomers bringing warm medicated baths, breed haircuts, painless nail trimming, and dental care right to your doorstep.
          </p>
        </div>
      </section>

      {/* Breadcrumb Bar */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 10px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <span style={{ cursor: 'pointer', color: '#1BAFBF' }} onClick={() => navigate('/')}>Home</span> &gt; <strong>Pet Grooming</strong>
        </div>
      </section>

      {/* Products Grid */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '30px 20px 80px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '30px'
        }}>
          {groomingPackages.map(pkg => (
            <div
              key={pkg.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                overflow: 'hidden',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
              }}
            >
              <div>
                <div style={{ height: '220px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={pkg.image} alt={pkg.title} style={{ width: '75%', height: '75%', objectFit: 'contain' }} />
                </div>

                <div style={{ padding: '24px' }}>
                  <span style={{ background: '#e0f4f7', color: '#066aab', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                    {pkg.badge}
                  </span>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '10px 0' }}>
                    {pkg.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px', fontSize: '12px', color: '#f59e0b' }}>
                    <span>★★★★★</span>
                    <span style={{ color: '#64748b' }}>({pkg.reviewsCount} Reviews)</span>
                  </div>
                  <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                    {pkg.shortDesc}
                  </p>

                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', color: '#334155', marginBottom: '18px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '6px', color: '#0f172a' }}>What’s Included:</div>
                    <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.7' }}>
                      {pkg.inclusions.map((inc, i) => (
                        <li key={i}>{inc}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
                    ₹{pkg.price.toLocaleString()}
                  </span>
                  {pkg.originalPrice && (
                    <span style={{ fontSize: '14px', color: '#94a3b8', textDecoration: 'line-through' }}>
                      ₹{pkg.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => addToCart(pkg)}
                    style={{
                      background: '#f1f5f9',
                      color: '#1e293b',
                      border: '1px solid #cbd5e1',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🛒 Add to Cart
                  </button>

                  <button
                    onClick={() => openBookingModal(pkg)}
                    style={{
                      background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                      color: '#fff',
                      border: 'none',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(27,175,191,0.25)'
                    }}
                  >
                    Schedule Home Spa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grooming Etiquette & FAQs */}
      <section style={{ background: '#f8fafc', padding: '60px 20px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: '24px' }}>
            What to Expect from Our In-Home Grooming
          </h2>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', fontSize: '14px', lineHeight: '1.8', color: '#475569' }}>
            <p><strong>Session Duration:</strong> Variable between 1 to 3 hours depending on your pet’s coat condition, breed, and temperament.</p>
            <p><strong>Owner Presence:</strong> To provide a stress-free experience, we kindly request that owners do not stay in the grooming area during the session. Our professional groomers are trained to handle all temperaments prioritizing safety and comfort.</p>
            <p style={{ margin: 0 }}><strong>Hygiene Guarantee:</strong> All grooming tools, blades, and towels are sanitized with hospital-grade disinfectant between each home visit.</p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default GroomingPage;
