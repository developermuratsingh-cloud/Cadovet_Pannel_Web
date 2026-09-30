// Delivery of one-time codes by email (SMTP) and SMS (Twilio). Each channel is optional: when it is not configured the
// code is written to the server console instead, so local development works without any provider account.
//
// Email  – any SMTP provider (Gmail, Amazon SES, SendGrid, Brevo, Zoho, …):
//          SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for port 465), SMTP_USER, SMTP_PASS, MAIL_FROM
// SMS    – Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (a number) or TWILIO_MESSAGING_SERVICE_SID
//          SMS_DEFAULT_COUNTRY_CODE (default 91) is prepended to national-format numbers such as 9876543210.
//          TWILIO_API_BASE overrides https://api.twilio.com (used by tests).
//
// To support another SMS vendor (e.g. MSG91), add a function next to sendViaTwilio and select it in sendSms.
const nodemailer = require('nodemailer');

const TIMEOUT_MS = 10_000;

const emailConfigured = () => !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
const smsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));

let transporter;
const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }
  return transporter;
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Digits only, with the country code: "98765 43210" -> "+919876543210", "+14155550123" stays as is.
const toE164 = (mobile) => {
  const raw = String(mobile || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+${process.env.SMS_DEFAULT_COUNTRY_CODE || '91'}${digits}`;
  return `+${digits}`;
};

const sendEmail = async ({ to, subject, text, html }) =>
  getTransporter().sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });

const sendViaTwilio = async (to, body) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const base = (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/$/, '');
  const form = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set('From', process.env.TWILIO_FROM);

  const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SMS provider responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

const sendSms = (to, body) => sendViaTwilio(to, body);

// channel: 'email' | 'mobile' – the same one the user typed, so the code goes where they asked for it.
exports.sendResetCode = async ({ name, email, mobile }, code, ttlMinutes, channel) => {
  if (channel === 'email' && email) {
    if (!emailConfigured()) {
      console.log(`[password-reset] (email not configured) code for ${name} <${email}>: ${code} (valid ${ttlMinutes} min)`);
      return;
    }
    const first = escapeHtml(String(name || '').split(' ')[0] || 'there');
    await sendEmail({
      to: email,
      subject: 'Your Cado Vet password reset code',
      text: `Hi ${String(name || '').split(' ')[0] || 'there'},\n\nYour Cado Vet password reset code is ${code}.\nIt is valid for ${ttlMinutes} minutes and can be used once.\n\nIf you did not ask to reset your password, you can ignore this email — your password will not change.\n\n— Team Cado Vet`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1a2332">
        <h2 style="color:#1BAFBF;margin-bottom:4px">CADO<span style="color:#84CC16">VET</span></h2>
        <p>Hi ${first},</p>
        <p>Use this code to reset your Cado Vet password:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;background:#E0F7F9;padding:14px 18px;border-radius:12px;text-align:center">${code}</p>
        <p>It is valid for ${ttlMinutes} minutes and can be used once.</p>
        <p style="color:#718096;font-size:13px">If you did not ask to reset your password, you can ignore this email — your password will not change.</p></div>`,
    });
    return;
  }

  if (channel === 'mobile' && mobile) {
    const to = toE164(mobile);
    if (!smsConfigured()) {
      console.log(`[password-reset] (SMS not configured) code for ${name} <${to}>: ${code} (valid ${ttlMinutes} min)`);
      return;
    }
    await sendSms(to, `Your Cado Vet password reset code is ${code}. It is valid for ${ttlMinutes} minutes. Do not share it with anyone.`);
    return;
  }

  console.log(`[password-reset] no delivery address for ${name}; code: ${code}`);
};

// Sign-in / sign-up / account-deletion code, always by SMS. Like the reset code, it is printed to the server console
// when SMS is not configured, so local development works without a provider.
exports.sendMobileCode = async (mobile, code, ttlMinutes) => {
  const to = toE164(mobile);
  if (!smsConfigured()) {
    console.log(`[otp] (SMS not configured) code for <${to}>: ${code} (valid ${ttlMinutes} min)`);
    return;
  }
  await sendSms(to, `${code} is your Cado Vet verification code. It is valid for ${ttlMinutes} minutes. Do not share it with anyone.`);
};

exports.toE164 = toE164;
exports.emailConfigured = emailConfigured;
exports.smsConfigured = smsConfigured;
