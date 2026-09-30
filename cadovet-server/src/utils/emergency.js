// Emergency hours: a visit that starts from 9:00 PM up to (not including) 9:00 AM is an emergency booking. The rule
// lives here, once, on the server; the app and the website only display what the API tells them.
const { parseSlotTime, EMERGENCY_FROM, EMERGENCY_UNTIL, isEmergencyMinutes } = require('./slots');
// The window itself (9:00 PM up to, not including, 9:00 AM) is defined in slots.js next to the slot rules that use it.

// "10:00 PM to 12:00 AM" -> the start of the window. The website's doorstep form books windows, not exact slots.
const WINDOW = /^\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s+to\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s*$/i;

// The start of a stored time ("10:30 PM") or window ("10:00 PM to 12:00 AM") in minutes since midnight, else null.
const startMinutes = (raw) => {
  const exact = parseSlotTime(raw);
  if (exact !== null) return exact;
  const window = WINDOW.exec(String(raw ?? ''));
  return window ? parseSlotTime(window[1]) : null;
};

// A visit is an emergency when it STARTS in emergency hours. Anything without a readable start is not.
const isEmergencyTime = (raw) => {
  const mins = startMinutes(raw);
  return mins !== null && isEmergencyMinutes(mins);
};

// What the service costs for this visit. An emergency visit uses the service's emergency price when one is set and
// falls back to the normal price otherwise.
const effectivePrice = (service, emergency) =>
  emergency && service.emergency_price !== null && service.emergency_price !== undefined
    ? Number(service.emergency_price)
    : Number(service.price);

// When a visit moves into or out of emergency hours, an invoice that is still unpaid is re-priced to match. It only
// happens for a service that has an emergency price (otherwise the price never depended on the hour), and only while the
// invoice is PENDING: a paid invoice is a record of what was actually charged and is left alone. Tax and discount stay.
// `q` is the query function to use (the pool, or a transaction's client).
async function repriceUnpaidInvoice(q, appointmentId) {
  const found = await q(
    `SELECT a.is_emergency, s.price, s.emergency_price FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.id = $1`,
    [appointmentId]
  );
  const row = found.rows[0];
  if (!row || row.emergency_price === null) return [];
  const subtotal = effectivePrice(row, row.is_emergency);
  const updated = await q(
    `UPDATE invoices SET subtotal = $1, total_amount = GREATEST(0, $1 + COALESCE(tax, 0) - COALESCE(discount, 0))
     WHERE appointment_id = $2 AND payment_status = 'PENDING' AND subtotal <> $1
     RETURNING id, subtotal, total_amount`,
    [subtotal, appointmentId]
  );
  return updated.rows;
}

module.exports = { EMERGENCY_FROM, EMERGENCY_UNTIL, isEmergencyMinutes, isEmergencyTime, effectivePrice, repriceUnpaidInvoice };
