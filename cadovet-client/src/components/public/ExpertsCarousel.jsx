import React, { useEffect, useMemo, useRef, useState } from 'react';

// "Meet Our Expert(s)" carousel: a sliding window of doctor cards (3 visible on desktop, fewer on narrow
// screens) that advances one card at a time — one dot per scroll position, matching the public marketing site.
const AUTO_ADVANCE_MS = 4000;

const useVisibleCount = () => {
  const compute = () => (typeof window === 'undefined' ? 3 : window.innerWidth < 640 ? 1 : window.innerWidth < 960 ? 2 : 3);
  const [visible, setVisible] = useState(compute);
  useEffect(() => {
    const onResize = () => setVisible(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return visible;
};

const ExpertsCarousel = ({ experts }) => {
  const visible = useVisibleCount();
  const maxStart = Math.max(experts.length - visible, 0);
  const [start, setStart] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => { setStart((s) => Math.min(s, maxStart)); }, [maxStart]);

  useEffect(() => {
    if (maxStart <= 0) return undefined;
    timerRef.current = setInterval(() => setStart((s) => (s >= maxStart ? 0 : s + 1)), AUTO_ADVANCE_MS);
    return () => clearInterval(timerRef.current);
  }, [maxStart, start]);

  const dotCount = maxStart + 1;
  const goTo = (next) => setStart(((next % dotCount) + dotCount) % dotCount);
  const cardWidthPct = 100 / visible;

  const cards = useMemo(() => experts, [experts]);

  return (
    <div
      onMouseEnter={() => clearInterval(timerRef.current)}
      onMouseLeave={() => {
        if (maxStart > 0) timerRef.current = setInterval(() => setStart((s) => (s >= maxStart ? 0 : s + 1)), AUTO_ADVANCE_MS);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {maxStart > 0 && (
          <button
            type="button"
            aria-label="Previous experts"
            onClick={() => goTo(start - 1)}
            style={{
              flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              width: '38px', height: '38px', borderRadius: '50%', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
        )}

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', gap: '24px', transition: 'transform 550ms ease-in-out',
            transform: `translateX(calc(-${start} * (${cardWidthPct}% + ${24 / visible}px)))`,
          }}>
            {cards.map((doc) => (
              <div
                key={doc.name}
                style={{
                  flex: `0 0 calc(${cardWidthPct}% - ${24 * (visible - 1) / visible}px)`,
                  background: '#fff', borderRadius: '14px', padding: '20px 20px 24px',
                  textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                }}
              >
                <div style={{
                  width: '100%', aspectRatio: '4 / 5', borderRadius: '8px', overflow: 'hidden',
                  marginBottom: '16px', background: '#f1f5f9',
                }}>
                  <img
                    src={doc.image}
                    alt={doc.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300'; }}
                  />
                </div>

                <div style={{ width: '32px', height: '3px', background: '#1BAFBF', margin: '0 auto 14px' }} />

                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
                  {doc.name}
                </h3>
                <div style={{ fontSize: '12.5px', color: '#4b5563', marginBottom: '2px' }}>
                  {doc.qualification}
                </div>
                <div style={{ fontSize: '12.5px', color: '#6b7280', fontStyle: 'italic' }}>
                  ({doc.title})
                </div>
              </div>
            ))}
          </div>
        </div>

        {maxStart > 0 && (
          <button
            type="button"
            aria-label="Next experts"
            onClick={() => goTo(start + 1)}
            style={{
              flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              width: '38px', height: '38px', borderRadius: '50%', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
        )}
      </div>

      {maxStart > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '28px' }}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to expert ${i + 1}`}
              onClick={() => goTo(i)}
              style={{
                width: '9px', height: '9px', borderRadius: '50%', border: 'none',
                cursor: 'pointer', padding: 0,
                background: i === start ? '#111827' : 'rgba(255,255,255,0.6)',
                transition: 'background 250ms ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpertsCarousel;
