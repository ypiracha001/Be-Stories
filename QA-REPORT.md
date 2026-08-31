# be stories. — QA report

Build audited with `python3 audit.py`, which walks every generated page, resolves
every `href`, checks every in-page anchor against the ids that actually exist on
that page, and flags any `<a>` without an href or `<button>` without a type.

**648 links checked. 0 broken.**

No visual changes were made in this pass. Two exceptions, both behavioural: form
error states (amber, the existing accent — no new colour), and tap-target padding
on navigation links to reach the 44px minimum.

---

## 1. Routes

17 routes, all reachable, all linked from somewhere.

| Route | Source |
|---|---|
| `/` | generated |
| `/work/` | generated |
| `/work/maison-01/` | `projects.json` |
| `/work/grand-hotel-03/` | `projects.json` |
| `/work/orchard-04/` | `projects.json` |
| `/work/atelier-02/` | `projects.json` |
| `/capabilities/` | generated |
| `/studio/` | generated |
| `/journal/` | generated |
| `/journal/why-scale-destroys-creative-ideas/` | `journal.json` |
| `/journal/luxury-brands-content-problem/` | `journal.json` |
| `/journal/the-economics-of-desire/` | `journal.json` |
| `/enquiries/` | generated |
| `/booking/` | generated |
| `/manage/` | **new** — reschedule / cancel, `noindex` |
| `/privacy/` | generated |
| `/terms/` | generated |
| `/404.html` | **new** — served with a real 404 status, not a soft 404 |

Adding a project or a journal entry to `content/*.json` creates its page, its
index row, its homepage placement and its sitemap entry. There is no way to link
to a case study that does not exist.

## 2. CTAs and destinations

| Control | Destination |
|---|---|
| Wordmark (masthead, footer) | `/` |
| Work | `/work/` |
| Studio | `/studio/` |
| Capabilities | `/capabilities/` |
| Journal | `/journal/` |
| Enquiries | `/enquiries/` |
| Discuss a project | `/booking/` |
| **View selected work** | `#work` — the section on the homepage |
| Each of the 3 homepage worlds | its own case study |
| Each of the 4 work-index worlds | its own case study |
| Each of the 8 capability rows | `/capabilities/#slug` |
| Each of the 3 journal rows | its own article |
| **Discuss a commission** | `/booking/?engagement=commission` — field preselected |
| **Discuss a partnership** | `/booking/?engagement=partnership` — field preselected |
| **Private enquiry** | `/enquiries/?engagement=house` — field preselected |
| All work / All notes / Back to work | index pages |
| enquiries@bestories.co.uk | valid `mailto:` |
| bestories.co.uk (footer) | `/` |
| Privacy / Terms | legal pages |

Both forms carry a **How you would like to work** select. The query string
preselects it, so the choice made on the homepage survives the click.

## 3. Forms

Two live forms, one shared validation module.

- **Required-field validation** — 4 required on each form, `required` +
  `aria-required`, inline message, `aria-invalid`, `aria-describedby` pointing
  at a live error region.
- **Email validation** on `type="email"`, URL validation on `type="url"`
  (a bare `example.com` is accepted; nonsense is not).
- **Error states** — the field label and rule turn amber, the message appears
  below in mono. Errors clear as you correct them, and re-check on blur.
- **Focus management** — submitting an invalid form moves focus to the first
  bad field. Submitting a valid one moves focus to the result notice.
- **Success state** — the fields are removed and replaced by a confirmation.
- **Failure is never silent.** Every failure path states plainly that nothing
  was sent or booked, and gives the mailto as the fallback. A 409 on booking
  says the slot went, reloads availability and asks for another time.
- **Mobile** — `inputmode` and `autocomplete` on every field, 44px targets,
  native selects, no custom controls to fight with.

## 4. Booking integration

Built to the credential boundary. Nothing is faked: with no credentials the
endpoints return 503, the calendar says so in words, and the panel routes the
visitor to the studio inbox.

| Requirement | Status |
|---|---|
| Real available slots | `freebusy.query`, minus weekends, notice period (18h) and horizon (45d) |
| Visitor timezone | resolved from the browser, sent with the request, shown in the panel |
| Prevent double-booking | freebusy re-checked immediately before the write; 409 if taken |
| Collect name, company, role, work email, website, brief | all present, plus engagement and optional budget |
| Create calendar event | `events.insert` on `CALENDAR_ID` |
| Google Meet link | `conferenceDataVersion: 1`, `conferenceSolutionKey: hangoutsMeet` |
| Invite both parties | attendees + `sendUpdates: 'all'` |
| Confirmation email | Google's invitation, plus a studio confirmation over SMTP carrying the manage link |
| Rescheduling | `/manage/` → `POST /api/reschedule`, freebusy-checked, `events.patch`, both calendars updated |
| Cancellation | `/manage/` → `POST /api/cancel`, `events.delete` with `sendUpdates: 'all'` |

Manage links are an HMAC of the event id — no session, no database, and the link
only works for the person Google emailed it to. `/manage/` is `noindex`.

Default meeting: **Be Stories — Introductory Conversation**, 30 minutes.

## 5. Credentials and connections still required

Everything below is external access I cannot create. Three items.

1. **Google OAuth** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REFRESH_TOKEN`. Full walkthrough in `server/README.md`; it is a
   Cloud console project, the Calendar API enabled, a web OAuth client, and one
   consent as the account owning the booking calendar. Scope:
   `https://www.googleapis.com/auth/calendar.events`.
   **Meet links need a Google Workspace plan.** On a consumer Gmail account the
   event is created but `hangoutLink` comes back null.
2. **SMTP** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Drives the
   enquiry form and the booking confirmation. Google Workspace SMTP relay works.
3. **`MANAGE_SECRET`** — any long random string. Falls back to the OAuth client
   secret if unset. Without it, reschedule and cancel links are disabled.

Also needed, but not a credential:

4. **LinkedIn URL.** Not supplied, so the footer omits the item rather than
   shipping a guessed company URL. Set `LINKEDIN` at the top of `build.py` and
   it appears, with `target="_blank"` and `rel="noopener noreferrer"`.

## 6. Placeholder content outstanding

| Item | State |
|---|---|
| Film and photography | Every frame composed, cropped and labelled `FRAME PENDING`. One flag (`SHOW_ASSET_NOTES`) removes the slates; one line per frame swaps in real footage. |
| Client work | All four projects are labelled **Concept Commission**, and each outcome section states plainly that it was not produced for a client and claims no results. |
| Phone number | Deliberately absent. Add to the footer and signatures when there is one to publish. |
| Team biographies | Two short paragraphs, no invented credentials. |
| Journal | Three complete articles. |

Nothing is fabricated anywhere: no clients, awards, testimonials, metrics, press
or credentials.

## 7. Dead links

**None.** 648 links checked across 17 pages: internal routes resolved against
the built file tree, in-page anchors resolved against the ids present on that
page, `mailto:` validated, external links checked for `rel="noopener"`.

Semantic and accessibility checks also pass on every page: one `h1`, a `<main>`
landmark, a skip link, every form control with a matching `<label for>`, no `<a>`
without an href, no `<button>` without a type. Navigation is `<a>`; actions are
`<button>`. The mobile drawer traps focus while open, closes on Escape, returns
focus to the toggle, is not keyboard reachable while closed, and resets on
browser back.

Re-run any time with:

    python3 build.py && python3 audit.py
