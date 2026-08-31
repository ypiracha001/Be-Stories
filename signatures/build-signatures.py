#!/usr/bin/env python3
"""
be stories. — Gmail signature build

Generates:
  assets/logo/be-stories-signature.png       hosted logo, 2x, bone plate
  assets/logo/be-stories-signature-dark.png  optional reversed variant
  signatures/signature-isra.html
  signatures/signature-yashir.html
  signatures/preview.html

The wordmark is rasterised from the same locked outline the site uses. It is
never re-typeset and never redrawn.

Run:  python3 signatures/build-signatures.py
"""
import os, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, '/home/claude/bs')          # locked glyph geometry

from lay import build as build_mark            # noqa: E402
from PIL import Image, ImageDraw               # noqa: E402

SITE = 'https://bestories.co.uk'
ASSET_PATH = '/assets/logo/be-stories-signature.png'
ASSET_URL = SITE + ASSET_PATH

INK = (21, 19, 15)          # #15130F
BONE = (239, 234, 224)      # #EFEAE0
POINT = (160, 100, 31)      # #A0641F
POINT_REV = (190, 128, 56)  # #BE8038

MARK_H = 26                 # displayed height of the wordmark, px
VB_H = 789.0                # viewBox height of the production outline

# ---------------------------------------------------------------- the asset
def render_plate(fg, bg, point, path, scale=2, transparent=False):
    """The wordmark on a solid field, with the manual's clear space:
       x-height of the mark = 0.68 x its height, on all four sides."""
    fills, holes, dotp, meta = build_mark()
    pad = round(MARK_H * 0.68)                       # clear space, per the manual
    mark_w = round(MARK_H * (meta['w'] + 16) / VB_H)
    w, h = mark_w + pad * 2, MARK_H + pad * 2

    ss = 4
    if transparent:
        im = Image.new('RGBA', (w * scale * ss, h * scale * ss), (0, 0, 0, 0))
        bg = (0, 0, 0, 0)
        fg = fg + (255,); point = point + (255,)
    else:
        im = Image.new('RGB', (w * scale * ss, h * scale * ss), bg)
    dr = ImageDraw.Draw(im)
    sc = (MARK_H * scale * ss) / VB_H
    ox, oy = pad * scale * ss, pad * scale * ss

    def poly(p, col):
        dr.polygon([((x + 8) * sc + ox, (y + 10) * sc + oy) for x, y in p.poly()], fill=col)

    for p in fills: poly(p, fg)
    for p in holes: poly(p, bg)
    poly(dotp, point)

    im.resize((w * scale, h * scale), Image.LANCZOS).save(path, optimize=True)
    return w, h, os.path.getsize(path)

# ---------------------------------------------------------------- signatures
FONT = ("-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif")
MONO = ("ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace")
DIM = '#6B675F'             # ink at 62% — 5.4:1 on white, readable when inverted

def signature(name, role, email, w, h):
    """Table layout, inline styles only, no classes, no media queries, no
       webfonts, no script, no tracking. Everything Gmail would strip is
       simply not used."""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-spacing:0;font-family:{FONT};color:#15130F;">
  <tr>
    <td style="padding:0 0 2px 0;font-family:{FONT};font-size:14px;font-weight:700;letter-spacing:-0.01em;line-height:1.35;color:#15130F;">{name}</td>
  </tr>
  <tr>
    <td style="padding:0 0 16px 0;font-family:{FONT};font-size:12px;font-weight:400;line-height:1.4;color:{DIM};">{role}</td>
  </tr>
  <tr>
    <td style="padding:0 0 14px 0;line-height:0;">
      <a href="{SITE}" style="text-decoration:none;border:0;outline:none;" target="_blank"><img src="{ASSET_URL}" alt="be stories." width="{w}" height="{h}" style="display:block;width:{w}px;height:{h}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:{FONT};font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#15130F;"></a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 10px 0;font-family:{MONO};font-size:10px;letter-spacing:0.18em;line-height:1.4;color:{DIM};">LONDON &middot; GLASGOW</td>
  </tr>
  <tr>
    <td style="font-family:{FONT};font-size:12px;line-height:1.75;color:#15130F;">
      <a href="mailto:{email}" style="color:#15130F;text-decoration:none;">{email}</a><br>
      <a href="{SITE}" style="color:#15130F;text-decoration:none;" target="_blank">bestories.co.uk</a>
    </td>
  </tr>
</table>"""

PEOPLE = [
    ('isra', 'Isra Mahmood', 'Creative Director', 'isra@bestories.co.uk'),
    ('yashir', 'Yashir Piracha', 'Founder', 'yashir@bestories.co.uk'),
]

def main():
    logo_dir = os.path.join(ROOT, 'assets', 'logo')
    os.makedirs(logo_dir, exist_ok=True)
    w, h, size = render_plate(INK, BONE, POINT, os.path.join(logo_dir, 'be-stories-signature.png'))
    _, _, size_d = render_plate(BONE, (10, 9, 8), POINT_REV,
                                os.path.join(logo_dir, 'be-stories-signature-dark.png'))
    _, _, size_t = render_plate(INK, BONE, POINT,
                                os.path.join(logo_dir, 'be-stories-signature-transparent.png'),
                                transparent=True)
    print('logo  : %dx%d displayed (2x asset), %.1f KB  [default]' % (w, h, size / 1024))
    print('dark  : %.1f KB  [for a dark-only send, not used by default]' % (size_d / 1024))
    print('trans : %.1f KB  [alternative, disappears in force-dark clients]' % (size_t / 1024))

    sigs = {}
    for slug, name, role, email in PEOPLE:
        markup = signature(name, role, email, w, h)
        sigs[slug] = (name, role, markup)
        out = os.path.join(HERE, 'signature-%s.html' % slug)
        open(out, 'w').write(markup + '\n')
        print('write : signatures/signature-%s.html (%d bytes)' % (slug, len(markup)))

    # ---- preview: both signatures, light and dark, plus images-blocked ----
    blocks = ''
    for ground, label, bg, fg in (
        ('light', 'Light client — Gmail web, Apple Mail light', '#FFFFFF', '#15130F'),
        ('dark', 'Dark client — Gmail app dark theme (message card darkened)', '#1C1B19', '#EFEAE0'),
    ):
        cards = ''
        for slug, (name, role, markup) in sigs.items():
            cards += ('<div class="card" style="background:%s">'
                      '<p class="lab" style="color:%s">%s</p>%s</div>' % (bg, fg, name, markup))
        blocks += '<section><h2>%s</h2><div class="row">%s</div></section>' % (html.escape(label), cards)

    noimg = ''
    for slug, (name, role, markup) in sigs.items():
        stripped = markup.replace('src="%s"' % ASSET_URL, 'src="about:blank"')
        noimg += ('<div class="card" style="background:#FFFFFF">'
                  '<p class="lab" style="color:#15130F">%s</p>%s</div>' % (name, stripped))
    blocks += ('<section><h2>Remote images blocked — the alt text carries the wordmark</h2>'
               '<div class="row">%s</div></section>' % noimg)

    preview = """<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>be stories. — email signatures</title>
<style>
  body{margin:0;background:#121110;color:#EFEAE0;
       font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
       padding:40px 20px}
  .wrap{max-width:900px;margin:0 auto}
  h1{font-size:28px;letter-spacing:-.03em;margin:10px 0 6px}
  h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:400;
     color:rgba(239,234,224,.5);margin:44px 0 14px;font-family:ui-monospace,Menlo,monospace}
  p.intro{color:rgba(239,234,224,.7);max-width:60ch;margin:0 0 8px}
  .row{display:grid;grid-template-columns:1fr;gap:14px}
  @media(min-width:720px){.row{grid-template-columns:1fr 1fr}}
  .card{padding:26px;border-radius:3px;border:1px solid rgba(239,234,224,.12)}
  .lab{font:10px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;
       opacity:.45;margin:0 0 18px}
  code{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;
       background:rgba(239,234,224,.07);padding:2px 6px;border-radius:2px}
  .note{border-left:2px solid #BE8038;padding-left:14px;color:rgba(239,234,224,.72);
        font-size:13.5px;margin:26px 0}
</style></head><body><div class="wrap">
<p style="font:10px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;opacity:.5">
Preview &middot; not a deliverable</p>
<h1>Email signatures</h1>
<p class="intro">Rendered exactly as the two HTML files will paste into Gmail. The logo is served from
<code>""" + ASSET_URL + """</code> and will show as a broken reference here until that path is live.</p>
<div class="note">The wordmark sits on a bone field rather than a transparent one. That is deliberate:
a transparent PNG of ink letterforms disappears entirely when a client darkens the message background,
and Gmail strips the media queries that would otherwise let us swap assets. The bone field is a sanctioned
ground in the identity manual, and it carries the required clear space with it.</div>
""" + blocks + """
</div></body></html>"""
    open(os.path.join(HERE, 'preview.html'), 'w').write(preview)
    print('write : signatures/preview.html')

if __name__ == '__main__':
    main()
