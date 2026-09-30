import React from 'react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { useCart } from '../../context/CartContext';
import { GENERAL_SERVICES } from '../../constants/cadovetCatalog';

const SurgeryPage = () => {
  const { openBookingModal } = useCart();
  const surgeryItem = GENERAL_SERVICES[5]; // Surgery consultation

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
            VETERINARY SURGERY & CRITICAL CARE
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '0 0 14px 0' }}>
            Major & Minor Surgery for Pets
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0, lineHeight: 1.6 }}>
            Safe, sterile surgical interventions led by senior veterinary surgeons equipped with advanced anesthesia monitoring, painless multimodal analgesia, and dedicated post-operative recovery care.
          </p>
        </div>
      </section>

      {/* Intro Overview */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '60px 20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#1BAFBF', fontWeight: '800', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              STERILE SURGICAL THEATRES & HOME RECOVERY
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', lineHeight: 1.3 }}>
              Safe, Stress-Free Surgical Procedures
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#475569', marginBottom: '20px' }}>
              At Cadovet, we understand that your pet’s health and well-being are of utmost importance, which is why we offer expert major and minor surgery services tailored to the specific needs of your beloved companion. Whether it’s a routine spay/neuter procedure or a complex orthopedic reconstruction, our team of highly skilled veterinarians is dedicated to providing safe, effective, and compassionate surgical care.
            </p>
            <button
              onClick={() => openBookingModal(surgeryItem)}
              style={{
                background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                color: '#fff',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '24px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(27,175,191,0.3)'
              }}
            >
              🏥 Schedule Pre-Surgical Consultation (₹599)
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <img
              src="https://cadovet.com/wp-content/uploads/2024/12/care-pets-after-surgery-min-1024x683-removebg-preview.png"
              alt="Care Pets After Surgery Cadovet"
              className="animate-float-gentle"
              style={{ maxWidth: '440px', width: '100%', objectFit: 'contain', filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.12))' }}
            />
          </div>
        </div>
      </section>

      {/* Major vs Minor Grid */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '40px 20px 70px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '30px' }}>
          {/* Major Surgery */}
          <div style={{
            border: '1.5px solid #d1e8ec',
            borderRadius: '16px',
            padding: '32px',
            background: '#fafdfe',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              display: 'inline-block',
              background: '#e0f4f7',
              color: '#066aab',
              fontWeight: '800',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              textTransform: 'uppercase',
              marginBottom: '16px'
            }}>
              Advanced Inpatient Procedures
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
              Major Surgery for Pets
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#64748b', marginBottom: '20px' }}>
              Major surgeries require general anesthesia, sterile surgical theaters, and specialized equipment:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: '#334155' }}>
              <li>
                <strong style={{ color: '#0f172a' }}>• Spaying and Neutering:</strong> Essential procedures to prevent unwanted pregnancies, pyometra, and reproductive cancers.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Orthopedic Surgery:</strong> Bone fractures, patellar luxation, cruciate ligament repairs, and joint mobility surgeries.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Abdominal Surgery:</strong> Organ dysfunction, gastrointestinal foreign body removals, spleen and bladder stone surgery.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Tumor Removal:</strong> Wide-margin excision of benign and malignant growths ensuring long-term recovery.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Emergency C-Sections:</strong> Safe surgical delivery for canine and feline mothers in dystocia.
              </li>
            </ul>
          </div>

          {/* Minor Surgery */}
          <div style={{
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px',
            background: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}>
            <div style={{
              display: 'inline-block',
              background: '#dcfce7',
              color: '#16a34a',
              fontWeight: '800',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              textTransform: 'uppercase',
              marginBottom: '16px'
            }}>
              Outpatient & Day Care
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
              Minor Surgery for Pets
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#64748b', marginBottom: '20px' }}>
              Less invasive procedures often performed under sedation or local anesthesia:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: '#334155' }}>
              <li>
                <strong style={{ color: '#0f172a' }}>• Dental Procedures:</strong> Ultrasonic scaling, polishing, loose tooth extractions, and gingival therapy.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Wound Repairs:</strong> Stitching cuts, bite wounds, and lacerations under sterile conditions to prevent infection.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Biopsy Collection:</strong> Targeted tissue sampling to diagnose cysts, infections, or cellular abnormalities.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Superficial Mass Removal:</strong> Skin tags, small papillomas, and sebaceous cysts.
              </li>
              <li>
                <strong style={{ color: '#0f172a' }}>• Ophthalmic Care:</strong> Cherry eye repositioning, entropion eyelid repair, and corneal ulcer healing.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Why Choose Cadovet Surgery */}
      <section style={{ background: '#f8fafc', padding: '60px 20px', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
              Why Trust Cadovet Surgical Care?
            </h2>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
              Gold-standard surgical hygiene, cutting-edge monitoring, and continuous post-op recovery.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '26px', marginBottom: '10px' }}>👨‍⚕️</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800' }}>Expert Veterinarians</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>Highly trained surgeons specializing in soft-tissue, reconstructive, and orthopedic procedures.</p>
            </div>

            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '26px', marginBottom: '10px' }}>🫀</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800' }}>Multiparameter Anesthesia Monitoring</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>Continuous tracking of SPO2, ECG, blood pressure, end-tidal CO2, and body temperature throughout.</p>
            </div>

            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '26px', marginBottom: '10px' }}>🏡</div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800' }}>In-Home Post-Op Followups</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>Our veterinary team visits your residence for suture removal, wound dressing changes, and pain management checks.</p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default SurgeryPage;
