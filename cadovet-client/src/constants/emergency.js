// Emergency hours: a visit that starts from 9:00 PM up to (not including) 9:00 AM is an emergency booking, priced with
// the service's emergency price. The server decides this (and enforces the price); this file only lets the forms show
// it before the customer submits. Keep it in step with cadovet-server/src/utils/emergency.js.

// The website offers hourly slots from 9 AM to 9 AM the next morning.
export const TIME_SLOTS = [
  '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM', '12:00 AM', '01:00 AM', '02:00 AM',
  '03:00 AM', '04:00 AM', '05:00 AM', '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM',
];

export const EMERGENCY_HOURS_TEXT = '9 PM – 9 AM';

const toMinutes = (label) => {
  const m = String(label).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

export const isEmergencyTime = (label) => {
  const mins = toMinutes(label);
  return mins !== null && (mins >= 21 * 60 || mins < 9 * 60);
};

// TIME_SLOTS position -> emergency?
export const isEmergencySlot = (index) => isEmergencyTime(TIME_SLOTS[index]);

// From 12:00 AM the slot is the early morning after the chosen date, so it is booked under the next calendar date.
export const NEXT_DAY_FROM = TIME_SLOTS.indexOf('12:00 AM');
export const isNextDaySlot = (index) => index >= NEXT_DAY_FROM;

export const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const slotDate = (isoDate, index) => (isNextDaySlot(index) ? addDays(isoDate, 1) : isoDate);

// What the service costs for this visit: its emergency price in emergency hours when one is set, else the normal price.
export const priceFor = (service, emergency, fallback = 0) => {
  if (!service) return fallback;
  if (emergency && service.emergency_price !== null && service.emergency_price !== undefined && service.emergency_price !== '') return Number(service.emergency_price);
  return Number(service.price ?? fallback);
};

// The service the server books a plain home visit under: by name, then anything "Home Visit", then "Consultation".
export const findHomeVisitService = (services = []) => {
  const has = (s, text) => String(s.name || '').toLowerCase().includes(text);
  return services.find((s) => has(s, 'home visit consultation')) || services.find((s) => has(s, 'home visit')) || services.find((s) => has(s, 'consultation')) || null;
};
