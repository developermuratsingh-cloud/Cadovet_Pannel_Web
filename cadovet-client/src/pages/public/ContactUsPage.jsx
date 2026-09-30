import React, { useState } from 'react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { HELPLINE_PHONE, HELPLINE_CALL, CARE_EMAIL } from '../../constants/cadovetCatalog';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';

const ContactUsPage = () => {
  const { showToast } = useCart();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: 'Delhi',
    petType: 'Dog',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (showToast) {
      showToast('Thank you for reaching out! A Cadovet representative will call you shortly.');
    }
  };

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
            {t('contactEyebrow')}
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '0 0 14px 0' }}>
            {t('contactTitle')}
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0, lineHeight: 1.6 }}>
            {t('contactDescription')}
          </p>
        </div>
      </section>

      {/* Contact Cards & Form */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '60px 20px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px' }}>
          {/* Left Column: Direct Helplines */}
          <div>
            <div style={{ color: '#1BAFBF', fontWeight: '800', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              {t('getInTouch')}
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', marginBottom: '20px', lineHeight: 1.3 }}>
              {t('emergencyCenters')}
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#475569', marginBottom: '30px' }}>
              {t('contactSupportDescription')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Phone */}
              <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f4f7', color: '#066aab', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  📞
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>24x7 Helpline</div>
                  <a href={HELPLINE_CALL} style={{ fontSize: '17px', fontWeight: '800', color: '#066aab', textDecoration: 'none' }}>
                    {HELPLINE_PHONE}
                  </a>
                  <div style={{ fontSize: '12px', color: '#84cc16', fontWeight: '600', marginTop: '2px' }}>Toll-free across Delhi NCR</div>
                </div>
              </div>

              {/* Email */}
              <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  ✉️
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{t('supportEmail')}</div>
                  <a href={`mailto:${CARE_EMAIL}`} style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', textDecoration: 'none' }}>
                    {CARE_EMAIL}
                  </a>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Response within 2 hours</div>
                </div>
              </div>

              {/* Places We Serve */}
              <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  📍
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>{t('serviceHubs')}</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                    Delhi • Noida • Greater Noida • Ghaziabad
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>In-home veterinary visits scheduled within 45 minutes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Inquiry Form */}
          <div>
            <div style={{
              background: '#fff', borderRadius: '20px', padding: '36px',
              boxShadow: '0 15px 40px rgba(0,0,0,0.06)', border: '1.5px solid #d1e8ec'
            }}>
              <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
                {t('sendMessage')}
              </h3>
              <p style={{ fontSize: '13.5px', color: '#64748b', marginBottom: '24px' }}>
                {t('messageDescription')}
              </p>

              {submitted ? (
                <div style={{ background: '#f0fff4', border: '1px solid #c6f6d5', padding: '28px', borderRadius: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎉</div>
                  <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#22543d' }}>{t('messageSent')}</h4>
                  <p style={{ fontSize: '14px', color: '#276749', marginTop: '8px', lineHeight: '1.6' }}>
                    Thank you, <strong>{formData.name}</strong>! Your inquiry has been received. Our team will contact you at <strong>{formData.phone}</strong> shortly.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    style={{
                      marginTop: '18px', background: '#1BAFBF', color: '#fff', border: 'none',
                      padding: '10px 24px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer'
                    }}
                  >
                    {t('sendAnother')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                      {t('yourName')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%', padding: '11px 14px', border: '1.5px solid #d1e8ec',
                        borderRadius: '10px', fontSize: '14px', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                        {t('mobileNumber')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit number"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        style={{
                          width: '100%', padding: '11px 14px', border: '1.5px solid #d1e8ec',
                          borderRadius: '10px', fontSize: '14px', outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                        {t('cityLocation')}
                      </label>
                      <select
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        style={{
                          width: '100%', padding: '11px 14px', border: '1.5px solid #d1e8ec',
                          borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#fff'
                        }}
                      >
                        <option value="Delhi">Delhi</option>
                        <option value="Noida">Noida</option>
                        <option value="Greater Noida">Greater Noida</option>
                        <option value="Ghaziabad">Ghaziabad</option>
                        <option value="Other">Other NCR</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                      {t('emailAddress')}
                    </label>
                    <input
                      type="email"
                      placeholder="yourname@gmail.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: '100%', padding: '11px 14px', border: '1.5px solid #d1e8ec',
                        borderRadius: '10px', fontSize: '14px', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                      {t('howHelp')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe your pet's condition, required vaccines, grooming, or consultation needs..."
                      value={formData.message}
                      onChange={e => setFormData({ ...formData, message: e.target.value })}
                      style={{
                        width: '100%', padding: '11px 14px', border: '1.5px solid #d1e8ec',
                        borderRadius: '10px', fontSize: '14px', outline: 'none', resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                      color: '#fff', border: 'none', borderRadius: '12px',
                      fontSize: '15px', fontWeight: '800', cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(27,175,191,0.35)', transition: 'all 0.2s'
                    }}
                  >
                    {t('sendMessageAction')} →
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default ContactUsPage;
