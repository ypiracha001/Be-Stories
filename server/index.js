/* =========================================================================
   be stories. — booking service
   Node 18+. Serves dist/ and provides three endpoints:
     GET  /api/availability?month=YYYY-M&tz=Europe/London
     POST /api/book
     POST /api/enquiry
   Real Google Calendar freebusy, real Google Meet conferencing, real invites.
   Nothing here is simulated. If credentials are absent the endpoints return
   503 and the front end degrades to the written enquiry route.
   ========================================================================= */
'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { SCOPES, audit, short } = require('./scopes');
const sec = require('./security');

const {
  PORT = 3000,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_ACCOUNT = 'admin@bestories.co.uk',   // the Workspace identity that owns the calendar
  CALENDAR_ID = 'primary',                    // 'primary' = that account's own calendar
  STUDIO_EMAIL = 'hello@bestories.co.uk', // correspondence address, not the calendar identity
  STUDIO_ATTENDEES = '',                      // optional extra internal invitees, comma separated
  BOOKING_TZ = 'Europe/London',
  WORK_START = '10:00',
  WORK_END = '17:00',
  SLOT_MINUTES = '30',
  LEAD_HOURS = '18',
  HORIZON_DAYS = '45',
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
  MANAGE_SECRET,
  PUBLIC_URL = 'https://bestories.co.uk',
  TRUST_PROXY = '1',
} = process.env;

const SLOT = parseInt(SLOT_MINUTES, 10);
const configured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN);

/* ---- manage links -------------------------------------------------------
   A booking is managed with an HMAC of its event id. No session, no database,
   nothing to leak: the link works only for the person Google emailed it to.  */
const secret = MANAGE_SECRET || GOOGLE_CLIENT_SECRET || '';
function sign(eventId) {
  return crypto.createHmac('sha256', secret).update(String(eventId)).digest('base64url').slice(0, 32);
}
function verify(eventId, token) {
  if (!eventId || !token || !secret) return false;
  /* Hash both sides to a fixed 32 bytes before comparing, so the comparison
     is timing-safe regardless of the length of the supplied token. */
  const a = crypto.createHash('sha256').update(sign(eventId)).digest();
  const b = crypto.createHash('sha256').update(String(token)).digest();
  return crypto.timingSafeEqual(a, b);
}
function manageUrl(eventId) {
  return `${PUBLIC_URL}/manage/?e=${encodeURIComponent(eventId)}&t=${sign(eventId)}`;
}

function mailer() {
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

/* ---- conference creation -------------------------------------------------
   Meet links are created asynchronously. events.insert usually returns
   hangoutLink populated, but conferenceData.createRequest.status.statusCode
   can come back 'pending'. Poll briefly rather than reporting a null link.   */
async function settleConference(cal, event) {
  let data = event;
  let status = data.conferenceData?.createRequest?.status?.statusCode;
  for (let i = 0; i < 3 && !data.hangoutLink && status === 'pending'; i++) {
    await new Promise(r => setTimeout(r, 700));
    const again = await cal.events.get({ calendarId: CALENDAR_ID, eventId: data.id });
    data = again.data;
    status = data.conferenceData?.createRequest?.status?.statusCode;
  }
  const link = data.hangoutLink ||
    (data.conferenceData?.entryPoints || []).find(e => e.entryPointType === 'video')?.uri || null;
  if (!link) console.warn('conference not created for %s (status: %s)', data.id, status || 'unknown');
  return link;
}

function calendarClient() {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

/* ---- time helpers ------------------------------------------------------- */
/* Build a UTC instant for a wall-clock time in an IANA zone, without pulling
   a date library in. Offset is resolved by formatting a probe date in the
   target zone and measuring the delta. */
function zonedToUtc(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const asZone = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (asZone - guess));
}

function weekdayInZone(date, tz) {
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s);
}

function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

/* Candidate slots for one studio-local day, as UTC instants. */
function candidates(y, m, d) {
  const [sh, sm] = WORK_START.split(':').map(Number);
  const [eh, em] = WORK_END.split(':').map(Number);
  const out = [];
  for (let t = sh * 60 + sm; t + SLOT <= eh * 60 + em; t += SLOT) {
    out.push(zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, BOOKING_TZ));
  }
  return out;
}

function overlaps(start, end, busy) {
  return busy.some(b => start < new Date(b.end) && end > new Date(b.start));
}

/* ---- app ---------------------------------------------------------------- */
const DIST = path.join(__dirname, '..', 'dist');

const app = express();
app.disable('x-powered-by');
app.set('env', 'production');           // never render stack traces
app.set('trust proxy', Number(TRUST_PROXY));
app.use(sec.headers({ dist: DIST }));
app.use(express.json({ limit: '32kb' }));

/* Read endpoints are cheap; the two that write are not. */
app.use('/api', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));
const writeLimit = rateLimit({
  windowMs: 10 * 60_000, max: 6, standardHeaders: true, legacyHeaders: false,
  message: { error: 'too_many_requests' },
});
const originGuard = sec.sameOrigin([PUBLIC_URL, PUBLIC_URL.replace('https://', 'https://www.')]);
const writeGuards = [writeLimit, sec.enforceJson, originGuard];

/* Public. Operational states only — no scopes, no calendar id, no identity,
   no configuration values. Diagnostics live in the server log and in
   `npm run verify`. */
app.get('/api/health', (req, res) => {
  const okCal = Boolean(configured);
  res.json({
    status: okCal ? 'operational' : 'degraded',
    calendar: okCal ? 'connected' : 'not_connected',
    availability: okCal ? 'operational' : 'unavailable',
    booking: okCal && Boolean(secret) ? 'operational' : 'unavailable',
    enquiries: SMTP_HOST ? 'operational' : 'unavailable',
  });
});

app.get('/api/availability', async (req, res) => {
  if (!configured) return res.status(503).json({ error: 'calendar_not_connected' });
  try {
    const [ys, ms] = String(req.query.month || '').split('-');
    const y = parseInt(ys, 10), m = parseInt(ms, 10);
    if (!y || !m) return res.status(400).json({ error: 'bad_month' });

    const now = new Date();
    const lead = new Date(now.getTime() + parseInt(LEAD_HOURS, 10) * 3600e3);
    const horizon = new Date(now.getTime() + parseInt(HORIZON_DAYS, 10) * 864e5);

    const timeMin = zonedToUtc(y, m, 1, 0, 0, BOOKING_TZ);
    const timeMax = zonedToUtc(y, m, daysInMonth(y, m), 23, 59, BOOKING_TZ);
    if (timeMax < lead || timeMin > horizon) return res.json({ days: {} });

    const cal = calendarClient();
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
        timeZone: BOOKING_TZ, items: [{ id: CALENDAR_ID }],
      },
    });
    const busy = (fb.data.calendars[CALENDAR_ID] || {}).busy || [];

    const days = {};
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const open = [];
      for (const start of candidates(y, m, d)) {
        const end = new Date(start.getTime() + SLOT * 60e3);
        const dow = weekdayInZone(start, BOOKING_TZ);
        if (dow === 0 || dow === 6) continue;          // studio does not take calls at weekends
        if (start < lead || start > horizon) continue; // notice period and booking horizon
        if (overlaps(start, end, busy)) continue;      // no double booking
        open.push(start.toISOString());
      }
      if (open.length) days[key] = open;
    }
    res.json({ days, timezone: BOOKING_TZ, slotMinutes: SLOT });
  } catch (err) {
    console.error('availability', err.message);
    res.status(502).json({ error: 'calendar_unavailable' });
  }
});

app.post('/api/book', writeGuards, async (req, res) => {
  if (!configured) return res.status(503).json({ error: 'calendar_not_connected' });
  const { data: b, start, errors } = sec.validateBooking(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  const end = new Date(start.getTime() + SLOT * 60e3);

  try {
    const cal = calendarClient();

    // Re-check immediately before writing: the slot may have gone since the page loaded.
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(), timeMax: end.toISOString(),
        timeZone: BOOKING_TZ, items: [{ id: CALENDAR_ID }],
      },
    });
    if (((fb.data.calendars[CALENDAR_ID] || {}).busy || []).length) {
      return res.status(409).json({ error: 'slot_taken' });
    }

    /* Calendar descriptions render a limited HTML subset, so everything the
       visitor typed is escaped before it is placed in one. */
    const e = sec.escapeHtml;
    const description = [
      `Name: ${e(b.name)}`,
      `Company: ${e(b.company)}`,
      b.role ? `Role: ${e(b.role)}` : null,
      b.website ? `Website: ${e(b.website)}` : null,
      b.engagement ? `Engagement: ${e(b.engagement)}` : null,
      b.budget ? `Indicative investment: ${e(b.budget)}` : null,
      '',
      'Project summary:',
      e(b.summary),
      '',
      'Booked via bestories.co.uk',
    ].filter(Boolean).join('\n');

    const event = await cal.events.insert({
      calendarId: CALENDAR_ID,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: 'Be Stories — Introductory Conversation',
        description,
        start: { dateTime: start.toISOString(), timeZone: b.timezone || BOOKING_TZ },
        end: { dateTime: end.toISOString(), timeZone: b.timezone || BOOKING_TZ },
        /* The organiser is whoever owns CALENDAR_ID — that is GOOGLE_ACCOUNT.
           It is never set here: asserting it on an attendee is ignored at best
           and rejected at worst. Extra internal invitees are optional. */
        attendees: [{ email: b.email, displayName: sec.oneLine(b.name, 120) }].concat(
          STUDIO_ATTENDEES.split(',').map(s => s.trim()).filter(Boolean).map(email => ({ email }))
        ),
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        reminders: { useDefault: false, overrides: [
          { method: 'email', minutes: 1440 }, { method: 'popup', minutes: 15 },
        ] },
        conferenceData: {
          createRequest: {
            /* Must be unique per conference. Google treats a repeated
               requestId as a retry and returns the same conference, so a
               UUID here is what stops two bookings sharing a Meet room. */
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink = await settleConference(cal, event.data);
    const manage = manageUrl(event.data.id);
    if (!meetLink) {
      console.error('MEET_FAILED event=%s — booking kept, join link missing', event.data.id);
    }

    /* Google sends the invitation itself (sendUpdates: 'all'). This is the
       studio's own confirmation, and it is the only place the manage link
       is issued. If SMTP is not configured the booking still stands. */
      const tx = mailer();
      if (tx) {
        const when = start.toLocaleString('en-GB', {
          timeZone: b.timezone || BOOKING_TZ
        });

        try {
          await tx.sendMail({
            from: `Be Stories <${STUDIO_EMAIL}>`,
            to: b.email,
            cc: STUDIO_EMAIL,
            replyTo: STUDIO_EMAIL,
            subject: 'Be Stories — Introductory Conversation',
            text: [
              `${b.name}`, '',
              'Your conversation with the studio is confirmed.', '',
              `When: ${when} (${b.timezone || BOOKING_TZ})`,
              'Duration: 30 minutes',
              meetLink ? `Google Meet: ${meetLink}` : '',
              '', `Reschedule or cancel: ${manage}`,
              '', 'Be Stories', 'bestories.co.uk',
            ].filter(Boolean).join('\n'),
          });
        } catch (err) {
          console.error('confirmation mail', err.message);
        }
      }
    res.json({
      ok: true,
      meet: meetLink,
      eventId: event.data.id,
      start: start.toISOString(),
      manage,
      meetStatus: meetLink ? 'created' : 'unavailable',
    });
  } catch (err) {
    console.error('book', err.message);
    res.status(502).json({ error: 'calendar_write_failed' });
  }
});

app.get('/api/manage', async (req, res) => {
  if (!configured) return res.status(503).json({ error: 'calendar_not_connected' });
  const { e, t } = req.query;
  if (!verify(e, t)) return res.status(403).json({ error: 'bad_token' });
  try {
    const cal = calendarClient();
    const ev = await cal.events.get({ calendarId: CALENDAR_ID, eventId: String(e) });
    if (ev.data.status === 'cancelled') return res.status(404).json({ error: 'cancelled' });
    /* The link stops working once the conversation has happened. */
    if (new Date(ev.data.end.dateTime).getTime() < Date.now()) {
      return res.status(410).json({ error: 'expired' });
    }
    res.json({
      summary: ev.data.summary,
      start: ev.data.start.dateTime,
      end: ev.data.end.dateTime,
      meet: ev.data.hangoutLink || null,
    });
  } catch (err) {
    console.error('manage', err.message);
    res.status(404).json({ error: 'not_found' });
  }
});

app.post('/api/reschedule', writeGuards, async (req, res) => {
  if (!configured) return res.status(503).json({ error: 'calendar_not_connected' });
  const { e, t, start: startRaw, timezone } = req.body || {};
  if (!verify(e, t)) return res.status(403).json({ error: 'bad_token' });
  const start = new Date(startRaw);
  if (isNaN(start.getTime())) return res.status(400).json({ error: 'bad_start' });
  if (start.getTime() < Date.now()) return res.status(400).json({ error: 'start_in_past' });
  const end = new Date(start.getTime() + SLOT * 60e3);
  try {
    const cal = calendarClient();
    const current = await cal.events.get({ calendarId: CALENDAR_ID, eventId: String(e) });
    if (current.data.status === 'cancelled') return res.status(404).json({ error: 'cancelled' });
    if (new Date(current.data.end.dateTime).getTime() < Date.now()) {
      return res.status(410).json({ error: 'expired' });
    }
    /* The slot must be free of everything except this booking's own old time. */
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(), timeMax: end.toISOString(),
        timeZone: BOOKING_TZ, items: [{ id: CALENDAR_ID }],
      },
    });
    const busy = ((fb.data.calendars[CALENDAR_ID] || {}).busy || []);
    if (busy.length) {
      const ownStart = new Date(current.data.start.dateTime).getTime();
      const onlyItself = busy.every(x => new Date(x.start).getTime() === ownStart);
      if (!onlyItself) return res.status(409).json({ error: 'slot_taken' });
    }
    const ev = await cal.events.patch({
      calendarId: CALENDAR_ID, eventId: String(e), sendUpdates: 'all',
      requestBody: {
        start: { dateTime: start.toISOString(), timeZone: timezone || BOOKING_TZ },
        end: { dateTime: end.toISOString(), timeZone: timezone || BOOKING_TZ },
      },
    });
    res.json({ ok: true, start: start.toISOString(), meet: ev.data.hangoutLink || null });
  } catch (err) {
    console.error('reschedule', err.message);
    res.status(502).json({ error: 'reschedule_failed' });
  }
});

app.post('/api/cancel', writeGuards, async (req, res) => {
  if (!configured) return res.status(503).json({ error: 'calendar_not_connected' });
  const { e, t } = req.body || {};
  if (!verify(e, t)) return res.status(403).json({ error: 'bad_token' });
  try {
    const cal = calendarClient();
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId: String(e), sendUpdates: 'all' });
    res.json({ ok: true });
  } catch (err) {
    console.error('cancel', err.message);
    res.status(502).json({ error: 'cancel_failed' });
  }
});

app.post('/api/enquiry', writeGuards, async (req, res) => {
  const { data: b, errors } = sec.validateEnquiry(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (!SMTP_HOST) return res.status(503).json({ error: 'mail_not_connected' });
  try {
    const tx = mailer();
    const lines = Object.entries(b).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    await tx.sendMail({
      from: `Be Stories <${STUDIO_EMAIL}>`,
      to: STUDIO_EMAIL,
      replyTo: b.email,                                   // validated address
      subject: sec.oneLine(`Enquiry — ${b.company || b.name}`, 160),
      text: lines,                                        // plain text only
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('enquiry', err.message);
    res.status(502).json({ error: 'mail_failed' });
  }
});

/* ---- static ------------------------------------------------------------- */
app.use(express.static(DIST, {
  extensions: ['html'],
  setHeaders(res, file) {
    if (/\.(css|js|svg|png|woff2)$/.test(file)) res.setHeader('Cache-Control', 'public,max-age=31536000,immutable');
  },
}));
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

/* Anything unhandled: log server-side, return nothing useful to a caller. */
app.use((err, req, res, next) => {
  console.error('UNHANDLED %s %s — %s', req.method, req.path, err.message);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api')) return res.status(500).json({ error: 'server_error' });
  res.status(500).sendFile(path.join(DIST, '404.html'));
});
app.use((req, res) => res.status(404).sendFile(path.join(DIST, '404.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`be stories. listening on :${PORT}`);
    console.log(configured
      ? `Google Calendar: connected as ${GOOGLE_ACCOUNT} (calendar: ${CALENDAR_ID})`
      : 'Google Calendar: NOT connected — see server/README.md');

    const sc = audit();
    console.log('Scopes: %s', short().join(' + '));

    if (!sc.freebusy) console.log('  ⚠ no freebusy scope — availability will always be empty');
    if (!sc.events) console.log('  ⚠ no events scope — bookings cannot be written');
    if (sc.overbroad.length) console.log('  ⚠ wider than needed: %s', short(sc.overbroad).join(', '));

    console.log(SMTP_HOST
      ? 'Mail: connected'
      : 'Mail: NOT connected — enquiry form and confirmations disabled');

    if (!secret) console.log('MANAGE_SECRET unset — reschedule/cancel links disabled');
  });
}

module.exports = app;
