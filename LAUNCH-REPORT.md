# be stories. — launch report

## A. GO / NO-GO

**CONDITIONAL GO.**

The website is ready to send to a prospective luxury-brand marketing director
**as soon as the Google credentials in section C are in place.** Every route,
link, form control and keyboard path is finished and verified. Nothing is a
placeholder except the film, which is labelled as such by design.

There is exactly one thing standing between this and an unconditional GO:
**the booking flow has never been run against a real Google Workspace account,
because I have never held one.** Every other subsystem has been executed and
passes. Until `npm run verify` returns green against production credentials,
"the booking works" is an engineering expectation, not a verified fact — and I
will not describe it as verified.

If you connect the credentials, run `npm run verify`, and it exits 0, you are
GO without qualification.

---

## B. Blockers

Two. Both are external access, neither is a defect.

**B1 — Google OAuth credentials are not connected.**
Without them `/api/availability` and `/api/book` return 503, the calendar shows
no times and states plainly that booking is unavailable, and the visitor is
routed to the written enquiry. Nothing breaks and nothing is faked, but the
primary CTA cannot complete. Fix: section C1, about fifteen minutes.

**B2 — SMTP is not connected.**
The enquiry form returns a visible error and tells the visitor to email the
studio directly. Booking still works when B1 is resolved — Google Calendar
sends its own invitation — but the studio confirmation carrying the
reschedule/cancel link does not go out. Fix: section C2.

Not blockers, for the record: the missing film (labelled and deliberate), the
absent LinkedIn URL (item omitted rather than guessed), and the absence of a
phone number.

---

## C. What I need from you

### C1. Google Cloud + Workspace — required for booking

Full walkthrough in `server/README.md`. In short:

1. Cloud project under the `bestories.co.uk` organisation, Calendar API enabled.
2. OAuth consent screen set to **Internal**. This is not optional: an External
   app left in Testing issues refresh tokens that expire after seven days, and
   bookings would fail silently a week after launch.
3. Two scopes, no more:
   `calendar.events` and `calendar.freebusy`.
4. Web application OAuth client with redirect URIs
   `http://localhost:8787/oauth2/callback` and
   `https://bestories.co.uk/oauth2/callback`.
5. `cd server && npm install && npm run auth`, signed in as
   **admin@bestories.co.uk**. It prints the refresh token.

Then set on the production host:

| Variable | Value |
|---|---|
| `GOOGLE_ACCOUNT` | `admin@bestories.co.uk` |
| `CALENDAR_ID` | `primary` |
| `GOOGLE_CLIENT_ID` | from step 4 |
| `GOOGLE_CLIENT_SECRET` | from step 4 |
| `GOOGLE_REDIRECT_URI` | `https://bestories.co.uk/oauth2/callback` |
| `GOOGLE_REFRESH_TOKEN` | from step 5 |
| `MANAGE_SECRET` | `openssl rand -base64 48` |
| `PUBLIC_URL` | `https://bestories.co.uk` |
| `TRUST_PROXY` | `1` (or your proxy depth) |

### C2. SMTP — required for the enquiry form

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
Google Workspace SMTP relay (`smtp-relay.gmail.com:587`, IP-restricted) is
preferable to an app password, because no user credential is involved.

### C3. DNS and email authentication

Full checklist with exact records in `OPERATOR-CHECKLIST.md`. **I have made no
DNS changes.** The items that matter most:

- One SPF record only: `v=spf1 include:_spf.google.com ~all`. Two is a hard fail.
- DKIM generated in the Admin console, TXT published at `google._domainkey`,
  then **click Start authentication** — it is not live until you do.
- DMARC at `p=none` first. Going straight to `p=reject` before DKIM is
  confirmed will bounce your own booking confirmations, and you will find out
  from a prospect who simply never replies.
- `www` → apex 301 **preserving the query string**. The engagement CTAs carry
  `?engagement=commission`; a redirect that drops it silently breaks the
  preselection.
- Certificate covering both apex and `www`.

### C4. Optional

- **LinkedIn URL** — set `LINKEDIN` at the top of `build.py` and the footer item
  reappears. Omitted rather than guessed.
- **`STUDIO_ATTENDEES`** — e.g. `isra@bestories.co.uk`, to put Isra on every
  booking as well as the calendar owner.

---

## D. Verified

Executed in this environment, with results, not asserted.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | **21 / 21 pass** |
| Link and semantics audit (`python3 audit.py`) | **648 links across 18 routes, 0 broken** |
| Dead links, `#` placeholders, `<a>` without href, `<button>` without type | none |
| In-page anchors resolved against ids that exist | pass |
| Secrets in built output (`dist/`) | none |
| Server syntax check, all 6 files | pass |
| One `<h1>`, `<main>`, skip link, `lang` on every page | pass |
| Every form control has a matching `<label for>` | pass |
| `target="_blank"` without `rel="noopener"` | none |
| Scope declarations outside `scopes.js` | **none** |

Specifically tested by unit test:

- Control characters stripped; **CR/LF removed from every single-line field**,
  which is the mail-header injection path
- Length caps enforced (4,000 chars on free text)
- HTML escaped before it reaches a calendar description — Google renders a
  limited HTML subset there, so this was a real injection route
- Unexpected fields discarded; non-string types coerced to empty
- All five required booking fields enforced individually
- Five malformed email shapes rejected
- Past and unparseable start times rejected
- Path-traversal timezone dropped
- Non-JSON content type refused (415)
- Foreign `Origin` refused (403); real origin and absent `Origin` pass
- CSP contains `script-src 'self'` **without** `unsafe-inline`, plus
  `frame-ancestors 'none'` and `object-src 'none'`
- HSTS, `nosniff`, `DENY`, `strict-origin-when-cross-origin` all set
- `calendar.events` alone correctly reports as *not* satisfying freebusy
- Full `calendar` scope correctly flagged as overbroad

Verified by static review of the shipped assets (not browser-executed):

- 6 `prefers-reduced-motion` blocks in CSS, 1 guard in JS
- `:focus-visible` styling present; 44px minimum tap targets
- Drawer `visibility:hidden` when closed, so it is out of the tab order
- Focus trap, focus return on close, reset on bfcache restore
- `aria-invalid` and `role="alert"` on errors; 3 live regions in booking

### Not verified — stated plainly

- **The Google integration has never run.** No credentials exist here. OAuth
  exchange, freebusy, event creation, Meet link generation, reschedule, cancel
  and the async conference polling are all implemented and code-reviewed, and
  all fail loudly rather than silently, but **none has been executed.**
  `npm run verify` exercises all ten stages and exits non-zero on any failure.
  Run it before you send the URL to anyone.
- **No SMTP has been sent.** The enquiry path is unexecuted.
- **No browser has rendered this.** The container has no browser and no network
  for dependencies. Layout, motion, focus order and mobile behaviour are
  verified by code review and static analysis, not by running Chrome or a
  screen reader.
- **No Lighthouse run.** The site is 24 KB of HTML, 32 KB CSS, 24 KB JS, no
  images, no third party except Google Fonts — it should score extremely well,
  but I have not measured it and will not claim a number.

---

## E. Security model — stated precisely

**`/manage/` is bearer-token access. Possession of the signed URL grants the
ability to view, reschedule and cancel that booking. There is no
authentication of identity.** Anyone who obtains the link — by being forwarded
the confirmation email, by reading it over a shoulder, by having access to the
mailbox — can act on the booking. I am not claiming only the email recipient
can use it, because that is not enforced.

The mitigations that do exist: the token is an HMAC-SHA256 of the event id under
`MANAGE_SECRET`, compared timing-safely over fixed-length digests, so it cannot
be guessed or forged. It is scoped to one booking and confers nothing else. It
expires implicitly — `/manage/`, cancel and reschedule all return 410 once the
event's end time has passed. The worst outcome is a nuisance cancellation of a
30-minute introductory call, which the studio sees immediately in its calendar.

Adding real authentication would mean a login for a first-contact prospect, and
I judged that a worse trade for a meeting of this consequence. If you disagree,
say so and I will add a one-time email confirmation step.

Other decisions worth knowing:

- No cookies are set. One session-storage flag records whether the logotype
  animation has played. It carries no identifier and is never sent anywhere.
  **A consent banner is not legally required** and I have not added one for
  appearance.
- Google Fonts is the only third party, and it receives visitor IPs. This is
  disclosed in the privacy notice. Self-hosting removes it — see E in
  post-launch.
- Server logs record that a request happened and errors when they occur. They
  do not contain names, email addresses or project briefs. IPs are held in
  memory for rate limiting only.
- Rate limits: 60/min across `/api`, and 6 per 10 minutes on the four
  state-changing endpoints.
- Stack traces are disabled; unhandled errors return `{"error":"server_error"}`
  and log server-side.
- `/api/health` returns five operational states and nothing else — no scopes,
  no calendar id, no identity, no configuration.

---

## F. Post-launch

None of these should delay prospecting.

1. **Self-host the two typefaces.** Removes the only third-party request,
   removes the IP disclosure from the privacy notice, and cuts two DNS lookups
   and a render-blocking round trip. About an hour: download the Archivo and
   IBM Plex Mono woff2 subsets, drop them in `assets/fonts/`, replace the
   `<link>` with an `@font-face` block, tighten `font-src` to `'self'`.
2. **Film and photography.** Every frame is composed, cropped and labelled, and
   each case study's *The World* chapter is already a director's brief. This is
   the single change that will most alter how the site feels.
3. **Real client work**, replacing the four Concept Commissions as engagements
   complete.
4. **Lighthouse and axe run** on the deployed site, plus one pass with VoiceOver
   or NVDA. I expect them clean; I have not measured them.
5. **DMARC to `p=reject`** once two weeks of aggregate reports are clean.
6. **HSTS preload submission**, but only once you are certain every future
   subdomain will be HTTPS. Removal takes months.
7. **A phone number**, if you decide to publish one.
8. **Uptime and error monitoring** on `/api/health`, alerting on
   `status != operational` and on the `MEET_FAILED` log line.

---

## Run this before you send the URL to anyone

    cd server
    npm ci
    npm test        # 21 tests, no credentials needed
    npm run verify  # ten stages against the real Workspace account
    cd .. && python3 build.py && python3 audit.py

`verify` exits non-zero and names the failure if any stage fails. If all four
commands are green, you are GO.
