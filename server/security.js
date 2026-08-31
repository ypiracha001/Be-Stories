/* =========================================================================
   be stories. — request hardening
   Validation, sanitisation, escaping, origin checks and response headers.
   Nothing here changes behaviour the visitor can see.
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

/* ---- field limits ------------------------------------------------------ */
const LIMITS = {
  name: 120, company: 160, role: 120, email: 254, website: 300,
  timing: 160, engagement: 60, budget: 60, summary: 4000,
  working_on: 4000, change: 4000, timezone: 64, start: 40,
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/* Strip control characters (including CR/LF, which is how header injection
   gets into mail), collapse runs of whitespace, then hard-cap the length. */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n|\r|\n/g, '\n')
    .trim()
    .slice(0, max || 500);
}

/* Single-line values that end up in mail headers or event titles must never
   contain a newline at all. */
const oneLine = (v, max) => clean(v, max).replace(/\n+/g, ' ');

/* Google Calendar renders a limited HTML subset in event descriptions, so
   user text is escaped before it goes anywhere near one. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* Take only the fields we expect, of the type we expect. Anything else the
   client sends is discarded rather than trusted. */
function shape(body, fields) {
  const out = {};
  for (const f of fields) {
    const raw = body && body[f];
    if (raw === undefined || raw === null) { out[f] = ''; continue; }
    if (typeof raw !== 'string' && typeof raw !== 'number') { out[f] = ''; continue; }
    out[f] = (f === 'summary' || f === 'working_on' || f === 'change')
      ? clean(String(raw), LIMITS[f])
      : oneLine(String(raw), LIMITS[f]);
  }
  return out;
}

const BOOKING_FIELDS = ['name', 'email', 'company', 'role', 'website', 'engagement',
  'summary', 'budget', 'start', 'timezone'];
const ENQUIRY_FIELDS = ['name', 'company', 'role', 'email', 'website', 'timing',
  'engagement', 'working_on', 'change', 'budget'];

function validateBooking(body) {
  const d = shape(body, BOOKING_FIELDS);
  const errors = [];
  for (const f of ['name', 'email', 'company', 'summary', 'start']) {
    if (!d[f]) errors.push('missing_' + f);
  }
  if (d.email && !EMAIL.test(d.email)) errors.push('bad_email');
  const start = new Date(d.start);
  if (isNaN(start.getTime())) errors.push('bad_start');
  else if (start.getTime() < Date.now()) errors.push('start_in_past');
  if (d.timezone && !/^[A-Za-z0-9_+\-/]{1,64}$/.test(d.timezone)) d.timezone = '';
  return { data: d, start, errors };
}

function validateEnquiry(body) {
  const d = shape(body, ENQUIRY_FIELDS);
  const errors = [];
  for (const f of ['name', 'email', 'working_on']) if (!d[f]) errors.push('missing_' + f);
  if (d.email && !EMAIL.test(d.email)) errors.push('bad_email');
  return { data: d, errors };
}

/* ---- origin ------------------------------------------------------------
   No cookies are used, so classic CSRF has nothing to ride on. These two
   checks close the remaining gap: a cross-site HTML form cannot set
   application/json, and any script that could would need CORS anyway.      */
function enforceJson(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.startsWith('application/json')) {
    return res.status(415).json({ error: 'unsupported_media_type' });
  }
  next();
}

function sameOrigin(allowedOrigins) {
  const allowed = new Set(allowedOrigins.filter(Boolean));
  return function (req, res, next) {
    const origin = req.headers.origin;
    if (!origin) return next();              // same-origin fetch may omit it
    if (allowed.has(origin)) return next();
    return res.status(403).json({ error: 'bad_origin' });
  };
}

/* ---- response headers -------------------------------------------------- */
function loadCspHashes(dist) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dist, 'csp-hashes.json'), 'utf8'));
  } catch (_) { return {}; }
}

/**
 * Security headers. The CSP is per-path: build.py records the sha256 of every
 * inline JSON-LD block, so structured data survives without 'unsafe-inline'
 * on script-src.
 */
function headers({ dist, hsts = true }) {
  const hashes = loadCspHashes(dist);
  return function (req, res, next) {
    const p = req.path.endsWith('/') ? req.path : req.path + '/';
    const inline = (hashes[p] || []).map(h => `'${h}'`).join(' ');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self'${inline ? ' ' + inline : ''}`,
      // style attributes are used for per-section spacing in the approved design
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    next();
  };
}

module.exports = {
  LIMITS, EMAIL, clean, oneLine, escapeHtml, shape,
  validateBooking, validateEnquiry, enforceJson, sameOrigin, headers,
};
