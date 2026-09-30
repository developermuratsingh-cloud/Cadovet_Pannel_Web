import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// The full-bleed "Our Services" banner on the homepage: a slide per service line, auto-advancing, with
// left/right arrows and dot indicators. Mirrors the carousel on the public marketing site.
const SLIDES = [
  {
    key: 'vaccination',
    title: 'Vaccination',
    description: "Veterinary vaccination services protect pets from diseases like rabies and parvovirus, ensuring their health and safety. They prevent illness spread and are tailored to each pet's needs.",
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1600&q=80',
    link: '/vaccination',
  },
  {
    key: 'consultation',
    title: 'Consultation',
    description: 'Our veterinarians offer online and doorstep consultations, diagnosing concerns early and guiding you through the right next steps for your pet, without the stress of a clinic visit.',
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=1600&q=80',
    link: '/services',
  },
  {
    key: 'lab-tests',
    title: 'Lab Tests',
    description: 'From CBC panels to viral screening and sonography, our diagnostic lab tests are collected at home and reported by qualified radiologists and pathologists.',
    image: 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=1600&q=80',
    link: '/lab-tests',
  },
  {
    key: 'health-checkup',
    title: 'Health Checkup',
    description: 'A comprehensive physical examination, vitals check and wellness review performed by experienced clinical staff, catching problems long before they become serious.',
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1600&q=80',
    link: '/product/health-checkup',
  },
  {
    key: 'grooming',
    title: 'Grooming',
    description: 'Medicated baths, de-shedding, nail clipping and breed-specific styling delivered at your doorstep, so grooming day is never a stressful trip for your pet.',
    image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=1600&q=80',
    link: '/dog-grooming',
  },
];

const AUTO_ADVANCE_MS = 5500;

const ServicesCarousel = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const goTo = useCallback((next) => {
    setIndex(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timerRef.current);
  }, [index]);

  const slide = SLIDES[index];

  return (
    <div
      style={{ position: 'relative', width: '100%', height: 'min(65vh, 560px)', minHeight: '380px', overflow: 'hidden', background: '#111827' }}
      onMouseEnter={() => clearInterval(timerRef.current)}
      onMouseLeave={() => { timerRef.current = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTO_ADVANCE_MS); }}
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.key}
          aria-hidden={i !== index}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(15,23,42,0.35), rgba(15,23,42,0.55)), url(${s.image})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            padding: '20px', opacity: i === index ? 1 : 0,
            transition: 'opacity 700ms ease-in-out', pointerEvents: i === index ? 'auto' : 'none',
          }}
        >
          <div style={{ maxWidth: '720px' }}>
            <h3 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: '900', color: '#fff', marginBottom: '16px', letterSpacing: '-0.5px' }}>
              {s.title}
            </h3>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'rgba(255,255,255,0.9)', marginBottom: '26px' }}>
              {s.description}
            </p>
            <button
              type="button"
              onClick={() => navigate(s.link)}
              style={{
                background: 'transparent', border: '1.5px solid #fff', color: '#fff',
                padding: '11px 32px', borderRadius: '30px', fontSize: '14px', fontWeight: '700',
                cursor: 'pointer', letterSpacing: '0.3px',
              }}
            >
              Read More
            </button>
          </div>
        </div>
      ))}

      {/* Prev / Next arrows */}
      <button
        type="button"
        aria-label="Previous service"
        onClick={() => goTo(index - 1)}
        style={{
          position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', color: '#fff', fontSize: '32px',
          cursor: 'pointer', padding: '8px', lineHeight: 1, opacity: 0.85,
        }}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next service"
        onClick={() => goTo(index + 1)}
        style={{
          position: 'absolute', top: '50%', right: '16px', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', color: '#fff', fontSize: '32px',
          cursor: 'pointer', padding: '8px', lineHeight: 1, opacity: 0.85,
        }}
      >
        ›
      </button>

      {/* Dot indicators */}
      <div style={{ position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' }}>
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Go to ${s.title} slide`}
            onClick={() => goTo(i)}
            style={{
              width: i === index ? '22px' : '8px', height: '8px', borderRadius: '4px',
              border: 'none', cursor: 'pointer', padding: 0,
              background: i === index ? '#fff' : 'rgba(255,255,255,0.5)',
              transition: 'width 250ms ease, background 250ms ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ServicesCarousel;
