# Booking integration — connection guide

Integration identity: **admin@bestories.co.uk** (Google Workspace).

Everything is built. Below is the complete sequence, in order. It takes about
fifteen minutes and you only do it once.

Secrets live in `server/.env`, which is gitignored and read server-side only.
Nothing in `assets/js/site.js` or any built page contains a credential — the
browser only ever calls `/api/…` on your own domain.

---

## 1. Create the Google Cloud OAuth credentials

Sign in to <https://console.cloud.google.com> **as admin@bestories.co.uk**.

1. **Create a project.** Top bar → project picker → New project.
   Name `be-stories-site`. Make sure the Organisation is `bestories.co.uk`, not
   "No organisation".

2. **Enable the API.** APIs & Services → Library → search *Google Calendar API*
   → Enable. This is the only API needed; Meet links are created through it.

3. **Configure the consent screen.** APIs & Services → OAuth consent screen.
   - User type: **Internal**. This matters. Internal restricts the app to your
     Workspace domain *and* keeps refresh tokens from expiring. If you choose
     External and leave the app in "Testing", **your refresh token stops working
     after seven days** and bookings silently start failing.
   - App name `Be Stories Booking`, support email `admin@bestories.co.uk`,
     developer contact `admin@bestories.co.uk`.
   - Authorised domain: `bestories.co.uk`.
   - Scopes → Add → **two** scopes:

         https://www.googleapis.com/auth/calendar.events
         https://www.googleapis.com/auth/calendar.freebusy

     Add nothing else.

     **Why two.** `calendar.events` creates, moves and deletes the booking and
     creates the Meet conference on it. It does **not** grant `freebusy.query`,
     which is what availability and the double-booking check are built on.
     Google lists `freebusy.query` as accepting only `calendar`,
     `calendar.readonly`, `calendar.freebusy` and `calendar.events.freebusy`
     — see the [Freebusy: query reference][fb]. With `calendar.events` alone
     the site would show a permanently empty calendar and every booking would
     be blocked.

     `calendar.freebusy` means *view your availability in your calendars* —
     the narrowest option that works. If you point `CALENDAR_ID` at a calendar
     that admin@ does not own but merely has access to, swap it for
     `calendar.events.freebusy` (*see the availability on Google calendars you
     have access to*) and set `OAUTH_SCOPES` in `.env` to match.

     What is deliberately **not** requested: `calendar` and `calendar.readonly`
     (both would let the app read every event on every calendar the account can
     see), `calendar.calendars`, `calendar.acls`, and anything touching Gmail
     or Drive. Availability is read as busy/free blocks only — this app never
     receives the titles, attendees or contents of anything else on the
     calendar.

[fb]: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query

4. **Create the client.** Credentials → Create credentials → OAuth client ID →
   Application type **Web application**. Name `be-stories-server`.

   Authorised redirect URIs — add **both**:

       http://localhost:8787/oauth2/callback
       https://bestories.co.uk/oauth2/callback

   The localhost one is used once, by the helper in step 2, so the authorisation
   code never travels through a public URL. The production one is there for the
   record and for any future re-authorisation.

5. Copy the **Client ID** and **Client secret** into `server/.env`:

       cd server
       cp .env.example .env
       # fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

---

## 2. Authorise admin@bestories.co.uk

Do this on your own machine, not on the server.

    npm install
    npm run auth

The helper prints a consent URL and starts listening on `localhost:8787`.

- **Sign in as admin@bestories.co.uk.** If you are signed into another Google
  account in that browser, use a private window. The helper reports which
  account actually consented and warns you if it was the wrong one.
- Approve the single Calendar permission.
- The browser returns to a local page saying *Authorised*. Close it.

---

## 3. Generate the refresh token

There is no separate step — `npm run auth` finishes by printing it:

    ──────────────────────────────────────────────────────────
    Authorised account : admin@bestories.co.uk

    GOOGLE_REFRESH_TOKEN=1//0g...
    ──────────────────────────────────────────────────────────

The helper requests `access_type: offline` with `prompt: consent`, so a refresh
token is issued every time, even if the account has consented before.

If it prints *No refresh token was returned*, an existing grant is suppressing
it. Revoke **Be Stories Booking** at
<https://myaccount.google.com/permissions> and run `npm run auth` again.

Paste the value into `server/.env`. It does not expire unless revoked, or unless
the consent screen is left in Testing mode (step 1).

While you are in `.env`, set the manage-link secret:

    openssl rand -base64 48        # paste into MANAGE_SECRET

---

## 4. Add the credentials to production

Set these as environment variables on the host. Do not upload `.env` to a
repository, a bucket, or anywhere a build log can print it.

| Variable | Value |
|---|---|
| `GOOGLE_ACCOUNT` | `admin@bestories.co.uk` |
| `CALENDAR_ID` | `primary`, or a dedicated calendar's ID |
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `GOOGLE_REDIRECT_URI` | `https://bestories.co.uk/oauth2/callback` |
| `GOOGLE_REFRESH_TOKEN` | from step 3 |
| `MANAGE_SECRET` | random string |
| `PUBLIC_URL` | `https://bestories.co.uk` |
| `STUDIO_EMAIL` | `enquiries@bestories.co.uk` |
| `STUDIO_ATTENDEES` | optional, e.g. `isra@bestories.co.uk` |
| `SMTP_*` | for the enquiry form and confirmations |

How to set them, by host:

- **Render / Railway / Fly** — Environment or Secrets tab, then redeploy.
- **Vercel / Netlify** — Project settings → Environment variables → Production.
- **A VPS with systemd** — put them in `/etc/be-stories.env` (`chmod 600`, owned
  by root) and add `EnvironmentFile=/etc/be-stories.env` to the unit.
- **Docker** — `--env-file`, or your orchestrator's secret store. Never `ENV` in
  a Dockerfile; that bakes the secret into the image layers.

Then:

    npm test          # 21 unit tests, no credentials needed
    npm run build     # regenerates ../dist
    npm start

### Using a dedicated calendar instead of admin@'s own

If you would rather bookings landed on a separate *Studio — Conversations*
calendar: create it in Google Calendar **as admin@bestories.co.uk**, open
Settings → that calendar → Integrate calendar, copy the **Calendar ID**, and put
it in `CALENDAR_ID`. The account needs *Make changes to events* on it. Meet link
creation is unaffected.

---

## 5. Verify Google Meet links are being created

    npm run verify

This exercises the whole chain against the real API and cleans up after itself.
It creates a private, transparent test event 30 days out, invites nobody
(`sendUpdates: 'none'`), then deletes it.

    be stories. — booking integration check

      ✓ credentials present
      ✓ refresh token valid
      ✓ freebusy scope granted (calendar: admin@bestories.co.uk)
      ✓ event created
        conference requestId: 6f1c…-…
      ✓ Google Meet link created (status: success)
        https://meet.google.com/abc-defg-hij
      ✓ reschedule works (events.patch)
      ✓ freebusy sees the booking (double-booking prevented)
      ✓ cancel works (events.delete) — test event removed

If the Meet line fails, the script names the likely cause. In order of
likelihood:

1. The token belongs to a consumer Gmail account rather than the Workspace one.
   Meet conferencing over the API requires Workspace. Re-run `npm run auth` and
   watch the *Authorised account* line.
2. Meet is disabled for the organisation — Admin console → Apps → Google
   Workspace → Google Meet → ON for everyone.
3. Calendar sharing settings block conference creation — Admin console → Apps →
   Google Workspace → Calendar → Sharing settings.

### Asynchronous conference creation

`events.insert` usually returns `hangoutLink` populated, but
`conferenceData.createRequest.status.statusCode` can come back `pending`.
Both the verifier and the live booking endpoint handle this:

- `verify.js` polls for up to six seconds, prints the pending count as it goes,
  and stops immediately if the status turns `failure` rather than waiting out
  the clock.
- `/api/book` polls up to three times at 700ms while the status is `pending`,
  then falls back to `conferenceData.entryPoints[].uri` for the video entry
  point. If there is still no link the booking **still succeeds** and the
  invitation still goes out — the confirmation omits the join line rather than
  inventing a URL, and the server logs a warning with the event id.

The `requestId` is a `crypto.randomUUID()` per booking. This matters: Google
treats a repeated `requestId` as a retry of the same conference request and
returns the same Meet room, so a non-unique id would quietly put two different
prospects in one meeting.

### Verifying in production

    curl https://bestories.co.uk/api/health

    {"calendar":"connected","identity":"admin@bestories.co.uk",
     "calendarId":"primary","mail":"connected","manageLinks":"enabled",
     "slotMinutes":30,"timezone":"Europe/London","hours":"10:00-17:00"}

Status only — it never returns a credential. Then make one real booking to your
own address and confirm four things: the invitation arrives, the Meet link
works, the event is on admin@bestories.co.uk's calendar, and the *Reschedule or
cancel* link in the confirmation opens `/manage/` with the appointment loaded.

---

## What happens at runtime

| Action | Call |
|---|---|
| Show availability | `freebusy.query` on `CALENDAR_ID` (needs `calendar.freebusy`), minus weekends, notice period and horizon |
| Confirm a booking | `freebusy.query` again for that exact slot (409 if taken), then `events.insert` with `conferenceDataVersion: 1`, `hangoutsMeet`, and a `crypto.randomUUID()` `requestId` |
| Invite the prospect | `attendees: [prospect]` + `sendUpdates: 'all'` |
| Studio receives it | the event is created on `CALENDAR_ID`, which belongs to admin@bestories.co.uk, so it is on the Workspace calendar by construction |
| Reschedule | `events.patch` on the same event id, freebusy-checked, ignoring the booking's own current slot |
| Cancel | `events.delete` with `sendUpdates: 'all'` |

The organiser is always the calendar owner. It is never asserted on an attendee
— Google ignores that at best and rejects it at worst.

Reschedule and cancel links are an HMAC of the event id under `MANAGE_SECRET`.
No session, no database, and the link works only for the person Google emailed
it to.

## Where scopes are defined

One file: **`server/scopes.js`**. It reads `OAUTH_SCOPES` from the environment
and falls back to `calendar.events` + `calendar.freebusy`.

| File | Uses it for |
|---|---|
| `auth.js` | the set it requests at consent; refuses to run if the set cannot do the job |
| `verify.js` | validates the config, then compares it against what the **token actually carries** via `tokeninfo` |
| `index.js` | reports it at boot and on `/api/health`; warns if freebusy is absent |

There is no scope literal anywhere else in the codebase — `grep -rn "auth/calendar" --include="*.js"`
returns hits in `scopes.js` only. `scopes.js` also knows which scopes satisfy
`freebusy.query` and which are overbroad, so a bad `OAUTH_SCOPES` fails at
startup rather than at the first booking.

## Scope summary

| Scope | Why | Could we drop it? |
|---|---|---|
| `calendar.events` | insert, patch, delete the booking; create the Meet conference | No — this is the whole write path |
| `calendar.freebusy` | `freebusy.query` for availability and the double-booking re-check | No — `calendar.events` does not cover it |
| `calendar.readonly` | — | **Not requested.** Would expose every event on every visible calendar |
| `calendar` | — | **Not requested.** Full read/write/delete on all calendars |
| `calendar.calendarlist` / `.calendars` / `.acls` | — | **Not requested** |

Two scopes, both narrow. The app can write its own bookings and read busy/free
blocks. It cannot read the title, attendees or contents of anything else on
admin@'s calendar.

## If you would rather not hold a refresh token

A service account with domain-wide delegation, impersonating
admin@bestories.co.uk, removes the token entirely. It is a heavier grant — the
service account can impersonate any user in the domain for the scopes you list —
so for a studio this size the narrower OAuth route above is the better trade.
Say the word and I will switch the client; it is about twenty lines in
`calendarClient()`.
