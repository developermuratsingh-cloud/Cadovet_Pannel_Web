import React from 'react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { FOUNDERS } from '../../constants/cadovetCatalog';
import { useLanguage } from '../../context/LanguageContext';

const AboutUsPage = () => {
  const { t } = useLanguage();
  return (
    <div className="public-page" style={{ fontFamily: 'Poppins, sans-serif', color: '#1e293b', background: '#fff', minHeight: '100vh' }}>
      <PublicHeader />
      <BookingModal />

      {/* Hero Banner */}
      <section style={{
        background: 'linear-gradient(135deg, #0d9aaa 0%, #1BAFBF 100%)',
        color: '#fff',
        padding: '70px 20px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.2)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '700',
            marginBottom: '16px',
            letterSpacing: '1px'
          }}>
            {t('welcomeCadovet')}
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '0 0 16px 0', lineHeight: 1.2 }}>
            {t('aboutHeroTitle')}
          </h1>
          <p style={{ fontSize: '17px', opacity: 0.95, lineHeight: 1.6, margin: 0 }}>
            {t('aboutHeroDescription')}
          </p>
        </div>
      </section>

      {/* About Cadovet Story */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '50px', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#1BAFBF', fontWeight: '800', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              {t('whoWeAre')}
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', lineHeight: 1.3, marginBottom: '20px' }}>
              {t('aboutTitle')}
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#475569', marginBottom: '16px' }}>
              {t('aboutParagraphOne')}
            </p>
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#475569', marginBottom: '16px' }}>
              {t('aboutParagraphTwo')}
            </p>
            <div style={{
              background: '#f0fdf4',
              borderLeft: '4px solid #84cc16',
              padding: '16px 20px',
              borderRadius: '0 10px 10px 0',
              fontWeight: '600',
              color: '#15803d',
              fontSize: '15px'
            }}>
              “{t('aboutQuote')}”
            </div>
          </div>

          <div>
            <img
              src="https://cadovet.com/wp-content/uploads/2024/12/close-up-doctor-clipping-dog-s-nails-scaled.jpg"
              alt="Cadovet Veterinary Care"
              style={{ width: '100%', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', objectFit: 'cover', maxHeight: '420px' }}
            />
          </div>
        </div>
      </section>

      {/* Vision, Mission, Goal Cards */}
      <section style={{ background: '#f8fafc', padding: '70px 20px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
              {t('guidingPrinciples')}
            </h2>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
              {t('guidingDescription')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            {/* Vision */}
            <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#e0f4f7', color: '#1BAFBF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>
                👁️
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>{t('ourVision')}</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#64748b', margin: 0 }}>
                {t('visionText')}
              </p>
            </div>

            {/* Mission */}
            <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>
                🎯
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>{t('ourMission')}</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#64748b', margin: 0 }}>
                {t('missionText')}
              </p>
            </div>

            {/* Goal */}
            <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>
                🏆
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>{t('ourGoal')}</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#64748b', margin: 0 }}>
                {t('goalText')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership & Founders Team */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '70px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <div style={{ color: '#1BAFBF', fontWeight: '800', fontSize: '13px', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '8px' }}>
            {t('meetFounders')}
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
            {t('leadershipTitle')}
          </h2>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
            {t('leadershipDescription')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '30px' }}>
          {FOUNDERS.map((leader) => (
            <div
              key={leader.name}
              style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '28px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                textAlign: 'center',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
              }}
            >
              <div style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                margin: '0 auto 20px',
                border: '3px solid #1BAFBF',
                padding: '3px',
                background: '#fff',
                boxShadow: '0 8px 20px rgba(27,175,191,0.2)'
              }}>
                <img
                  src={leader.image}
                  alt={leader.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1BAFBF,#066aab);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;">${leader.name[0]}</div>`;
                  }}
                />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: '0 0 4px 0' }}>
                {leader.name}
              </h3>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#84cc16', marginBottom: '14px' }}>
                {leader.role}
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '18px' }}>
                {leader.bio}
              </p>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', fontSize: '12.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>📞 <a href={`tel:${leader.phone}`} style={{ color: '#066aab', textDecoration: 'none', fontWeight: '600' }}>{leader.phone}</a></div>
                <div>✉️ <a href={`mailto:${leader.email}`} style={{ color: '#066aab', textDecoration: 'none', fontWeight: '600' }}>{leader.email}</a></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default AboutUsPage;
