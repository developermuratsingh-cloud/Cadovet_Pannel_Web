// One canonical form for mobile numbers, shared by the mobile app, the website and the admin portal, so a number
// typed as "+91 98765-43210" anywhere finds the same account as "9876543210" everywhere.
//   India (+91)  -> the plain 10-digit national number  ("9876543210")   <- how accounts have always been stored
//   other        -> "+" and digits                      ("+14155552671")
const MOBILE = /^\+?[0-9]{7,15}$/;
const INDIAN_NATIONAL = /^[6-9][0-9]{9}$/;

exports.canonicalMobile = (raw) => {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let v = String(raw).trim().replace(/[\s\-().]/g, '');
  if (/^\+91[0-9]{10}$/.test(v)) v = v.slice(3);
  if (!MOBILE.test(v)) return null;
  // A bare 10-digit number is an Indian mobile number, which always starts with 6-9 (rules out 0000000000, 1234567890).
  if (/^[0-9]{10}$/.test(v) && !INDIAN_NATIONAL.test(v)) return null;
  return v;
};

// Login / reset identifiers may be an email or a mobile number; a mobile number is normalised, anything else is left alone.
exports.normalizeIdentifier = (raw) => {
  if (typeof raw !== 'string') return raw;
  const v = raw.trim();
  if (v.includes('@')) return v;
  return exports.canonicalMobile(v) || v;
};
