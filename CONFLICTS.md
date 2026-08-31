# Precedence record — where the build brief and the identity manual disagreed

The brand manual and the seven production SVGs are authoritative. Where the
website brief conflicted with them, the identity won. Every conflict found is
listed here with the resolution, so nothing is quietly overridden later.

| # | Brief said | Manual / SVG says | Resolution |
|---|---|---|---|
| 1 | Signature Amber `#B77822` (marked "approximate") | Point `#A0641F`, lightened to `#BE8038` on dark grounds, described as *the only permitted variation of the accent* | Manual. `--amber: #A0641F`, `--amber-rev: #BE8038`. `#B77822` appears nowhere in the build. |
| 2 | Ink `#11100E` | Ink `#15130F`; `#0A0908` permitted as a screen page-ground behind a reversed mark | Manual. `--ink: #15130F`. `#0A0908` is used only where the manual permits it — the deep bands and the film frame. |
| 3 | Bone `#F1ECE2` | Bone `#EFEAE0` | Manual. `--bone: #EFEAE0`, paper `#E5DFD3`. |
| 4 | "favicon based on approved custom **e**" | The favicon is the **b**. `bs-04`, `bs-05` and `bs-06` are all the b. The manual gives the reasoning: first letter, most proprietary drawing, unambiguous at 16px, which no two-letter crop of this wordmark is | Files. The site ships the b, at every size. |
| 5 | Motion approximately 0.8–1.4 seconds | Extend 0–0.67s, hold to 1.10s, absorb to 2.06s, point 2.11–2.30s | Manual. The ident runs the manual's timeline. It still reads as quick because only the stroke moves. |
| 6 | Theme colour `#11100E` | — | Follows conflict 2: `#15130F`. |

## Not conflicts, but worth stating

**Amber in the interface.** The manual's rule that the point is the only
coloured element scopes to the identity: the letterforms are ink or bone, and
they are, everywhere. The brief separately permits amber for tiny rules, active
states, selected metadata, section numbering and restrained hover details, and
the build uses it only for those. No amber ever touches a letterform, and there
are no amber fields.

**Smoke `#8C887F`.** Not in the manual, so no conflict. Used only for secondary
metadata, and only where it clears contrast against its ground.

**Clear space.** The manual requires the x-height of the mark — 0.68 × its
height — on all four sides. This is enforced in CSS on `.brand` rather than
left to layout, so no future spacing change can encroach on it.

**Minimum size.** The manual's screen floor is 110px wide / 16px tall. The
smallest wordmark instance in the build is the masthead at 17px tall (≈113px
wide). The email signature PNG is 199px wide. Nothing is below the floor.

**Descriptor.** The manual forbids locking a descriptor to the mark. The footer
therefore carries the mark, then an address line at more than one clear-space
unit below it, as separate footer content rather than a lockup. No page pairs a
strapline with the wordmark.

**The wordmark is never typeset.** `build.py` reads the outline geometry
directly out of `assets/logo/bs-01-master-positive.svg` at build time and emits
it as an SVG `<defs>` sprite. There is no font fallback, no CSS text version and
no tracking applied anywhere. If the SVG is ever re-cut, rebuilding the site
picks up the new geometry automatically and cannot drift from it.

**The continuation is never a still.** It exists only in the ident, plays once
per session, resolves to the static master mark and holds. The Open Graph image
and every other raster asset use the resolved mark.
