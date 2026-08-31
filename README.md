# be stories. — production website

`bestories.co.uk`. Static build, Python generator, Node booking service.
No framework, no build toolchain, nothing to keep patched.

    python3 build.py          # content + templates -> dist/
    cd server && npm i && npm start

Read `CONFLICTS.md` first. It records every point where this build brief and the
brand manual disagreed, and which one won.

---

## 1. Art direction

The site is a private document, not a shopfront. Three grounds — ink, bone,
paper — alternating so the page reads as a sequence of chapters. Hairline rules,
a fixed film grain at 5.5%, no decorative element anywhere. Every rule on the
page is either a section boundary or an underline on something clickable.

**The interface stays disciplined; the work is allowed to be seductive.** The
page is scored for contrast rather than consistency:

    hero            impact    commanding type on a drifting field
    01 position     quiet     bone
    interruption    IMPACT    full-bleed, full-height, no interface
    02 point of view quiet    ink
    03 selected work IMPACT   three full-bleed worlds
    04 desire        weight   bone, paced line by line
    takeover        IMPACT    black, ident, one line, hold
    05–10           quiet     capabilities, partnership, method, technology,
                              ways to work, journal
    close           impact    the page ends on a frame, not a paragraph

Roughly 60% institutional restraint, 40% cinematic. The quiet sections make the
work feel valuable; the work makes the quiet sections feel deliberate.

### The frame system

Film has not been shot, and generic stock or generic AI imagery would do more
damage than an empty rectangle. So each visual slot is an **art-directed light
study**, composed for its project — key direction, colour temperature, falloff,
grain, a 34-second drift:

    frame--midnight   fragrance    cold black, one warm edge high right
    frame--interior   hospitality  a shaft of pale light in a warm dark room
    frame--amber      luxury food  low warm key from the right, mahogany, deep shadow
    frame--metal      jewellery    a cold specular sweep across near-black

These are not the campaign. They are the frame the campaign will occupy, built
so the pacing, the cropping and the emotional rhythm of the site are real and
testable today. Each carries a small `FRAME PENDING` slate; set
`SHOW_ASSET_NOTES = False` in `build.py` to remove them all. Dropping in the
real thing is one line per frame — replace `.frame__light` with a `<video>` or
`<picture>`; every other property of the composition stays.

## 2. Type hierarchy

Archivo for everything, IBM Plex Mono for metadata. Two families, one request.
Archivo sits in the same grotesk territory as the wordmark without imitating it,
so the drawn letterforms remain the most specific thing on the page.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| `d1` display | `clamp(36px, 7.4vw, 104px)` | 700 | −0.037em |
| `d2` section | `clamp(29px, 4.9vw, 66px)` | 700 | −0.032em |
| `d3` sub | `clamp(23px, 3vw, 40px)` | 600 | −0.024em |
| `lede` | `clamp(17.5px, 1.85vw, 23px)` | 400 | −0.012em |
| body | 16.5 / 1.62 | 400 | 0 |
| `meta` | 10.5px mono | 400 | +0.19em, caps |

Hierarchy is carried by weight, scale and negative space. Nothing is centred,
nothing is letterspaced for effect, and the mono is confined to labels — never
to a sentence.

## 3. Colour system

Set in `assets/css/site.css` as custom properties. See `CONFLICTS.md` for why
these values differ from the brief.

    --ink        #15130F   ground, and letterforms on light
    --ink-deep   #0A0908   deep bands, film frame (manual-permitted page ground)
    --bone       #EFEAE0   light ground, and letterforms on dark
    --paper      #E5DFD3   the third ground, used twice
    --amber      #A0641F   on light
    --amber-rev  #BE8038   on dark
    --smoke      #8C887F   secondary metadata only

## 4. Homepage architecture

Eleven numbered movements, in the order a sceptical CMO needs them:

    hero            We scale stories worth remembering.
    01 Position     Your team knows the brand / we help the story travel further
    02 Point of view  Not a content problem — a meaning problem
    03 Selected work  Three exhibits, full width, no cards
    04 Luxury intelligence  Desire is designed
    05 Capabilities   Eight, as an index
    06 Partnership    Your team brings / we bring
    07 Method         01–06
    08 Technology     Canvas / taste
    09 Scale          Scale should compound the idea
    10 Engagement     Commission, Partnership, House
    11 Journal        Three notes
    close             Tell us what you are building

The fifteen-second test is met above the fold and again by movement 02: what it
is, who it is for, and — critically — that it does not replace anyone.

## 5. Motion system

One reveal, one ident, nothing else.

*Reveal.* `IntersectionObserver`, opacity plus 14px rise, 900ms on
`cubic-bezier(.2,0,.1,1)`, staggered 60–90ms within a group. Fires once.

*Pacing.* The "Desire is designed" lines reveal on a timer — 620ms apart —
rather than on scroll position, because the point of that section is that it
sets the tempo rather than the visitor.

*Takeover.* One signature moment, cut to scroll position rather than animated:
the frame fills, the masthead fades out, the through-line runs the manual's
ident, then a single line resolves and holds. Nearer a film edit than a web
animation. Under reduced motion it collapses to one static composed frame.

*Ident.* The continuation, on the masthead wordmark, once per session, on the
manual's timeline — extend 670ms, hold 430ms, absorb 960ms, point 190ms. It
resolves to the static master mark and holds. `sessionStorage` prevents repeats.

Everything obeys `prefers-reduced-motion: reduce`: reveals resolve instantly,
the ident does not run, the scroll rule stops animating, and the grain drops to
3%. No parallax, no scroll-jacking, no cursor effects, no easing that overshoots.

## 6. Responsive behaviour

Mobile is composed, not shrunk. Below 900px the navigation becomes a full-screen
drawer with display-scale links; the rail-and-column grids collapse to a single
column with the metadata label above rather than beside; exhibit plates keep
16:9 rather than cropping to square; the booking calendar and its form stack, so
choosing a time and giving details are two clear steps instead of two crowded
panes. Type stays at editorial scale — the `d1` floor is 36px, not 24px.

Breakpoints: 560, 720, 820, 900, 960. Fluid `clamp()` between them.

## 7. Content structure

`content/*.json` is the CMS layer. Editing a file and rebuilding is the whole
workflow; no page needs redesigning to add an entry.

    projects.json      slug, client, category, year, commission, statement,
                       frame, crop, home (running order),
                       chapters[label, head, text[]], system[], outcome
    journal.json       slug, title, date, dek, reading, body[{t:p|h|q, v}]
    capabilities.json  slug, title, line, detail
    method.json        no, title, line
    team.json          name, role, bio
    engagements.json   no, title, line, includes[], cta

Adding a project writes its case study page, its work-index entry, its homepage
exhibit and its sitemap row. Case studies follow the required chapter order:
objective, what we heard, opportunity, idea, world, system, outcome.

Nothing is fabricated. The three projects are labelled **Concept Commission**
and each outcome section says plainly that it was not produced for a client and
that no results are claimed. There are no invented clients, awards, testimonials
or metrics anywhere in the build.

## 8. Booking architecture

Real Google Calendar, real Google Meet. `server/index.js`.

    GET  /api/availability?month=YYYY-M&tz=…
         freebusy.query against CALENDAR_ID, minus weekends, minus the notice
         period (18h default), minus anything past the horizon (45d default)
    POST /api/book
         re-runs freebusy for the exact slot, 409s if it has gone, then
         events.insert with conferenceDataVersion:1 and hangoutsMeet
    POST /api/enquiry
         SMTP relay to the studio inbox

Google owns the invitation, the reminders, the reschedule link and the cancel
link, which is why none of that is reimplemented. The front end is entirely
native: month grid, amber availability dots, slot buttons, timezone resolved
from the browser.

Without credentials the endpoints return 503, the panel says so plainly and
routes the visitor to the written enquiry. Nothing is simulated and no booking
is ever silently lost. Connection steps: `server/README.md`.

## 9. CMS architecture

JSON collections plus a deterministic generator. The studio edits content, runs
`python3 build.py`, and deploys `dist/`. For a hosted editor, point any
git-backed CMS (Sveltia, Decap, TinaCMS) at `content/*.json` — the schemas above
map one-to-one onto collection definitions, and the build stays the same.

The logo is deliberately outside the CMS. `build.py` reads outline geometry from
`assets/logo/bs-01-master-positive.svg` at build time. Nobody can re-typeset it,
re-track it or substitute a font, because there is no text version to edit.

## 10. SEO architecture

Canonical `https://bestories.co.uk` on every page. `sitemap.xml` generated from
the same route list the build uses, so it cannot drift. `robots.txt` disallows
`/api/` only. Open Graph and Twitter card on every page, with a 1200×630 card
rendered from the master mark. `Organization` schema on the home page naming
both principals; `Article` schema on every journal entry. Semantic landmarks,
one `h1` per page, skip link, focus-visible rings, `aria-current` on the active
nav item.

Brand string is **Be Stories** everywhere. "Bee Stories" appears nowhere in the
build, including in alt text and metadata.

---

## Files

    build.py                 generator
    content/*.json           the editable layer
    assets/css/site.css      design system
    assets/js/site.js        motion, drawer, booking client
    assets/logo/             the seven production SVGs, untouched,
                             plus PNG derivatives for email and OG
    server/                  booking service, .env.example, connection steps
    email-signatures.html    Isra and Yashir, table layout, no ornament
    dist/                    build output — deploy this
    CONFLICTS.md             brief vs manual, and which won

## Outstanding

Three things need the studio rather than the build:

1. **Google Workspace credentials** — `server/README.md`, three steps.
2. **SMTP** for the enquiry relay — any host.
3. **Film and photography.** Every frame is composed, cropped and waiting. The
   art direction for each is written into the CSS and into the case study's
   "The World" chapter, so a director has a brief rather than a blank slot.
   This is the one thing that will change how the site feels, and the one thing
   that cannot be invented.
