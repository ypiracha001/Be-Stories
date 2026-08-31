# Email signatures — install and host

Two files, one hosted image. No JavaScript, no webfonts, no tracking pixel, no
banner, no social icons, no quote. The only colour anywhere is the amber full
stop inside the logotype, which is the one element the identity manual permits
to carry pigment.

---

## 1. Host the logo first

The signatures reference one image. **Install the signatures only after this
path is live**, or the first sends will carry a broken reference.

| File | Must be reachable at |
|---|---|
| `assets/logo/be-stories-signature.png` | `https://bestories.co.uk/assets/logo/be-stories-signature.png` |

The site build already copies `assets/` into `dist/`, so deploying the site
publishes it — no separate upload. Confirm before proceeding:

    curl -sI https://bestories.co.uk/assets/logo/be-stories-signature.png | head -3
    # expect: HTTP/2 200 and content-type: image/png

The asset is 416 × 124 (a 2× retina render) declared at 208 × 62, 11.5 KB.
It is rasterised from the same locked outline the website uses — the wordmark
is not re-typeset and not redrawn, and it carries the manual's clear space
(0.68 × the mark's height) baked into the image.

### Why a PNG on a bone field, and not an SVG

Gmail strips `<svg>` entirely and refuses `<style>` blocks and media queries in
signatures, so the two obvious approaches — an inline SVG, or a light/dark
asset swap via `prefers-color-scheme` — are both unavailable. That leaves a
hosted raster.

The field behind it is deliberate. A transparent PNG of ink letterforms
vanishes completely when a client darkens the message background, which the
Gmail mobile app does. A bone field is a sanctioned ground in the identity
manual, it carries the clear space with it, and it renders identically in every
client regardless of theme.

Two alternatives are built and available if you want them:

| File | Use |
|---|---|
| `be-stories-signature-transparent.png` | if you prefer no visible field and accept that it disappears in force-dark clients |
| `be-stories-signature-dark.png` | bone mark on ink, if you ever need a signature for a dark-only context |

To switch, change `ASSET_PATH` in `signatures/build-signatures.py` and rebuild.

---

## 2. Install in Gmail

Do this **per person**, signed in to their own account. A signature belongs to
the mailbox, not to the domain, so this cannot be done once centrally unless
you use the Workspace admin append feature (see §4).

1. Open `signatures/signature-isra.html` (or `-yashir`) **in a browser**.
   Do not open it in a text editor and copy the code — Gmail needs the rendered
   result, not the markup.
2. Select the whole signature: click just above it and drag to just below, or
   press `Cmd/Ctrl + A`.
3. Copy: `Cmd/Ctrl + C`.
4. In Gmail: **Settings** (gear, top right) → **See all settings** → **General**
   tab → scroll to **Signature**.
5. Click **+ Create new**, name it `Be Stories`, and click **Create**.
6. Click into the signature editor and paste: `Cmd/Ctrl + V`.
   The logo, spacing and links come across intact.
7. Under **Signature defaults**, set both dropdowns — *FOR NEW EMAILS USE* and
   *ON REPLY/FORWARD USE* — to `Be Stories`.
8. Tick **Insert signature before quoted text and remove the "--" line**.
   Without this, Gmail buries the signature at the bottom of long reply chains
   and prepends a plain-text separator that is not part of the design.
9. Scroll to the bottom and click **Save Changes**. Gmail does not save on blur.

### Verify

Send one message to a personal address on a different provider and confirm:

- [ ] The logotype appears, is sharp on a retina screen, and links to
      `https://bestories.co.uk`
- [ ] The email address opens a compose window
- [ ] `bestories.co.uk` opens the site
- [ ] With remote images blocked, the block still reads as **be stories.** in
      bold — the alt text is styled to carry the wordmark
- [ ] It looks correct in the Gmail mobile app, in both light and dark theme
- [ ] Replying twice does not stack two copies

---

## 3. If the paste loses its formatting

Two causes, both common.

**Gmail's "Plain text mode" is on.** In the compose window, the three-dot menu
→ untick *Plain text mode*, then paste again.

**You copied from a code editor rather than a browser.** Gmail pastes the
literal markup as text. Always open the `.html` file in a browser first.

The signature is intentionally under 2 KB, so Gmail's 10,000-character
signature limit is not a factor.

---

## 4. Optional: Workspace-wide append

Admin console → Apps → Google Workspace → Gmail → **Compliance** → *Append
footer*. This adds the signature server-side to every outbound message.

Use it only if you want it enforced. Two trade-offs worth knowing before you
do: the appended footer always lands at the very bottom of a reply chain, below
the quoted text, which the per-user method avoids; and senders cannot see it
while composing, so mistakes go unnoticed for longer. For a two-person studio,
the per-user install in §2 gives a better result.

---

## 5. Rebuilding

    python3 signatures/build-signatures.py

Regenerates both HTML files, all three logo variants and the preview. The
wordmark geometry is read from the production outline every time, so if the
logo is ever re-cut, rebuilding picks it up and the signatures cannot drift
from the identity.

---

## What is deliberately absent

Tracking pixel, read receipt, banner, campaign strip, social icons,
"sent from" line, inspirational quote, award badge, certification logo,
phone number (there is none to publish yet), and any external font request.
The typeface is a system stack — Gmail cannot load a webfont, so IBM Plex Mono
for the `LONDON · GLASGOW` line falls back to the system monospace. That is a
constraint of the medium, not a change to the identity.
