import React, { useState } from 'react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { DOG_PACKAGES, CAT_PACKAGES } from '../../constants/cadovetCatalog';

const VaccinationPage = () => {
  const { openBookingModal } = useCart();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dog');
  const [openFaq, setOpenFaq] = useState(0);

  const dogVaccines = [
    {
      title: 'Complete Puppy Protocol (3-Stage)',
      shots: ['3 Shots of DHPPi', '2 Shots of Corona', '2 Shots of Anti-rabies (ARV)', '1 Shot of Kennel cough'],
      price: 5999,
      itemRef: DOG_PACKAGES[0]
    },
    {
      title: 'Adult Dog Annual Booster Pack',
      shots: ['1 Shot of DHPPiL', '1 Shot of Corona', '1 Shot of Anti-rabies', '1 Shot of Kennel cough'],
      price: 3399,
      itemRef: DOG_PACKAGES[1]
    },
    {
      title: 'DHPPi (7-in-1 / 9-in-1 Core Vaccine)',
      shots: ['1 Shot of DHPPiL (Distemper, Hepatitis, Parvo, Parainfluenza)'],
      price: 1399,
      itemRef: DOG_PACKAGES[3]
    },
    {
      title: 'Canine Coronavirus Vaccine',
      shots: ['1 Shot of Coronavirus Vaccine'],
      price: 1299,
      itemRef: DOG_PACKAGES[5]
    },
    {
      title: 'Anti-Rabies Vaccine (ARV)',
      shots: ['1 Shot of Licensed Anti-Rabies Vaccine + Tag'],
      price: 899,
      itemRef: DOG_PACKAGES[2]
    },
    {
      title: 'Kennel Cough Defense',
      shots: ['1 Shot of Bordetella Bronchiseptica Vaccine'],
      price: 1499,
      itemRef: DOG_PACKAGES[4]
    },
    {
      title: 'Puppy DP (Early Parvo + Distemper)',
      shots: ['1 Shot of High-Titred Puppy DP (4-6 weeks)'],
      price: 1499,
      itemRef: DOG_PACKAGES[6]
    }
  ];

  const catVaccines = [
    {
      title: 'Complete Kitten Vaccination Bundle',
      shots: ['2 Shots of Tri-Cat (FVRCP)', '2 Shots of Anti-rabies (ARV)'],
      price: 3599,
      itemRef: CAT_PACKAGES[0]
    },
    {
      title: 'Adult Cat Annual Booster Bundle',
      shots: ['1 Shot of Tri-Cat', '1 Shot of Anti-rabies'],
      price: 1999,
      itemRef: CAT_PACKAGES[1]
    },
    {
      title: 'Feline CRP / Tri-Cat Vaccine',
      shots: ['1 Shot of Feline Panleukopenia, Calici & Rhino Vaccine'],
      price: 1499,
      itemRef: CAT_PACKAGES[4]
    },
    {
      title: 'Anti-Rabies Booster (Cat)',
      shots: ['1 Shot of Cat-safe Anti-Rabies Vaccine + Certificate'],
      price: 899,
      itemRef: CAT_PACKAGES[2]
    }
  ];

  const vaccinationFaqs = [
    {
      q: 'Why should I vaccinate my pet at home?',
      a: 'At Cadovet, our home vaccination service prioritizes safety with thorough sanitization, strict cold-chain refrigeration, and veterinarians wearing personal protective gear. It completely prevents exposure to sick animals in waiting rooms and spares your pet travel stress.'
    },
    {
      q: 'Are your veterinarians licensed and verified?',
      a: 'Yes, all Cadovet veterinarians are fully licensed BVSc & AH professionals with extensive training and clinical experience. Additionally, we maintain comprehensive protocols to ensure the highest standard of animal healthcare.'
    },
    {
      q: 'What happens during an in-home vaccination appointment?',
      a: 'During the appointment, your pet receives a complete health assessment (temperature, mucous membranes, heart sounds). The veterinarian then administers the cold-chain vaccine, observes your pet for any immediate sensitivity, and issues an official vaccination card.'
    },
    {
      q: 'What diseases do these vaccines protect against?',
      a: 'We offer vaccines that protect against rabies, distemper, parvovirus, infectious hepatitis, leptospirosis, coronavirus, kennel cough, feline panleukopenia, calicivirus, and rhinotracheitis.'
    }
  ];

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
            {t('vaccinationEyebrow')}
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '0 0 14px 0' }}>
            {t('vaccinationTitle')}
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0, lineHeight: 1.6 }}>
            {t('vaccinationDescription')}
          </p>
        </div>
      </section>

      {/* Pet Selector Tabs */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '40px 20px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '6px', borderRadius: '30px' }}>
          <button
            onClick={() => setActiveTab('dog')}
            style={{
              background: activeTab === 'dog' ? '#1BAFBF' : 'transparent',
              color: activeTab === 'dog' ? '#fff' : '#475569',
              border: 'none',
              padding: '12px 32px',
              borderRadius: '24px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🐶 {t('dogVaccinations')}
          </button>
          <button
            onClick={() => setActiveTab('cat')}
            style={{
              background: activeTab === 'cat' ? '#1BAFBF' : 'transparent',
              color: activeTab === 'cat' ? '#fff' : '#475569',
              border: 'none',
              padding: '12px 32px',
              borderRadius: '24px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🐱 {t('catVaccinations')}
          </button>
        </div>
      </section>

      {/* Vaccines Grid */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 20px 60px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {(activeTab === 'dog' ? dogVaccines : catVaccines).map((item, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0' }}>
                  {item.title}
                </h3>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>
                  {t('vaccinesIncluded')}:
                </div>
                <ul style={{ margin: '0 0 20px 0', paddingLeft: '18px', fontSize: '13.5px', color: '#334155', lineHeight: '1.8' }}>
                  {item.shots.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>{t('packagePrice')}</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>₹{item.price.toLocaleString()}</div>
                </div>
                <button
                  onClick={() => openBookingModal(item.itemRef)}
                  style={{
                    background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                    color: '#fff',
                    border: 'none',
                    padding: '11px 24px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(27,175,191,0.25)'
                  }}
                >
                  {t('bookNow')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQs Section */}
      <section style={{ background: '#f8fafc', padding: '60px 20px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
              {t('vaccinationFaqs')}
            </h2>
            <p style={{ color: '#64748b', fontSize: '14.5px', margin: 0 }}>
              {t('vaccinationFaqDescription')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {vaccinationFaqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: '700',
                  fontSize: '15px',
                  color: '#1e293b'
                }}>
                  <span>{faq.q}</span>
                  <span style={{ fontSize: '18px', color: '#1BAFBF' }}>{openFaq === i ? '−' : '+'}</span>
                </div>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px', fontSize: '14px', lineHeight: '1.7', color: '#475569' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default VaccinationPage;
