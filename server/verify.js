#!/usr/bin/env node
/* =========================================================================
   be stories. — integration verification

     node --env-file=.env verify.js

   Proves the whole chain end to end, then cleans up after itself:
     1. credentials present
     2. the refresh token exchanges for an access token
     3. the calendar is reachable and writable
     4. an event can be created WITH a Google Meet link
     5. the event can be patched (reschedule) and deleted (cancel)

   The test event is created 30 days out, marked private, invites nobody
   (sendUpdates: 'none'), and is deleted before the script exits.
   ========================================================================= */
'use strict';

const { google } = require('googleapis');
const { SCOPES, audit, short, isCalendarScope, FREEBUSY_CAPABLE } = require('./scopes');

const {
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_REFRESH_TOKEN,
  GOOGLE_ACCOUNT = 'admin@bestories.co.uk',
  CALENDAR_ID = 'primary',
  BOOKING_TZ = 'Europe/London',
  SLOT_MINUTES = '30',
} = process.env;

let FAILED = 0;
const ok = m => console.log('  \x1b[32m✓\x1b[0m ' + m);
const no = m => { FAILED++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const info = m => console.log('    ' + m);
const bail = () => { console.log('\n%d check(s) failed.\n', FAILED); process.exit(1); };

(async function main() {
  console.log('\nbe stories. — booking integration check\n');

  /* 1 ------------------------------------------------------------------ */
  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length) {
    no('credentials missing: ' + missing.join(', '));
    info('See server/README.md steps 1 to 3.');
    bail();
  }
  ok('credentials present');

  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

  /* 1b -- the configured scope set must be able to do the job ----------- */
  const cfg = audit();
  if (!cfg.events || !cfg.freebusy) {
    no('OAUTH_SCOPES cannot run this app: ' + short().join(', '));
    if (!cfg.freebusy) info('missing a freebusy scope — availability would always be empty');
    if (!cfg.events) info('missing an events write scope');
    bail();
  }
  ok('scope config valid: ' + short().join(' + '));
  if (cfg.overbroad.length) info('⚠ wider than needed: ' + short(cfg.overbroad).join(', '));

  /* 2 ------------------------------------------------------------------ */
  let granted = [];
  try {
    const { token } = await oauth2.getAccessToken();
    ok('refresh token valid');

    /* What the token ACTUALLY carries, which is what matters — the consent
       screen may have been configured before OAUTH_SCOPES was changed. */
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
      if (r.ok) {
        const info_ = await r.json();
        granted = String(info_.scope || '').split(/\s+/).filter(Boolean);
        const missing = SCOPES.filter(s => !granted.includes(s));
        const surplus = granted.filter(s => !SCOPES.includes(s) && isCalendarScope(s));
        if (missing.length) {
          no('token is missing configured scopes: ' + short(missing).join(', '));
          info('The consent screen was authorised before these were added.');
          info('Add them in the Cloud console, then re-run `npm run auth`.');
        } else {
          ok('token carries exactly the configured scopes');
        }
        if (surplus.length) info('⚠ token also carries: ' + short(surplus).join(', '));
      }
    } catch (_) { info('could not read tokeninfo (offline?) — continuing'); }
  } catch (e) {
    no('refresh token rejected: ' + e.message);
    info('If the OAuth consent screen is in Testing mode the token expires after 7 days.');
    info('Set User type to Internal, or publish the app, then re-run auth.js.');
    bail();
  }

  const cal = google.calendar({ version: 'v3', auth: oauth2 });

  /* 3 -- freebusy scope AND calendar reachability, in one call -----------
     calendars.get would need calendar.readonly, which this app deliberately
     does not request. freebusy.query is what the booking flow actually uses,
     so probing with it tests the real thing and nothing more. */
  try {
    const now = new Date();
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 60e3).toISOString(),
        timeZone: BOOKING_TZ,
        items: [{ id: CALENDAR_ID }],
      },
    });
    const entry = fb.data.calendars?.[CALENDAR_ID] ||
      fb.data.calendars?.[Object.keys(fb.data.calendars || {})[0]];
    if (entry?.errors?.length) {
      no(`freebusy rejected the calendar: ${entry.errors.map(e => e.reason).join(', ')}`);
      info(`Check CALENDAR_ID (${CALENDAR_ID}) is correct and visible to ${GOOGLE_ACCOUNT}.`);
      bail();
    }
    const resolved = Object.keys(fb.data.calendars || {}).find(k => k !== 'primary');
    ok('free/busy query succeeded');
    ok(`authorised calendar access confirmed: ${resolved || CALENDAR_ID}`);
    info('(this proves calendar access, not which identity granted consent)');
    if (resolved && GOOGLE_ACCOUNT && CALENDAR_ID === 'primary' && resolved !== GOOGLE_ACCOUNT) {
      no(`the token reaches ${resolved}, not the configured ${GOOGLE_ACCOUNT}`);
    }
  } catch (e) {
    const insufficient = /insufficient|scope|403/i.test(e.message);
    no('freebusy.query failed: ' + e.message);
    if (insufficient) {
      info('calendar.events does NOT grant freebusy. Accepted scopes are:');
      FREEBUSY_CAPABLE.forEach(x => info('  ' + x));
      info('Add one to the consent screen, then re-run `npm run auth`.');
    }
    info('Availability and double-booking prevention depend on this call.');
    bail();
  }

  /* 4 ------------------------------------------------------------------ */
  const start = new Date(Date.now() + 30 * 864e5);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + Number(SLOT_MINUTES) * 60e3);
  let id = null;

  try {
    const ev = await cal.events.insert({
      calendarId: CALENDAR_ID,
      conferenceDataVersion: 1,
      sendUpdates: 'none',
      requestBody: {
        summary: 'Be Stories — integration test (safe to ignore)',
        description: 'Created by server/verify.js. Deleted automatically.',
        visibility: 'private',
        transparency: 'opaque',   // so the freebusy assertion below is real
        start: { dateTime: start.toISOString(), timeZone: BOOKING_TZ },
        end: { dateTime: end.toISOString(), timeZone: BOOKING_TZ },
        conferenceData: {
          createRequest: {
            requestId: 'bs-verify-' + Date.now(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });
    id = ev.data.id;
    ok('event created');

    info('conference requestId: ' + (ev.data.conferenceData?.createRequest?.requestId || 'n/a'));

    /* Conference creation is asynchronous. statusCode is 'pending' until
       Google finishes, 'success' when done, 'failure' if it will never
       arrive. Poll while pending; stop immediately on failure. */
    let link = ev.data.hangoutLink;
    let status = ev.data.conferenceData?.createRequest?.status?.statusCode;
    for (let i = 0; i < 6 && !link && status !== 'failure'; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const again = await cal.events.get({ calendarId: CALENDAR_ID, eventId: id });
      link = again.data.hangoutLink ||
        (again.data.conferenceData?.entryPoints || [])
          .find(p => p.entryPointType === 'video')?.uri || null;
      status = again.data.conferenceData?.createRequest?.status?.statusCode || status;
      if (!link && status === 'pending') info(`  conference pending… (${i + 1}/6)`);
    }

    if (link) {
      ok(`Google Meet link created (status: ${status || 'success'})`);
      info(link);
    } else {
      no('no Meet link returned (conference status: ' + (status || 'unknown') + ')');
      info('This is almost always one of:');
      info('  • the account is consumer Gmail, not Google Workspace');
      info('  • Meet is off for this org in the Admin console');
      info('  • Calendar > Sharing settings block conference creation');
      info(`  • the token belongs to an account other than ${GOOGLE_ACCOUNT}`);
    }

    /* 5 ---------------------------------------------------------------- */
    const moved = new Date(start.getTime() + 3600e3);
    await cal.events.patch({
      calendarId: CALENDAR_ID, eventId: id, sendUpdates: 'none',
      requestBody: {
        start: { dateTime: moved.toISOString(), timeZone: BOOKING_TZ },
        end: { dateTime: new Date(moved.getTime() + Number(SLOT_MINUTES) * 60e3).toISOString(), timeZone: BOOKING_TZ },
      },
    });
    ok('reschedule works (events.patch)');

    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: moved.toISOString(),
        timeMax: new Date(moved.getTime() + 60e3).toISOString(),
        timeZone: BOOKING_TZ, items: [{ id: CALENDAR_ID }],
      },
    });
    const key = Object.keys(fb.data.calendars || {})[0];
    const seen = ((fb.data.calendars[key] || {}).busy || []).length > 0;
    if (seen) ok('freebusy sees the booking (double-booking prevented)');
    else no('freebusy did not report the test event — double-booking would NOT be prevented');
  } catch (e) {
    no('write failed: ' + e.message);
    info('The Calendar API may not be enabled on the Cloud project, or the scope');
    info('granted was not calendar.events. Re-run auth.js after fixing.\n');
  } finally {
    if (id) {
      try {
        await cal.events.delete({ calendarId: CALENDAR_ID, eventId: id, sendUpdates: 'none' });
        ok('cancel works (events.delete) — test event removed');
      } catch (e) {
        no('could not delete the test event: ' + e.message);
        info('Remove "Be Stories — integration test" from the calendar by hand.');
      }
    }
  }

  console.log('\nScopes   : %s', short().join(' + '));
  if (granted.length) console.log('Granted  : %s', short(granted).join(' + '));
  console.log('Calendar : %s (configured for %s)', CALENDAR_ID, GOOGLE_ACCOUNT);
  console.log('Slot     : %s minutes, %s', SLOT_MINUTES, BOOKING_TZ);

  if (FAILED) {
    console.log('\n\x1b[31m%d check(s) failed — NOT ready for production.\x1b[0m\n', FAILED);
    process.exit(1);
  }
  console.log('\n\x1b[32mAll checks passed.\x1b[0m\n');
  process.exit(0);
})();
