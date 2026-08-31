# Operator checklist — domain, DNS, HTTPS and email

Actions only you can take. **I have made no DNS changes and will not without an
explicit instruction.** Everything below is a verification or a record to create
at your registrar / DNS host.

Canonical origin: `https://bestories.co.uk` (apex, no `www`).

---

## 1. HTTPS

- [ ] Certificate issued and auto-renewing for **both** `bestories.co.uk` and
      `www.bestories.co.uk`. If `www` has no certificate the redirect in §3
      fails with a TLS warning before it can redirect, which is worse than not
      having `www` at all.
- [ ] TLS 1.2 minimum, 1.3 preferred.
- [ ] HTTP → HTTPS redirect at the edge, 301.
- [ ] The app already sends `Strict-Transport-Security: max-age=63072000;
      includeSubDomains; preload`. **Do not submit to the HSTS preload list
      until you are certain every present and future subdomain will be HTTPS** —
      preload removal takes months.

Verify: `curl -sI https://bestories.co.uk | grep -i strict-transport`

## 2. DNS records

| Type | Host | Value | Purpose |
|---|---|---|---|
| A / ALIAS | `@` | your host's IP or hostname | apex → site |
| CNAME | `www` | `bestories.co.uk` | redirect source |
| MX | `@` | Google Workspace MX (`smtp.google.com`, priority 1) | mail |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | SPF |
| TXT | `google._domainkey` | the key Google generates | DKIM |
| TXT | `_dmarc` | see §4 | DMARC |

- [ ] Exactly **one** SPF record on the apex. Two SPF records is a permanent
      fail, not a warning. If you already have one, merge the include rather
      than adding a second.
- [ ] If your host requires it, add the TXT verification record it asks for.

## 3. Canonical domain and redirects

- [ ] `www.bestories.co.uk` → `https://bestories.co.uk` (301, preserving path
      and query string). The query string matters: the engagement CTAs use
      `?engagement=commission`, and a redirect that drops it silently breaks
      the preselection.
- [ ] `http://` → `https://` (301).
- [ ] No trailing-slash rewriting. Every route is a directory (`/work/`), and
      stripping the slash produces a redirect chain on every internal link.
- [ ] `https://bestories.co.uk` serves 200 and is the only origin that does.

Every page already emits `<link rel="canonical">` at the apex, and
`sitemap.xml` lists apex URLs only.

Verify:

    curl -sI https://www.bestories.co.uk/work/ | head -3     # expect 301 to apex
    curl -sI https://bestories.co.uk/nothing-here | head -1  # expect HTTP/2 404

## 4. Email authentication

Google Workspace signs outbound mail once DKIM is generated and published.

- [ ] **DKIM.** Admin console → Apps → Google Workspace → Gmail →
      Authenticate email → Generate new record (2048-bit) → publish the TXT at
      `google._domainkey` → return and click **Start authentication**. It is not
      active until you click that.
- [ ] **SPF** as in §2.
- [ ] **DMARC.** Start in monitor mode, then tighten:

          _dmarc  TXT  "v=DMARC1; p=none; rua=mailto:admin@bestories.co.uk; fo=1"

      Read the aggregate reports for two weeks. When SPF and DKIM are aligned
      and passing, move to `p=quarantine`, then `p=reject`. Going straight to
      `p=reject` before DKIM is confirmed will bounce your own outbound mail —
      including every booking confirmation — and you will not find out from a
      prospect who never replies.

Verify with a message to a Gmail address, then *Show original*: SPF `PASS`,
DKIM `PASS`, DMARC `PASS`.

## 5. Transactional email sender

The site sends from `enquiries@bestories.co.uk` via SMTP.

- [ ] Choose one of:
      - **SMTP relay** — Admin console → Apps → Gmail → Routing → SMTP relay
        service. Host `smtp-relay.gmail.com`, port 587, TLS required, restrict
        by IP to your server. Preferred: no user password involved.
      - **App password** on the `enquiries@` or `admin@` account, with 2-step
        verification on. Simpler, but the credential is a user password.
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` set as environment
      variables on the host. Never in the repository.
- [ ] Send one live enquiry and confirm it arrives, is not in spam, and that
      **Reply** goes to the enquirer rather than to the studio.

Note the two mail paths are different: booking **invitations** are sent by
Google Calendar itself from the calendar owner, and work as soon as OAuth is
connected. The studio **confirmation** and the **enquiry form** both go through
SMTP, so without it the enquiry form returns a visible error and bookings still
succeed but carry no manage link email.

## 6. Final smoke test on the live domain

- [ ] `curl -s https://bestories.co.uk/api/health` → `"status":"operational"`
- [ ] `cd server && npm run verify` against production credentials → all green,
      exit code 0
- [ ] One real booking to your own address: invitation arrives, Meet link opens,
      event is on admin@bestories.co.uk's calendar, the *Reschedule or cancel*
      link loads `/manage/` with the booking shown
- [ ] Reschedule it, then cancel it, and confirm both updates arrive
- [ ] One real enquiry: arrives, replies to the sender
- [ ] `curl -sI https://bestories.co.uk | grep -i content-security-policy`
      returns a policy containing `script-src 'self'`
