#!/usr/bin/env node
/* =========================================================================
   be stories. — one-time Google authorisation
   Run once, on your own machine, signed in as admin@bestories.co.uk.

     node auth.js

   Opens a consent URL, catches the redirect on localhost, exchanges the code
   and prints the refresh token. The token is printed once and never written
   to disk by this script — paste it into your production environment.

   Nothing here belongs in the browser or in the repository.
   ========================================================================= */
'use strict';

const http = require('http');
const { google } = require('googleapis');

const PORT = Number(process.env.AUTH_PORT || 8787);
const REDIRECT = `http://localhost:${PORT}/oauth2/callback`;
const { SCOPES, audit, short } = require('./scopes');
const ACCOUNT = process.env.GOOGLE_ACCOUNT || 'admin@bestories.co.uk';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('\nGOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set before running this.');
  console.error('Either export them, or put them in server/.env and run with:');
  console.error('  node --env-file=.env auth.js\n');
  process.exit(1);
}

/* Refuse to request a scope set that cannot do the job, or one that is wider
   than the job needs. Better to fail here than to discover it in production. */
const a = audit();
if (!a.events || !a.freebusy) {
  console.error('\nOAUTH_SCOPES cannot run this app:');
  if (!a.events) console.error('  missing an events write scope');
  if (!a.freebusy) console.error('  missing a freebusy scope — availability would always be empty');
  console.error('  configured: %s\n', short().join(', '));
  process.exit(1);
}
if (a.overbroad.length) {
  console.warn('\n  ⚠  OAUTH_SCOPES includes %s', short(a.overbroad).join(', '));
  console.warn('     That grants read access to every calendar this account can see.');
  console.warn('     calendar.events + calendar.freebusy is sufficient.\n');
}

const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',     // required for a refresh token
  prompt: 'consent',          // forces a fresh refresh token even if consent exists
  scope: SCOPES,
  login_hint: ACCOUNT,
});

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="margin:0;background:#15130F;color:#EFEAE0;font:16px/1.6 -apple-system,Helvetica,Arial;` +
  `display:flex;align-items:center;justify-content:center;height:100vh"><div style="max-width:44ch;padding:24px">` +
  `<p style="font:10px/1.6 monospace;letter-spacing:.18em;text-transform:uppercase;color:#8C887F">be stories.</p>` +
  `<h1 style="font-size:26px;letter-spacing:-.03em;margin:12px 0 10px">${title}</h1>${body}</div>`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname !== '/oauth2/callback') { res.writeHead(404).end(); return; }

  const err = u.searchParams.get('error');
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/html' })
       .end(page('Authorisation refused', `<p>${err}</p>`));
    console.error('\nRefused:', err, '\n');
    server.close(); process.exit(1);
  }

  try {
    const { tokens } = await oauth2.getToken(u.searchParams.get('code'));
    oauth2.setCredentials(tokens);

    /* Confirm the token can reach a calendar, using a call inside the scopes
       we just requested. freebusy.query on 'primary' returns the result keyed
       by that calendar's address.

       Read this precisely: it proves WHICH CALENDAR the token can access. It
       is not proof of which Google identity sat at the consent screen — a
       token for another account with access to the same calendar would look
       identical here. Proving the consenting identity would need an identity
       scope (openid/email), which this app has no operational reason to ask
       for, so it does not. */
    let who = null, freebusyOk = false;
    try {
      const cal = google.calendar({ version: 'v3', auth: oauth2 });
      const now = new Date();
      const fb = await cal.freebusy.query({
        requestBody: {
          timeMin: now.toISOString(),
          timeMax: new Date(now.getTime() + 60e3).toISOString(),
          items: [{ id: 'primary' }],
        },
      });
      freebusyOk = true;
      who = Object.keys(fb.data.calendars || {}).find(k => k !== 'primary') || null;
    } catch (e) {
      console.error('\n  freebusy check failed:', e.message);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' })
       .end(page('Authorised', '<p>Return to your terminal. You can close this tab.</p>'));

    console.log('\n──────────────────────────────────────────────────────────');
    console.log('Scopes granted     : %s', SCOPES.map(s => s.split('/auth/')[1]).join(', '));
    console.log('Freebusy access    : %s', freebusyOk ? 'yes' : 'NO — availability will not work');
    console.log('Calendar access    : %s', who || '(could not determine)');
    if (who && who !== ACCOUNT) {
      console.log('\n  ⚠  The token reaches %s, not %s.', who, ACCOUNT);
      console.log('     If that is not the calendar you intended, sign out of the');
      console.log('     other account and run this again.\n');
    }
    if (!tokens.refresh_token) {
      console.log('\n  ⚠  No refresh token was returned. Revoke this app at');
      console.log('     https://myaccount.google.com/permissions and run again.\n');
    } else {
      console.log('\nGOOGLE_REFRESH_TOKEN=%s', tokens.refresh_token);
      console.log('\nPaste that into your production environment. Do not commit it.');
    }
    console.log('──────────────────────────────────────────────────────────\n');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' })
       .end(page('Exchange failed', `<p>${e.message}</p>`));
    console.error('\nToken exchange failed:', e.message, '\n');
  }
  server.close(() => process.exit(0));
});

server.listen(PORT, () => {
  console.log('\nAdd this exact redirect URI to your OAuth client first:');
  console.log('  %s\n', REDIRECT);
  console.log('Requesting scopes:');
  SCOPES.forEach(x => console.log('  %s', x));
  console.log('\nThen sign in as %s and open:\n', ACCOUNT);
  console.log(url + '\n');
  console.log('Waiting for the redirect on port %d…\n', PORT);
});
