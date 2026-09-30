// Small shared validators. Each returns an error message string, or null when the value is acceptable.

const pad = (n) => String(n).padStart(2, '0');

// Server-local calendar date as YYYY-MM-DD.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isRealDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

exports.validateName = (name) => {
  const v = String(name ?? '').trim();
  if (v.length < 2) return 'Name must be at least 2 characters';
  if (v.length > 60) return 'Name must be at most 60 characters';
  return null;
};

// Staff password policy: 8-72 characters with at least one letter and one digit (72 is bcrypt's limit).
exports.validatePassword = (password) => {
  const v = String(password ?? '');
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (v.length > 72) return 'Password must be at most 72 characters';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Password must contain at least one letter and one number';
  return null;
};

// Shared with slots.js so "today" and "right now" always mean the same server-local moment everywhere a booking
// date/time gets checked.
exports.today = today;

// A booking date must be a real calendar date that is not in the past.
exports.validateBookingDate = (date) => {
  if (!isRealDate(String(date ?? ''))) return 'Appointment date must be a valid date (YYYY-MM-DD)';
  if (date < today()) return 'Appointment date cannot be in the past';
  return null;
};

exports.validatePetFields = ({ name, weight, date_of_birth }, { partial = false } = {}) => {
  if (name !== undefined || !partial) {
    const n = String(name ?? '').trim();
    if (!n) return 'Pet name is required';
    if (n.length > 100) return 'Pet name must be at most 100 characters';
  }
  if (weight !== undefined && weight !== null && weight !== '') {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0 || w > 200) return 'Weight must be between 0 and 200 kg';
  }
  if (date_of_birth) {
    if (!isRealDate(String(date_of_birth).slice(0, 10))) return 'Date of birth must be a valid date (YYYY-MM-DD)';
    if (String(date_of_birth).slice(0, 10) > today()) return 'Date of birth cannot be in the future';
  }
  return null;
};
