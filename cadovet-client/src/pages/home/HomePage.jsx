import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import ServicesCarousel from '../../components/public/ServicesCarousel';
import ExpertsCarousel from '../../components/public/ExpertsCarousel';
import { useCart } from '../../context/CartContext';
import { BLOG_POSTS } from '../../constants/cadovetCatalog';
import { loadPublicServices, selectServices } from '../../store/catalogSlice';
import { useLanguage } from '../../context/LanguageContext';
import { API_URL } from '../../config';
import { TIME_SLOTS, EMERGENCY_HOURS_TEXT, isEmergencySlot, slotDate, findHomeVisitService } from '../../constants/emergency';

const LOGO_URL = 'https://cadovet.com/wp-content/uploads/2024/11/img-logo.png';

const DEFAULT_BEST_SELLERS = [
  {
    id: 1,
    slug: 'online-consultation',
    title: 'Online Consultation',
    price: 199,
    image: 'https://cadovet.com/wp-content/uploads/2025/03/Untitled-design-300x300.png',
    badge: 'Popular',
    desc: 'Instant 1-on-1 virtual video consultation with a certified veterinary doctor.'
  },
  {
    id: 4,
    slug: 'cat-vaccination-pack',
    title: 'Cat Vaccination Pack',
    subtitle: 'Package includes 4 Vaccine',
    price: 1999,
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1-1-300x300.png',
    badge: 'Core Care',
    desc: 'Complete feline immunization bundle including FVRCP core and anti-rabies vaccine.'
  },
  {
    id: 3,
    slug: 'health-checkup',
    title: 'Health Checkup',
    subtitle: 'Routine checkup for all pets',
    price: 999,
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Puppy-Vaccination-Pack-1-300x300.png',
    badge: 'Wellness',
    desc: 'Full vitals assessment, heart & lung sound check, ear, dental and coat evaluation.'
  },
  {
    id: 5,
    slug: 'puppy-vaccination-package',
    title: 'Puppy Vaccination Package',
    subtitle: 'Package includes 8 Vaccine',
    price: 5999,
    image: 'https://cadovet.com/wp-content/uploads/2024/11/Puppy-Vaccination-Pack-300x300.png',
    badge: 'Best Value',
    desc: 'Complete 3-shot puppy protocol: DHPPi, Corona, Parvo, Anti-Rabies & digital card.'
  },
  {
    id: 2,
    slug: 'home-visit-consultation',
    title: 'Home Visit Consultation',
    price: 599,
    image: 'https://cadovet.com/wp-content/uploads/2024/11/Puppy-Vaccination-Pack-1-300x300.png',
    badge: 'Recommended',
    desc: 'Experienced veterinarian visits your home for stress-free diagnosis and checkup.'
  }
];

// The clinic's actual team, matching cadovet.com's "Meet Our Expert" carousel — same 6 people, same photos,
// same credentials/specialization tags. This is marketing/"who we are" content, separate from the bookable
// doctor accounts the appointment flow itself assigns (there just aren't public headshots/bios for those yet).
const DEFAULT_EXPERTS = [
  {
    name: 'Dr. Deepak Kumar',
    title: 'Head',
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1.png',
    qualification: 'B.V.Sc & A.H. and M.V.Sc (LPM)'
  },
  {
    name: 'Dr. Anuj Deshwal',
    title: 'Medicine',
    image: 'https://cadovet.com/wp-content/uploads/2025/01/WhatsApp-Image-2025-01-06-at-10.49.20-PM.png',
    qualification: 'B.V.Sc & A.H. and M.V.Sc'
  },
  {
    name: 'Dr. Ambesh Kumar Pandey',
    title: 'Pet Nutrition Specialist',
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Dr.Ambesh_Kumar_Pandey-1.png',
    qualification: 'B.V.Sc & A.H. & M.V.Sc.(LPT)'
  },
  {
    name: 'Dr. Varsha',
    title: 'Veterinary Extension & Nutrition Specialist',
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Dr.Varsha-1.png',
    qualification: 'B.V.Sc. & A.H. & M.V.Sc.'
  },
  {
    name: 'Dr. Ashish Bangad',
    title: 'Surgery',
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Dr.Ashish-Bangad-1.jpeg',
    qualification: 'B.V.Sc & A.H and M.V.Sc.'
  },
  {
    name: 'Dr. Saeeda Khanam',
    title: 'Physiologist',
    image: 'https://cadovet.com/wp-content/uploads/2024/12/Dr.Saeeda_khanam-1.png',
    qualification: 'B.V.Sc. & A.H. & M.V.Sc.'
  }
];

// The 3 posts cadovet.com actually shows in its homepage "Recent Blogs" strip, in that same order — the
// newest 3 by publish date, not just the first 3 entries in BLOG_POSTS (whose own order is topical, not
// chronological).
const HOMEPAGE_RECENT_BLOG_SLUGS = ['pet-first-aid-kit', 'spaying-and-neutering', 'professional-grooming'];

const HomePage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToCart, openBookingModal, showToast } = useCart();
  const { t } = useLanguage();
  // "Our Best Selling" is these same 5 specific products, now live from Services & Fees (picked by slug, in
  // the reference site's own order) — falls back to the curated copy only until that first fetch resolves, so
  // there's never a blank strip. "Meet Our Expert" stays fixed marketing content (see DEFAULT_EXPERTS above).
  const [wishlist, setWishlist] = useState(() => new Set());
  const [experts] = useState(DEFAULT_EXPERTS);
  const services = useSelector(selectServices);

  useEffect(() => {
    dispatch(loadPublicServices());
  }, [dispatch]);

  // Cadovet's own "Cat Vaccination Pack" bestseller tile is a distinct listing from any single product on
  // their /cat-packages/ page (different photo, no matching product slug) — kept as the curated fallback
  // for that one slot. The other 4 map onto real, live Services & Fees entries by slug, so a price change
  // in the panel shows up here too; each keeps this widget's own ribbon subtitle (the product's own subtitle
  // field is written for its catalog page, e.g. "Complete 3-Shot Immunization Bundle" — this promo strip
  // uses the shorter "Package includes 8 Vaccine" copy cadovet.com's homepage actually shows).
  const liveOrFallback = (slug, fallback, subtitle) => {
    const live = services.find((s) => s.slug === slug);
    return live ? { ...live, subtitle } : fallback;
  };
  const bestSellers = services.length
    ? [
        liveOrFallback('online-consultation', DEFAULT_BEST_SELLERS[0], undefined),
        DEFAULT_BEST_SELLERS[1],
        liveOrFallback('health-checkup', DEFAULT_BEST_SELLERS[2], 'Routine checkup for all pets'),
        liveOrFallback('puppy-vaccination-package', DEFAULT_BEST_SELLERS[3], 'Package includes 8 Vaccine'),
        liveOrFallback('home-visit-consultation', DEFAULT_BEST_SELLERS[4], undefined),
      ]
    : DEFAULT_BEST_SELLERS;

  // Booking form state
  const [booking, setBooking] = useState({
    ownerName: '',
    phone: '',
    email: '',
    petName: '',
    breed: '',
    age: '',
    gender: '',
    aggressive: '',
    species: '',
    concern: '',
    date: '',
    slotIndex: '', // position in TIME_SLOTS (09:00 AM appears twice: the first and the last)
    address: ''
  });
  const [bookedSuccess, setBookedSuccess] = useState(false);

  // The plain home visit is ₹599. From 9 PM to 9 AM it costs the home-visit service's emergency price, when one is set.
  // The server works out the same price and is the authority.
  const homeVisitEmergency = isEmergencySlot(booking.slotIndex);
  const homeVisitService = findHomeVisitService(services);
  const homeVisitPrice = homeVisitEmergency && homeVisitService && homeVisitService.emergency_price !== null && homeVisitService.emergency_price !== undefined
    ? Number(homeVisitService.emergency_price)
    : 599;

  // FAQ open index
  const [openFaq, setOpenFaq] = useState(0);
  const faqs = [
    { q: t('paymentMethodsQuestion'), a: t('paymentMethodsAnswer') },
    { q: t('cancellationQuestion'), a: t('cancellationAnswer') },
    { q: t('groomingQuestion'), a: t('groomingAnswer') },
    { q: t('unhappyQuestion'), a: t('unhappyAnswer') }
  ];

  const handleHomeVisitSubmit = async (e) => {
    e.preventDefault();
    if (!booking.ownerName || !booking.phone || !booking.petName || !booking.species || !booking.breed
      || !booking.age || !booking.gender || !booking.aggressive || !booking.date || booking.slotIndex === ''
      || !booking.address || !booking.concern) {
      alert('Please fill all required booking fields. Email is optional.');
      return;
    }
    if (booking.ownerName.length > 30) {
      alert('Owner name must be 30 characters or fewer.');
      return;
    }
    if (!/^\d{10}$/.test(booking.phone)) {
      alert('Mobile number must be exactly 10 digits.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/appointments/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: booking.ownerName,
          phone: booking.phone,
          email: booking.email || undefined,
          pet_name: booking.petName,
          species: booking.species || 'Dog',
          breed: booking.breed,
          age_years: booking.age === '' ? undefined : Number(booking.age),
          gender: booking.gender || undefined,
          is_aggressive: booking.aggressive === 'yes',
          appointment_date: slotDate(booking.date, booking.slotIndex),
          appointment_time: TIME_SLOTS[booking.slotIndex],
          address: booking.address,
          service_name: 'Home Visit Consultation',
          notes: booking.concern,
          total_amount: homeVisitPrice
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBookedSuccess(true);
        showToast(`🎉 Home visit scheduled! Appointment #${data.data.appointment_id}`);
      } else {
        // Never tell the visitor a failed request went through (bad phone number, rate limit, server error...).
        showToast(`⚠️ ${data.message || 'We could not schedule your visit. Please call +91 922 041 0777.'}`);
      }
    } catch (err) {
      showToast('⚠️ Could not reach the server. Please try again or call +91 922 041 0777.');
    }
  };


  return (
    <div className="public-page" style={{ fontFamily: 'Poppins, sans-serif', color: '#1a2332', background: '#fff', minHeight: '100vh', position: 'relative' }}>
      <PublicHeader />
      <BookingModal />

      {/* ─── 3. HERO SECTION WITH "BOOK HOME VISIT" FLOATING FORM ─── */}
      <section className="home-hero" style={{
        background: 'linear-gradient(180deg, #e8f5f8 0%, #f0f9fa 100%)',
        padding: '50px 20px 70px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '40px', alignItems: 'start' }}>
          {/* Left Column: Heading & Feature Points */}
          <div>
            <h1 style={{
              fontSize: '44px', fontWeight: '900', color: '#111827',
              lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: '20px'
            }}>
              {t('homeTitle')}
            </h1>

            {/* Helpline Pill Button */}
            <a
              href="tel:+919220410777"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                background: '#1BAFBF', color: '#fff', padding: '12px 24px',
                borderRadius: '30px', fontWeight: '700', fontSize: '15px',
                marginBottom: '22px', boxShadow: '0 4px 15px rgba(27,175,191,0.35)'
              }}
            >
              <span>📞</span> +919220410777
            </a>

            <div className="blink-text" style={{ fontSize: '19px', fontWeight: '800', color: '#FF7043', marginBottom: '18px' }}>
              🔥 Online Consultation fees @ ₹200 only
            </div>

            <p style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.6, marginBottom: '28px', maxWidth: '520px' }}>
              {t('homeDescription')}
            </p>

            {/* Checkmark List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '36px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', fontWeight: '600', color: '#374151' }}>
                <span style={{ color: '#84cc16', fontSize: '18px', fontWeight: '900' }}>✔</span>
                {t('quickBooking')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', fontWeight: '600', color: '#374151' }}>
                <span style={{ color: '#84cc16', fontSize: '18px', fontWeight: '900' }}>✔</span>
                {t('qualifiedVeterinarians')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', fontWeight: '600', color: '#374151' }}>
                <span style={{ color: '#84cc16', fontSize: '18px', fontWeight: '900' }}>✔</span>
                {t('followUpSupport')}
              </div>
            </div>

            {/* Statistics Row */}
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', borderTop: '1px solid #d1e8ec', paddingTop: '24px' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#111827' }}>70K+</div>
                <div style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: '600' }}>{t('happyPetsTreated')}</div>
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#111827' }}>30K+</div>
                <div style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: '600' }}>{t('homeVisitsDone')}</div>
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#111827' }}>70K+</div>
                <div style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: '600' }}>{t('vaccinationsGiven')}</div>
              </div>
            </div>

            {/* Supporting image, filling the space beside the taller booking form */}
            <div style={{ position: 'relative', marginTop: '32px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', background: '#e8f5f8' }}>
              <img
                src="https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=900&q=80"
                alt="Happy puppy cared for through CadoVet's home visits"
                style={{ width: '100%', height: '300px', objectFit: 'cover', objectPosition: 'center 25%', display: 'block' }}
              />
              {/* Soft brand-teal wash so the photo reads as part of the page instead of a clashing standalone image */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(27,175,191,0.12) 0%, rgba(27,175,191,0.05) 60%, rgba(6,106,171,0.25) 100%)' }} />
              <div style={{
                position: 'absolute', left: '20px', bottom: '20px', background: '#fff',
                borderRadius: '14px', padding: '12px 18px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <span style={{ fontSize: '22px' }}>⭐</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#111827' }}>4.9 / 5 Rating</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>From 10,000+ pet parents</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: "BOOK HOME VISIT" Card (Exact Replica of cadovet.com) */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: '#fff', borderRadius: '20px', padding: '32px',
              boxShadow: '0 15px 40px rgba(0,0,0,0.08)', border: '1px solid #d1e8ec',
              maxWidth: '440px', margin: '0 auto', position: 'relative', zIndex: 1
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#111827', margin: 0, textTransform: 'uppercase' }}>
                    {t('bookHomeVisit')}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {t('affordableConsultation')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: homeVisitEmergency ? '#dc2626' : '#1BAFBF', lineHeight: 1 }}>
                    ₹{homeVisitPrice}
                  </div>
                  {homeVisitEmergency && <div style={{ fontSize: '11px', fontWeight: '800', color: '#b91c1c', marginTop: '4px' }}>🚨 EMERGENCY RATE</div>}
                </div>
              </div>

              {bookedSuccess ? (
                <div style={{ background: '#f0fff4', border: '1px solid #c6f6d5', padding: '24px', borderRadius: '12px', textAlign: 'center', marginTop: '20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#22543d' }}>{t('visitRequested')}</h3>
                  <p style={{ fontSize: '13px', color: '#276749', marginTop: '6px' }}>
                    Thank you, <strong>{booking.ownerName}</strong>! Our doctor is assigned for <strong>{slotDate(booking.date, booking.slotIndex)}</strong> at <strong>{TIME_SLOTS[booking.slotIndex]}</strong>.
                  </p>
                  <button
                    onClick={() => setBookedSuccess(false)}
                    style={{
                      marginTop: '16px', background: '#84cc16', color: '#fff', border: 'none',
                      padding: '8px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                    }}
                  >
                    {t('bookAnotherVisit')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleHomeVisitSubmit} style={{ marginTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                        {t('ownerName')} <span style={{ color: '#e53e3e' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t('ownerName')}
                        maxLength={30}
                        value={booking.ownerName}
                        onChange={e => setBooking({ ...booking, ownerName: e.target.value })}
                        required
                        style={{
                          width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec',
                          borderRadius: '8px', fontSize: '13px', outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                        {t('phoneNumber')} <span style={{ color: '#e53e3e' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder={t('phoneNumber')}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        inputMode="numeric"
                        value={booking.phone}
                        onChange={e => setBooking({ ...booking, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        required
                        style={{
                          width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec',
                          borderRadius: '8px', fontSize: '13px', outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                        Email (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={booking.email}
                      onChange={e => setBooking({ ...booking, email: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                        {t('petSpecies')} <span style={{ color: '#e53e3e' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dog, Cat, Puppy"
                      required
                      value={booking.species}
                      onChange={e => setBooking({ ...booking, species: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec',
                        borderRadius: '8px', fontSize: '13px', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Pet Name *</label>
                      <input type="text" required maxLength={100} placeholder="e.g. Bruno" value={booking.petName} onChange={e => setBooking({ ...booking, petName: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Pet Breed *</label>
                      <input type="text" required maxLength={100} placeholder="e.g. Labrador" value={booking.breed} onChange={e => setBooking({ ...booking, breed: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Pet Age (years) *</label>
                      <input type="number" required min="0" max="100" step="0.1" placeholder="e.g. 3" value={booking.age} onChange={e => setBooking({ ...booking, age: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Pet Gender *</label>
                      <select required value={booking.gender} onChange={e => setBooking({ ...booking, gender: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff' }}>
                        <option value="">Select gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="UNKNOWN">Unknown</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Is your pet aggressive? *</label>
                      <select required value={booking.aggressive} onChange={e => setBooking({ ...booking, aggressive: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff' }}>
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                        {t('date')} <span style={{ color: '#e53e3e' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={booking.date}
                        onChange={e => setBooking({ ...booking, date: e.target.value })}
                        required
                        style={{
                          width: '100%', padding: '9px 10px', border: '1.5px solid #d1e8ec',
                          borderRadius: '8px', fontSize: '12.5px', outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                        {t('timeSlot')} <span style={{ color: '#e53e3e' }}>*</span>
                      </label>
                      <select
                        value={booking.slotIndex}
                        required
                        onChange={e => setBooking({ ...booking, slotIndex: Number(e.target.value) })}
                        style={{
                          width: '100%', padding: '9px 10px', border: '1.5px solid #d1e8ec',
                          borderRadius: '8px', fontSize: '12px', outline: 'none', background: '#fff'
                        }}
                      >
                        <option value="" disabled>Select time</option>
                        {TIME_SLOTS.map((time, index) => <option key={`${time}-${index}`} value={index}>{time}{index === 24 ? ' (next day)' : ''}{isEmergencySlot(index) ? ' 🚨' : ''}</option>)}
                      </select>
                    </div>
                  </div>

                  {homeVisitEmergency && (
                    <div role="note" data-testid="emergency-note" style={{ marginBottom: '12px', padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                      🚨 Emergency hours ({EMERGENCY_HOURS_TEXT}): handled as an emergency visit at ₹{homeVisitPrice}.
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                      {t('address')} <span style={{ color: '#e53e3e' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={t('address')}
                      value={booking.address}
                      onChange={e => setBooking({ ...booking, address: e.target.value })}
                      required
                      style={{
                        width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec',
                        borderRadius: '8px', fontSize: '13px', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>
                      Concerns / Visit Details (maximum 200 words) *
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Tell us about your pet's concern or reason for the visit..."
                      value={booking.concern}
                      onChange={e => setBooking({ ...booking, concern: e.target.value.split(/\s+/).filter(Boolean).slice(0, 200).join(' ') })}
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1e8ec', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      width: '100%', padding: '14px', background: '#84cc16',
                      color: '#fff', border: 'none', borderRadius: '10px',
                      fontSize: '15px', fontWeight: '800', cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(132,204,22,0.4)', transition: 'all 0.2s'
                    }}
                  >
                    {t('bookHomeVisitNow')} →
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. OUR SERVICES — CAROUSEL + CATEGORY PILLS SECTION ─── */}
      <section id="services" style={{ padding: '40px 0', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px', padding: '0 20px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#111827' }}>Our Services</h2>
        </div>

        <ServicesCarousel />

        <div style={{ maxWidth: '1240px', margin: '36px auto 0', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {[
              { icon: '💉', name: t('vaccination'), desc: t('coreShots'), link: '/vaccination', category: 'Vaccination' },
              { icon: '🩺', name: t('services'), desc: t('onlineDoorstep'), link: '/services', category: 'Consultation' },
              { icon: '🔬', name: t('labTests'), desc: t('bloodDiagnostics'), link: '/lab-tests', category: 'Lab Tests' },
              { icon: '🏥', name: t('healthCheckup'), desc: t('preventativeWellness'), link: '/product/health-checkup', category: 'Health Checkup' },
              { icon: '✂️', name: t('grooming'), desc: t('bathsStyling'), link: '/dog-grooming', category: 'Grooming' }
            ].map(cat => {
              // Live count from the same `services` the admin/ops-head manage on Services & Fees — the category
              // string there is what decides which tile a service counts under, so this reflects real CRUD.
              const liveCount = services.filter((s) => s.category === cat.category && s.is_active !== false).length;
              return (
              <div
                key={cat.name}
                onClick={() => navigate(cat.link)}
                className="hover-card-interactive"
                style={{
                  background: '#f8fafc', padding: '22px 16px', borderRadius: '16px', border: '1px solid #e2e8f0',
                  textAlign: 'center', cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', background: '#1BAFBF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', margin: '0 auto 12px', boxShadow: '0 6px 16px rgba(27,175,191,0.3)'
                }}>
                  {cat.icon}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>{cat.name}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{cat.desc}</div>
                {services.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#1BAFBF', fontWeight: '700', marginTop: '6px' }}>
                    {liveCount} {liveCount === 1 ? 'service' : 'services'} available
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 5. OUR BEST SELLING PACKAGES ─── */}
      <section style={{ padding: '60px 20px', background: '#fcfdfd' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1BAFBF', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {t('topHealthcareSolutions')}
            </span>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#111827', marginTop: '4px' }}>
              {t('bestSelling')}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '15px', marginTop: '6px' }}>
              {t('bestSellingDescription')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
            {bestSellers.map(pkg => (
              <div
                key={pkg.id}
                className="hover-card-interactive"
                style={{
                  background: '#fff', borderRadius: '4px', padding: '0 0 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #eef2f6',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}
              >
                <div className="img-zoom-wrapper" style={{ position: 'relative', marginBottom: '18px', height: '220px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Ribbon flag: title + optional subtitle, matching the marketing-site card style */}
                  <div style={{
                    position: 'absolute', top: '16px', left: 0, zIndex: 1,
                    background: 'linear-gradient(90deg, #14a3b3, #7cc576)', color: '#fff',
                    padding: '8px 22px 8px 14px', maxWidth: '88%',
                    clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 50%, 100% 100%, 0 100%)',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', lineHeight: 1.2 }}>{pkg.title}</div>
                    {pkg.subtitle && (
                      <div style={{ fontSize: '10.5px', fontWeight: '500', opacity: 0.9, marginTop: '2px' }}>{pkg.subtitle}</div>
                    )}
                  </div>

                  <img
                    src={pkg.image}
                    alt={pkg.title}
                    style={{ width: '85%', height: '85%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400';
                    }}
                  />
                </div>

                <div style={{ padding: '0 20px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3
                    onClick={() => navigate(`/product/${pkg.slug}`)}
                    style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '8px', cursor: 'pointer' }}
                  >
                    {pkg.title}
                  </h3>

                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                    ₹{pkg.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      aria-label={wishlist.has(pkg.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                      onClick={() => setWishlist((prev) => {
                        const next = new Set(prev);
                        if (next.has(pkg.id)) { next.delete(pkg.id); showToast('Removed from wishlist'); }
                        else { next.add(pkg.id); showToast('Added to wishlist'); }
                        return next;
                      })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlist.has(pkg.id) ? '#1BAFBF' : 'none'} stroke="#1BAFBF" strokeWidth="1.8">
                        <path d="M12 21s-7.5-4.9-10.1-9.3C.3 8.7 1.6 5 5.1 4.2c2-.5 4 .3 5.1 2 .9-1.7 2.9-2.5 4.9-2 3.5.8 4.8 4.5 3.2 7.5C19.5 16.1 12 21 12 21z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Quick view ${pkg.title}`}
                      onClick={() => navigate(`/product/${pkg.slug}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0 }}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1BAFBF" strokeWidth="1.8">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() => addToCart(pkg)}
                    style={{
                      marginTop: 'auto', padding: '13px 8px', background: '#111827', color: '#fff', border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textTransform: 'uppercase',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                    </svg>
                    {t('addToCart')}
                  </button>

                  <button
                    type="button"
                    aria-label={`Book ${pkg.title} directly`}
                    onClick={() => openBookingModal(pkg)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px 0', margin: '0 auto', color: '#9ca3af' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. MEET OUR EXPERTS SECTION ─── */}
      <section id="about" style={{ padding: '60px 20px', background: '#1BAFBF' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {t('qualifiedVeterinariansLabel')}
            </span>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#fff', marginTop: '4px' }}>
              {t('doctors')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', marginTop: '6px', maxWidth: '640px', margin: '6px auto 0' }}>
              {t('doctorsDescription')}
            </p>
          </div>

          <ExpertsCarousel experts={experts} />
        </div>
      </section>

      {/* ─── 7. BROWSE ALL VETERINARY SECTION ─── matches cadovet.com's "Browse all veterinary" strip:
           white background, light-blue bordered cards, real photos (not icons). ─── */}
      <section style={{ padding: '60px 20px', background: '#fff' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#111827' }}>
              Browse all veterinary
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {[
              { title: 'Vaccination', sub: 'Dog | Cat', image: 'https://cadovet.com/wp-content/uploads/2024/11/ezgif-3-86d5bb49fe.png', link: '/vaccination' },
              { title: 'Major Minor Surgery', sub: 'By Our Experts', image: 'https://cadovet.com/wp-content/uploads/2024/12/20191117_003_4x3M-removebg-preview-300x203.png', link: '/major-minor-surgery' },
              { title: 'Treatment', sub: 'With Speedy Recovery', image: 'https://cadovet.com/wp-content/uploads/2024/11/ezgif.com-webp-to-png-converter-1.png', link: '/services' },
              { title: 'Health Checkup', sub: 'By Experienced Staff', image: 'https://cadovet.com/wp-content/uploads/2024/12/care-pets-after-surgery-min-1024x683-removebg-preview-300x200.png', link: '/product/health-checkup' },
              { title: 'Lab Tests', sub: 'Pet Health and Wellness', image: 'https://cadovet.com/wp-content/uploads/2024/12/woman-working-laboratory-close-up-300x236.jpg', link: '/lab-tests' }
            ].map(svc => (
              <div
                key={svc.title}
                onClick={() => navigate(svc.link)}
                className="hover-card-interactive"
                style={{
                  background: '#e6f4f8', borderRadius: '16px', padding: '24px 20px',
                  border: '1px solid #b8dde8', textAlign: 'center', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>{svc.title}</div>
                <div style={{ fontSize: '13px', color: '#1BAFBF', fontWeight: '600', marginBottom: '14px' }}>{svc.sub}</div>
                <img
                  src={svc.image}
                  alt={svc.title}
                  style={{ width: '100%', maxWidth: '160px', height: '140px', objectFit: 'contain' }}
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=300'; }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 8. RECENT PET CARE BLOGS ─── */}
      <section id="blogs" style={{ padding: '60px 20px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1BAFBF', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {t('petWellnessKnowledge')}
            </span>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#111827', marginTop: '4px' }}>
              {t('recentGuides')}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {HOMEPAGE_RECENT_BLOG_SLUGS.map((slug) => BLOG_POSTS.find((b) => b.slug === slug)).filter(Boolean).map(blog => (
              <div
                key={blog.slug}
                className="hover-card-interactive"
                style={{
                  background: '#fff', borderRadius: '16px', padding: '20px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid #eef2f6',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                onClick={() => navigate('/blog')}
              >
                <div>
                  <div className="img-zoom-wrapper" style={{ height: '180px', borderRadius: '12px', marginBottom: '14px', overflow: 'hidden' }}>
                    <img
                      src={blog.image}
                      alt={blog.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = 'https://cadovet.com/wp-content/uploads/2024/11/img-logo.png';
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: '#1BAFBF', fontWeight: '700', marginBottom: '6px' }}>
                    {blog.category} • {blog.date}
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', marginBottom: '8px', lineHeight: 1.3 }}>
                    {blog.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                    {blog.excerpt}
                  </p>
                </div>
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#1BAFBF', fontWeight: '700', fontSize: '13px' }}>
                    {t('readFullArticle')} →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 9. FREQUENTLY ASKED QUESTIONS ACCORDION ─── */}
      <section style={{ padding: '60px 20px', background: '#fff' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1BAFBF', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {t('clearAnswers')}
            </span>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#111827', marginTop: '4px' }}>
              {t('frequentlyAskedQuestions')}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, idx) => (
              <div
                key={faq.q}
                style={{
                  border: '1.5px solid #eef2f6', borderRadius: '12px',
                  background: openFaq === idx ? '#f8fafc' : '#fff', overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                  style={{
                    padding: '18px 20px', fontWeight: '700', fontSize: '15px', color: '#111827',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ fontSize: '18px', color: '#1BAFBF' }}>{openFaq === idx ? '−' : '+'}</span>
                </div>
                {openFaq === idx && (
                  <div style={{ padding: '0 20px 18px', fontSize: '13.5px', color: '#4b5563', lineHeight: 1.6 }}>
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

export default HomePage;
