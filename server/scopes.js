/* =========================================================================
   be stories. — OAuth scope configuration
   THE single source of truth. auth.js requests these, verify.js checks the
   granted token against these, index.js reports these. Nothing anywhere else
   in the codebase may declare a scope literal.
   ========================================================================= */
'use strict';

/* Minimum this implementation actually needs. Two scopes, both narrow.

   calendar.events    events.insert / patch / delete for the booking, and
                      conferenceData.createRequest for the Meet link.
   calendar.freebusy  freebusy.query — availability, and the re-check that
                      prevents double-booking.

   calendar.events does NOT grant freebusy.query. Google accepts that method
   under calendar, calendar.readonly, calendar.freebusy and
   calendar.events.freebusy only:
   https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query

   If CALENDAR_ID points at a calendar the account does not own but merely has
   access to, set OAUTH_SCOPES to use calendar.events.freebusy instead. */
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

/* Scopes that satisfy freebusy.query, in Google's documented order. */
const FREEBUSY_CAPABLE = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

/* Scopes that satisfy events write. */
const EVENTS_CAPABLE = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.app.created',
];

/* Scopes this app must never request. Asking for any of these would give it
   read access to the contents of every calendar the account can see. */
const OVERBROAD = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const SCOPES = (process.env.OAUTH_SCOPES || DEFAULT_SCOPES.join(' '))
  .split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

/** Does this scope list cover both things the booking flow does? */
function audit(list = SCOPES) {
  const has = s => list.includes(s);
  return {
    scopes: list,
    events: EVENTS_CAPABLE.some(has),
    freebusy: FREEBUSY_CAPABLE.some(has),
    overbroad: OVERBROAD.filter(has),
    extra: list.filter(s => !EVENTS_CAPABLE.includes(s) && !FREEBUSY_CAPABLE.includes(s)),
  };
}

/** Is this string a Calendar API scope at all? */
const isCalendarScope = s => s.startsWith('https://www.googleapis.com/auth/calendar');

/** Short names, for logging. */
const short = (list = SCOPES) => list.map(s => s.split('/auth/')[1] || s);

module.exports = {
  SCOPES, DEFAULT_SCOPES, FREEBUSY_CAPABLE, EVENTS_CAPABLE, OVERBROAD,
  audit, short, isCalendarScope,
};
