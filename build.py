#!/usr/bin/env python3
"""
be stories. — static site build
Edit content/*.json (the CMS layer), run `python3 build.py`, deploy dist/.
The logo is never typeset: geometry is read straight from assets/logo/*.svg.
"""
import json, os, re, shutil, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
SITE = 'https://bestories.co.uk'

# External profiles. Leave empty and the footer omits the item rather than
# shipping a guessed URL. Fill it in and the link appears everywhere.
LINKEDIN = ''

# ---------------------------------------------------------------- logo (locked)
raw = open(os.path.join(ROOT, 'assets/logo/bs-01-master-positive.svg')).read()
VB = re.search(r'viewBox="([^"]+)"', raw).group(1)
PATHS = re.findall(r'<path d="([^"]+)"', raw)
MARK_D, DOT_D = PATHS[0], PATHS[1]
IDENT_X, IDENT_LEN, IDENT_Y, IDENT_H = 1339, 328, 415, 112   # datum band, from the manual

def defs():
    return ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">'
            '<defs><path id="bs-mark" d="%s"/><path id="bs-point" d="%s"/></defs></svg>'
            % (MARK_D, DOT_D))

def mark(h=18, ink='currentColor', point='var(--amber-rev)', ident=False, cls=''):
    """The approved wordmark, placed from the production outline. Never re-set."""
    bar = ''
    if ident:
        bar = ('<rect class="ident-bar" data-x0="%d" data-len="%d" x="%d" y="%d" width="0" height="%d" fill="%s"/>'
               % (IDENT_X, IDENT_LEN, IDENT_X, IDENT_Y, IDENT_H, ink))
    return ('<svg class="%s" viewBox="%s" style="height:%spx;width:auto" role="img" '
            'aria-label="be stories." %s><use href="#bs-mark" fill="%s"/>%s'
            '<use class="ident-pt" href="#bs-point" fill="%s"/></svg>'
            % (cls, VB, h, 'data-ident' if ident else '', ink, bar, point))

# ---------------------------------------------------------------- content
C = {k: json.load(open(os.path.join(ROOT, 'content', k + '.json')))
     for k in ('projects', 'journal', 'capabilities', 'method', 'team', 'engagements')}

NAV = [('Work', '/work/'), ('Studio', '/studio/'), ('Capabilities', '/capabilities/'),
       ('Journal', '/journal/'), ('Enquiries', '/enquiries/')]

# ---------------------------------------------------------------- shell
def head(title, desc, path, og_type='website', schema=None, noindex=False):
    canon = SITE + path
    s = ['<!DOCTYPE html><html lang="en-GB"><head>',
         '<meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
         '<title>%s</title>' % title,
         '<meta name="description" content="%s">' % desc,
         '<link rel="canonical" href="%s">' % canon,
         '<meta name="theme-color" content="#15130F">',
         '<meta name="robots" content="noindex,nofollow">' if noindex else '',
         '<meta property="og:site_name" content="Be Stories">',
         '<meta property="og:type" content="%s">' % og_type,
         '<meta property="og:title" content="%s">' % title,
         '<meta property="og:description" content="%s">' % desc,
         '<meta property="og:url" content="%s">' % canon,
         '<meta property="og:image" content="%s/assets/og/be-stories-og.png">' % SITE,
         '<meta name="twitter:card" content="summary_large_image">',
         '<link rel="icon" href="/assets/logo/bs-06-favicon-16px.svg" sizes="16x16 24x24">',
         '<link rel="icon" href="/assets/logo/bs-04-favicon.svg" sizes="any" type="image/svg+xml">',
         '<link rel="apple-touch-icon" href="/assets/logo/bs-05-favicon-reversed.svg">',
         '<link rel="manifest" href="/site.webmanifest">',
         '<link rel="preconnect" href="https://fonts.googleapis.com">',
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400&display=swap">',
         '<link rel="stylesheet" href="/assets/css/site.css">']
    if schema:
        s.append('<script type="application/ld+json">%s</script>' % json.dumps(schema, separators=(',', ':')))
    s.append('</head><body>')
    return ''.join(s)

def masthead(active):
    links = ''.join('<a href="%s"%s>%s</a>' % (u, ' aria-current="page"' if u == active else '', n)
                    for n, u in NAV)
    drawer = ''.join('<a href="%s">%s</a>' % (u, n) for n, u in NAV)
    return ('<a class="skip" href="#main">Skip to content</a>'
            '<div class="grain" aria-hidden="true"></div>'
            '<header class="masthead"><div class="masthead__in">'
            '<a class="brand" href="/" aria-label="be stories. — home">%s</a>'
            '<nav class="nav" aria-label="Primary">%s'
            '<a class="cta" href="/booking/">Discuss a project</a></nav>'
            '<button type="button" class="burger" aria-expanded="false" aria-controls="drawer">'
            '<i aria-hidden="true"></i>Menu</button>'
            '</div></header>'
            '<div class="drawer" id="drawer" data-open="false"><nav aria-label="Mobile">%s'
            '<a href="/booking/">Discuss a project</a></nav>'
            '<div class="foot meta">London &middot; Glasgow &middot; bestories.co.uk</div></div>'
            % (mark(17, ident=True), links, drawer))

def footer():
    third = ([('LinkedIn', LINKEDIN)] if LINKEDIN else []) + \
            [('Privacy', '/privacy/'), ('Terms', '/terms/')]
    cols = [[('Work', '/work/'), ('Studio', '/studio/'), ('Capabilities', '/capabilities/')],
            [('Journal', '/journal/'), ('Enquiries', '/enquiries/'), ('Discuss a project', '/booking/')],
            third]
    def a(n, u):
        ext = u.startswith('http')
        return '<a href="%s"%s>%s</a>' % (
            u, ' target="_blank" rel="noopener noreferrer"' if ext else '', n)
    nav = ''.join('<div>%s</div>' % ''.join(a(n, u) for n, u in c) for c in cols)
    return ('<footer class="foot"><div class="shell">'
            '<div class="foot__top">'
            '<div><div class="brand">%s</div>'
            '<p class="meta" style="margin-top:20px">London &middot; Glasgow</p>'
            '<p class="body" style="margin-top:18px;max-width:30ch;font-size:15px">'
            'A selective creative storytelling studio. We work alongside the teams '
            'already responsible for the brand.</p></div>'
            '<nav class="foot__nav" aria-label="Footer">%s</nav>'
            '</div>'
            '<div class="foot__base"><span class="meta">&copy; <span data-year>2026</span> Be Stories</span>'
            '<a class="meta" href="mailto:hello@bestories.co.uk">hello@bestories.co.uk</a>'
            '<span class="meta">bestories.co.uk</span></div>'
            '</div></footer>'
            '<script src="/assets/js/site.js" defer></script></body></html>'
            % (mark(22), nav))

CSP_HASHES = {}

def page(path, title, desc, body, active=None, og_type='website', schema=None,
         noindex=False, filename=None):
    html = head(title, desc, path, og_type, schema, noindex) + defs() + masthead(active) + \
        '<main id="main">' + body + '</main>' + footer()
    if filename:
        out = os.path.join(DIST, filename)
    else:
        out = os.path.join(DIST, path.strip('/'), 'index.html') if path != '/' \
            else os.path.join(DIST, 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w').write(html)
    # sha256 of each inline <script> body, for a script-src without 'unsafe-inline'
    inline = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)
    if inline:
        import hashlib, base64
        CSP_HASHES[path] = ['sha256-' + base64.b64encode(
            hashlib.sha256(b.encode()).digest()).decode() for b in inline]
    return html

# ---------------------------------------------------------------- fragments
SHOW_ASSET_NOTES = True   # set False the day real film lands

def field(fid, label, name, kind='text', required=False, hint=None, options=None,
          autocomplete=None, inputmode=None, rows=None):
    """One accessible field: label, control, optional hint, live error region."""
    described = []
    if hint: described.append(fid + '-hint')
    described.append(fid + '-err')
    attrs = ' id="%s" name="%s" aria-describedby="%s"' % (fid, name, ' '.join(described))
    if required: attrs += ' required aria-required="true"'
    if autocomplete: attrs += ' autocomplete="%s"' % autocomplete
    if inputmode: attrs += ' inputmode="%s"' % inputmode
    if options is not None:
        ctl = '<select%s>%s</select>' % (attrs, ''.join('<option>%s</option>' % o for o in options))
    elif kind == 'textarea':
        ctl = '<textarea%s rows="%d"></textarea>' % (attrs, rows or 4)
    else:
        ctl = '<input type="%s"%s>' % (kind, attrs)
    h = ('<p class="hint" id="%s-hint">%s</p>' % (fid, hint)) if hint else ''
    return ('<div class="field" data-invalid="false">'
            '<label for="%s">%s</label>%s%s'
            '<p class="err" id="%s-err" role="alert" hidden></p></div>'
            % (fid, label, ctl, h, fid))

def plate(kind='', note='Film still — asset pending'):
    return ('<div class="plate %s"><span class="plate__note meta">%s</span></div>' % (kind, note))

def frame(kind, cls='', note='Frame pending'):
    """An art-directed light study holding the place of film not yet shot.
       Composed per project: key direction, temperature, falloff.
       To drop in the real thing, replace .frame__light with <video> or <picture>."""
    n = ('<span class="frame__note">%s</span>' % note) if (SHOW_ASSET_NOTES and note) else ''
    return ('<div class="frame frame--%s %s"><div class="frame__light" aria-hidden="true"></div>'
            '<div class="frame__grain" aria-hidden="true"></div>%s</div>' % (kind, cls, n))

def world(p, i):
    """A project as a world you enter: metadata, one line, then the frame."""
    return ('<a class="world rv" href="/work/%s/" data-d="%d">'
            '<div class="shell"><div class="world__meta">'
            '<span class="pill">%s</span><span class="meta">%s</span><span class="meta">%s</span></div>'
            '<h3 class="d2 world__idea">%s</h3></div>'
            '<div class="world__frame">%s</div>'
            '<div class="shell world__more"><span class="link">See the world'
            '<span class="arw">&rarr;</span></span></div></a>'
            % (p['slug'], (i % 3) * 60, p['commission'], p['category'], p['year'],
               p['statement'], frame(p['frame'], 'frame--bleed frame--' + p['crop'])))

def exhibit(p, i, tag='a', bone=False):
    href = '/work/%s/' % p['slug']
    return ('<%s class="exhibit rv" %s data-d="%d">'
            '<div class="exhibit__head"><span class="exhibit__no">%02d</span>'
            '<span class="meta">%s</span><span class="meta">%s</span>'
            '<span class="meta">%s</span><span class="pill">%s</span></div>'
            '<h3 class="d2">%s</h3>%s</%s>'
            % (tag, ('href="%s"' % href) if tag == 'a' else '', (i % 3) * 90, i + 1,
               p['client'], p['category'], p['year'], p['commission'], p['statement'],
               plate('', p.get('plate_note', 'Film still — asset pending')), tag))

def stmt(a, b):
    return ('<div class="stmt rv"><span class="d2">%s</span>'
            '<span class="d2 b">%s</span></div>' % (a, b))

# ---------------------------------------------------------------- home
def build_home():
    home = sorted([p for p in C['projects'] if p.get('home')], key=lambda x: x['home'])
    lead = [p for p in C['projects'] if p['slug'] == 'orchard-04'][0]
    caps = ''.join(
        '<a class="index__row rv" data-d="%d" href="/capabilities/#%s">'
        '<span class="meta">%02d</span><h3>%s</h3><p>%s</p></a>'
        % ((i % 4) * 60, c['slug'], i + 1, c['title'], c['line'])
        for i, c in enumerate(C['capabilities']))
    method = ''.join(
        '<div class="index__row rv" data-d="%d"><span class="meta meta--amber">%s</span>'
        '<h3>%s</h3><p>%s</p></div>' % ((i % 3) * 70, m['no'], m['title'], m['line'])
        for i, m in enumerate(C['method']))
    ways = ''.join(
        '<div class="way rv"><div><span class="meta meta--amber">%s</span>'
        '<h3 class="d3" style="margin-top:12px">%s</h3></div>'
        '<div><p class="body" style="margin:0 0 14px">%s</p><ul>%s</ul></div>'
        '<div><a class="link" href="%s">%s<span class="arw">&rarr;</span></a></div></div>'
        % (e['no'], e['title'], e['line'], ''.join('<li>%s</li>' % x for x in e['includes']),
           e['href'], e['cta'])
        for e in C['engagements'])
    journal = ''.join(
        '<a class="index__row rv" href="/journal/%s/"><span class="meta">%s</span>'
        '<h3>%s</h3><p>%s</p></a>' % (j['slug'], j['date_label'], j['title'], j['dek'])
        for j in C['journal'][:3])
    worlds = ''.join(world(p, i) for i, p in enumerate(home))

    body = f"""
<section class="hero">
  <div class="hero__field" aria-hidden="true"></div>
  <div class="hero__in">
    <h1 class="d1 rv">We scale stories worth&nbsp;remembering.</h1>
    <p class="lede hero__lede rv" data-d="140">Be Stories partners with ambitious marketing teams to
      develop and scale brand stories through creative direction, film and modern production.</p>
    <div class="links hero__acts rv" data-d="260">
      <a class="link" href="/booking/">Discuss a project<span class="arw">&rarr;</span></a>
      <a class="link" href="#work">View selected work<span class="arw">&rarr;</span></a>
    </div>
    <div class="hero__meta rv" data-d="360">
      <span class="meta">Creative direction &middot; Film &middot; Campaigns &middot; Modern production</span>
      <span class="scroll" aria-hidden="true"><span></span><em class="meta" style="font-style:normal">Scroll</em></span>
    </div>
  </div>
</section>

<section class="band bone">
  <div class="shell cols cols--rail">
    <p class="meta">01</p>
    <div class="stack-l">
      {stmt('Your team knows the brand.', 'We help the story travel further.')}
      <div class="body rv" data-d="90" style="max-width:54ch">
        <p>The strongest brand work rarely begins with an outsider arriving to rewrite everything.
           It begins with listening.</p>
        <p>We work alongside the people who already know the brand, and bring the creative thinking
           and production capability to take an idea further.</p>
      </div>
    </div>
  </div>
</section>

<section class="interrupt">
  {frame(lead['frame'], 'frame--bleed frame--full')}
  <div class="interrupt__cap">
    <span class="pill">{lead['commission']}</span>
    <span class="meta">{lead['category']}</span>
    <span class="meta">{lead['statement']}</span>
  </div>
</section>

<section class="band">
  <div class="shell cols cols--rail">
    <p class="meta">02</p>
    <div class="stack-l">
      {stmt('Most brands do not have a content problem.', 'They have a meaning problem.')}
      <div class="body rv" data-d="90" style="max-width:52ch">
        <p>Brands publish more than ever. People remember less.</p>
        <p>The difference between being seen and being valued is rarely volume. It is the quality of
           the idea.</p>
      </div>
    </div>
  </div>
</section>

<section class="band band--tight" id="work">
  <div class="shell"><p class="meta rv">03 &mdash; Selected work</p></div>
  {worlds}
  <div class="shell" style="margin-top:clamp(30px,5vh,56px)">
    <a class="link" href="/work/">All work<span class="arw">&rarr;</span></a></div>
</section>

<section class="band bone">
  <div class="shell cols cols--rail">
    <p class="meta">04</p>
    <div>
      <h2 class="d2 rv">Desire is designed.</h2>
      <ul class="pace">
        <li>The space around an object.</li>
        <li>The pace of a film.</li>
        <li>The weight of a word.</li>
        <li>The colour used once.</li>
        <li>The detail repeated until it becomes yours.</li>
        <li>We build those signals deliberately.</li>
      </ul>
    </div>
  </div>
</section>

<section class="takeover">
  <div class="takeover__stage">
    {frame('midnight', '', note='')}
    <div class="takeover__inner">
      <div class="takeover__ident">{mark(30, ink='#EFEAE0', point='#BE8038', ident=True)}</div>
      <div class="takeover__line"><p class="d2">Make them feel something.</p></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="shell">
    <div class="cols cols--rail">
      <p class="meta">05</p>
      <div><h2 class="d3 rv tight">What we bring to the room.</h2></div>
    </div>
    <div class="index" style="margin-top:clamp(28px,4vh,52px)">{caps}</div>
  </div>
</section>

<section class="band bone">
  <div class="shell cols cols--rail">
    <p class="meta">06</p>
    <div class="stack-l">
      <h2 class="d2 rv tight">Built to work with your team.</h2>
      <div class="ledger rv" data-d="110">
        <div><p class="meta">Your team brings</p>
          <ul><li>Brand knowledge</li><li>Commercial context</li><li>Customer understanding</li>
              <li>Strategic priorities</li></ul></div>
        <div><p class="meta">We bring</p>
          <ul><li>Creative direction</li><li>Storytelling</li><li>Visual development</li>
              <li>Production capability</li><li>Creative scale</li></ul></div>
      </div>
      <p class="body rv" data-d="180" style="max-width:48ch">Not another agency layer. More creative
        capacity around the work that already matters.</p>
    </div>
  </div>
</section>

<section class="band">
  <div class="shell">
    <div class="cols cols--rail"><p class="meta">07</p>
      <div><h2 class="d3 rv tight">Six movements, in order.</h2></div></div>
    <div class="index" style="margin-top:clamp(28px,4vh,52px)">{method}</div>
  </div>
</section>

<section class="band deep">
  <div class="shell cols cols--rail">
    <p class="meta">08</p>
    <div class="stack-l">
      {stmt('Technology expanded the canvas.', 'Taste still decides what goes on it.')}
      <div class="body rv" data-d="90" style="max-width:52ch">
        <p>Ideas can be explored faster. Worlds can be built without traditional constraints. But scale
           without judgement creates more noise.</p>
        <p>We pair modern production with human creative direction, so output can rise without losing
           what made the idea worth seeing.</p>
      </div>
    </div>
  </div>
</section>

<section class="band bone">
  <div class="shell">
    <div class="cols cols--rail"><p class="meta">09</p>
      <div><h2 class="d3 rv tight">Ways to work together.</h2></div></div>
    <div style="margin-top:clamp(24px,4vh,48px)">{ways}</div>
  </div>
</section>

<section class="band">
  <div class="shell">
    <div class="cols cols--rail"><p class="meta">10</p>
      <div><h2 class="d3 rv tight">Notes from the studio.</h2></div></div>
    <div class="index" style="margin-top:clamp(28px,4vh,52px)">{journal}</div>
    <div style="margin-top:36px"><a class="link" href="/journal/">All notes<span class="arw">&rarr;</span></a></div>
  </div>
</section>

<section class="close">
  {frame('interior', '', note='')}
  <div class="close__in"><div class="shell">
    <h2 class="d2 rv" style="max-width:16ch">Tell us what you are building.</h2>
    <div class="links rv" data-d="120" style="margin-top:32px">
      <a class="link" href="/booking/">Discuss a project<span class="arw">&rarr;</span></a>
      <a class="link" href="/enquiries/">Prefer to write?<span class="arw">&rarr;</span></a>
    </div>
  </div></div>
</section>
"""
    schema = {"@context": "https://schema.org", "@type": "Organization", "name": "Be Stories",
              "url": SITE, "logo": SITE + "/assets/logo/bs-01-master-positive.svg",
              "email": "hello@bestories.co.uk",
              "description": "A selective creative storytelling studio working alongside premium and "
                             "luxury brand teams.",
              "address": [{"@type": "PostalAddress", "addressLocality": "London", "addressCountry": "GB"},
                          {"@type": "PostalAddress", "addressLocality": "Glasgow", "addressCountry": "GB"}],
              "founder": {"@type": "Person", "name": "Yashir Piracha"},
              "employee": [{"@type": "Person", "name": "Isra Mahmood", "jobTitle": "Creative Director"}]}
    page('/', 'Be Stories — We scale stories worth remembering',
         'Be Stories is a selective creative storytelling studio. We work alongside ambitious marketing '
         'teams to develop and scale brand stories through creative direction, film and modern production.',
         body, active=None, schema=schema)

# ---------------------------------------------------------------- work
def build_work():
    items = ''.join(world(p, i) for i, p in enumerate(C['projects']))
    body = f"""
<section class="band" style="padding-top:clamp(120px,18vh,220px)">
  <div class="shell cols cols--rail">
    <p class="meta">Selected work</p>
    <div class="stack">
      <h1 class="d1 rv" style="max-width:13ch">One idea, held all the way through.</h1>
      <p class="lede rv" data-d="100" style="max-width:46ch">Work developed as a creative proposition
        rather than a client commission is labelled <span class="pill">Concept Commission</span></p>
    </div>
  </div>
</section>
<section class="band band--tight">{items}</section>
"""
    page('/work/', 'Work — Be Stories',
         'Selected creative work from Be Stories: campaign platforms, brand films and creative systems '
         'for premium and luxury brands.', body, active='/work/')

    for p in C['projects']:
        chapters = ''.join(
            '<section class="chapter"><p class="meta chapter__label">%s</p>'
            '<div class="cols cols--split"><h2 class="d3 rv">%s</h2>'
            '<div class="body rv" data-d="80">%s</div></div></section>'
            % (ch['label'], ch['head'], ''.join('<p>%s</p>' % t for t in ch['text']))
            for ch in p['chapters'])
        system = ''.join('<li>%s</li>' % s for s in p['system'])
        b = f"""
<section class="band" style="padding-top:clamp(120px,18vh,200px);padding-bottom:0">
  <div class="shell">
    <p class="meta rv">{p['client']} &middot; {p['category']} &middot; {p['year']}</p>
    <h1 class="d1 rv" data-d="80" style="margin-top:24px;max-width:16ch">{p['statement']}</h1>
    <div class="rv" data-d="160" style="margin-top:clamp(32px,5vh,60px)">{frame(p['frame'], 'frame--wide')}</div>
    <dl class="spec" style="margin-top:clamp(28px,4vh,48px)">
      <div><dt>Client</dt><dd>{p['client']}</dd></div>
      <div><dt>Category</dt><dd>{p['category']}</dd></div>
      <div><dt>Year</dt><dd>{p['year']}</dd></div>
      <div><dt>Commission</dt><dd>{p['commission']}</dd></div>
    </dl>
  </div>
</section>
<section class="band band--tight"><div class="shell">{chapters}
  <section class="chapter"><p class="meta chapter__label">The system</p>
    <div class="cols cols--split"><h2 class="d3 rv">One story, expressed across every surface.</h2>
      <ul class="signals rv" data-d="80" style="list-style:none">{system}</ul></div></section>
  <section class="chapter"><p class="meta chapter__label">The outcome</p>
    <div class="cols cols--split"><h2 class="d3 rv">{p['outcome_head']}</h2>
      <div class="body rv" data-d="80"><p>{p['outcome']}</p></div></div></section>
</div></section>
<section class="band deep"><div class="shell">
  <h2 class="d2 rv" style="max-width:18ch">Working on something that deserves this level of care?</h2>
  <div class="links rv" data-d="90" style="margin-top:30px">
    <a class="link" href="/booking/">Discuss a project<span class="arw">&rarr;</span></a>
    <a class="link" href="/work/">Back to work<span class="arw">&rarr;</span></a></div>
</div></section>
"""
        page('/work/%s/' % p['slug'], '%s — Be Stories' % p['client'], p['statement'], b,
             active='/work/', og_type='article')

# ---------------------------------------------------------------- capabilities
def build_capabilities():
    rows = ''.join(
        '<section class="chapter" id="%s"><div class="cols cols--split">'
        '<div><p class="meta meta--amber">%02d</p><h2 class="d3 rv" style="margin-top:12px">%s</h2></div>'
        '<div class="body rv" data-d="70"><p>%s</p><p>%s</p></div></div></section>'
        % (c['slug'], i + 1, c['title'], c['line'], c['detail'])
        for i, c in enumerate(C['capabilities']))
    body = f"""
<section class="band" style="padding-top:clamp(120px,18vh,220px)">
  <div class="shell cols cols--rail"><p class="meta">Capabilities</p>
    <div class="stack"><h1 class="d1 rv" style="max-width:14ch">Senior creative thinking, plus the means
      to make it.</h1>
      <p class="lede rv" data-d="100" style="max-width:52ch">Eight capabilities, used in whatever
        combination the brief actually needs. Nothing here is a package.</p></div></div>
</section>
<section class="band band--tight"><div class="shell">{rows}</div></section>
<section class="band bone"><div class="shell">
  <h2 class="d2 rv" style="max-width:18ch">Not sure which of these you need?</h2>
  <p class="body rv" data-d="80" style="margin-top:20px;max-width:46ch">Most conversations start with the
    objective, not the deliverable. Tell us what you are trying to change.</p>
  <div class="links rv" data-d="140" style="margin-top:28px">
    <a class="link" href="/booking/">Discuss a project<span class="arw">&rarr;</span></a></div>
</div></section>
"""
    page('/capabilities/', 'Capabilities — Be Stories',
         'Creative direction, brand storytelling, campaign development, film and motion, AI-native '
         'production, creative scaling, paid creative and global adaptation.', body, active='/capabilities/')

# ---------------------------------------------------------------- studio
def build_studio():
    people = ''.join(
        '<div class="rv" data-d="%d"><p class="meta">%s</p>'
        '<h3 class="d3" style="margin-top:10px">%s</h3>'
        '<p class="body" style="margin-top:14px;max-width:38ch">%s</p></div>'
        % (i * 90, t['role'], t['name'], t['bio']) for i, t in enumerate(C['team']))
    body = f"""
<section class="band" style="padding-top:clamp(120px,18vh,220px)">
  <div class="shell cols cols--rail"><p class="meta">Studio</p>
    <div class="stack"><h1 class="d1 rv" style="max-width:13ch">A creative house built for
      collaboration.</h1>
      <p class="lede rv" data-d="100" style="max-width:54ch">Be Stories exists between the traditional
        agency and the modern production studio.</p></div></div>
</section>
<section class="band band--tight"><div class="shell cols cols--rail">
  <p class="meta">Position</p>
  <div class="body rv" style="max-width:58ch">
    <p>We bring senior creative thinking directly into existing brand teams without asking them to rebuild
       their departments or hand over control of the brand.</p>
    <p>We remain deliberately selective so the studio stays close to the work. That is a constraint we
       impose on ourselves, and it is the reason the work looks the way it does.</p>
  </div></div>
</section>
<section class="band bone"><div class="shell cols cols--rail">
  <p class="meta">Leadership</p><div class="people">{people}</div></div>
</section>
<section class="band"><div class="shell cols cols--rail">
  <p class="meta">Philosophy</p>
  <div class="stack-l">
    <h2 class="d2 rv tight">Built for the era after impossible.</h2>
    <div class="body rv" data-d="80" style="max-width:58ch">
      <p>For most of advertising history, imagination had to negotiate with production. Location. Crew.
         Time. Weather. Budget.</p>
      <p>Those boundaries are changing.</p>
      <p>Be Stories exists to combine what modern production now makes possible with what still matters
         most: judgement. We bring strategy, storytelling, humour, culture, taste and commercial
         intelligence to every brief.</p>
    </div>
    {stmt('The tools will change.', 'The standard will not.')}
  </div></div>
</section>
"""
    page('/studio/', 'Studio — Be Stories',
         'Be Stories is a selective creative storytelling studio in London and Glasgow, led by founder '
         'Yashir Piracha and creative director Isra Mahmood.', body, active='/studio/')

# ---------------------------------------------------------------- journal
def build_journal():
    rows = ''.join(
        '<a class="index__row rv" data-d="%d" href="/journal/%s/"><span class="meta">%s</span>'
        '<h3>%s</h3><p>%s</p></a>' % ((i % 3) * 70, j['slug'], j['date_label'], j['title'], j['dek'])
        for i, j in enumerate(C['journal']))
    body = f"""
<section class="band" style="padding-top:clamp(120px,18vh,220px)">
  <div class="shell cols cols--rail"><p class="meta">Journal</p>
    <div class="stack"><h1 class="d1 rv" style="max-width:12ch">Notes from the studio.</h1>
      <p class="lede rv" data-d="100" style="max-width:50ch">Written when we have something worth saying.
        Not a content schedule.</p></div></div>
</section>
<section class="band band--tight"><div class="shell"><div class="index">{rows}</div></div></section>
"""
    page('/journal/', 'Journal — Be Stories',
         'Notes from the studio on brand storytelling, creative scale, restraint and the economics '
         'of desire.', body, active='/journal/')

    for j in C['journal']:
        body_path = os.path.join(ROOT, 'content', 'journal', j['body_file'])
        with open(body_path, encoding='utf-8') as f:
            blocks = f.read()

        schema = {"@context": "https://schema.org", "@type": "Article", "headline": j['title'],
                  "description": j['dek'], "datePublished": j['date'],
                  "author": {"@type": "Organization", "name": "Be Stories"},
                  "publisher": {"@type": "Organization", "name": "Be Stories"},
                  "mainEntityOfPage": SITE + '/journal/%s/' % j['slug']}

        b = f"""
<section class="band" style="padding-top:clamp(120px,18vh,200px);padding-bottom:0">
  <div class="shell">
    <p class="meta rv">{j['date_label']} &middot; {j['reading']}</p>
    <h1 class="d1 rv" data-d="70" style="margin-top:22px;max-width:17ch">{j['title']}</h1>
  </div>
</section>
<section class="band"><div class="shell"><article class="article rv">
  <p class="dek">{j['dek']}</p>{blocks}</article>
  <div class="links" style="margin-top:56px">
    <a class="link" href="/journal/">All notes<span class="arw">&rarr;</span></a>
    <a class="link" href="/booking/">Discuss a project<span class="arw">&rarr;</span></a></div>
</div></section>
"""
        page('/journal/%s/' % j['slug'], '%s — Be Stories' % j['title'], j['dek'], b,
             active='/journal/', og_type='article', schema=schema)

# ---------------------------------------------------------------- enquiries
def build_enquiries():
    ranges = ['\u00a310k\u2013\u00a325k', '\u00a325k\u2013\u00a350k', '\u00a350k\u2013\u00a3100k',
              '\u00a3100k\u2013\u00a3250k', '\u00a3250k+', 'Prefer not to say yet']
    eng = ['Not sure yet', 'The Commission', 'The Partnership', 'The House']
    body = f"""
<section class="band" style="padding-top:clamp(120px,18vh,220px)">
  <div class="shell cols cols--rail"><p class="meta">Enquiries</p>
    <div class="stack"><h1 class="d1 rv" style="max-width:14ch">Prefer to write?</h1>
      <p class="lede rv" data-d="90" style="max-width:50ch">Tell us what you are working on and what you
        are trying to change. We read everything ourselves.</p>
      <p class="rv" data-d="140"><a class="link" href="mailto:hello@bestories.co.uk">
        hello@bestories.co.uk<span class="arw">&rarr;</span></a></p></div></div>
</section>
<section class="band band--tight"><div class="shell cols cols--rail">
  <p class="meta">The brief</p>
  <form class="rv" data-enquiry data-validate style="max-width:60ch" novalidate>
    <div class="grid-2">
      {field('f-name', 'Name', 'name', required=True, autocomplete='name')}
      {field('f-co', 'Company', 'company', required=True, autocomplete='organization')}
      {field('f-role', 'Role', 'role', autocomplete='organization-title')}
      {field('f-email', 'Work email', 'email', kind='email', required=True,
             autocomplete='email', inputmode='email')}
      {field('f-site', 'Website', 'website', kind='url', autocomplete='url', inputmode='url')}
      {field('f-time', 'Timing', 'timing')}
    </div>
    {field('f-eng', 'How you would like to work', 'engagement', options=eng)}
    {field('f-what', 'What are you working on?', 'working_on', kind='textarea', required=True, rows=4)}
    {field('f-change', 'What are you trying to change?', 'change', kind='textarea', rows=3)}
    {field('f-budget', 'Indicative investment', 'budget', options=ranges,
           hint='A range helps us shape the right conversation. It is not a commitment.')}
    <button class="submit" type="submit">Send enquiry<span class="arw" aria-hidden="true">&rarr;</span></button>
    <p class="formnote">We reply to every enquiry we can help with, and say so plainly when we cannot.</p>
    <div class="notice" hidden role="status" tabindex="-1"></div>
  </form>
</div></section>
"""
    page('/enquiries/', 'Enquiries \u2014 Be Stories',
         'Write to the studio. Tell us what you are working on and what you are trying to change.',
         body, active='/enquiries/')

# ---------------------------------------------------------------- booking
def build_booking():
    eng = ['Not sure yet', 'The Commission', 'The Partnership', 'The House']
    ranges = ['Prefer not to say yet', '\u00a310k\u2013\u00a325k', '\u00a325k\u2013\u00a350k',
              '\u00a350k\u2013\u00a3100k', '\u00a3100k\u2013\u00a3250k', '\u00a3250k+']
    body = f"""
<section class="band" style="padding-top:clamp(120px,18vh,200px);padding-bottom:clamp(30px,5vh,56px)">
  <div class="shell cols cols--rail"><p class="meta">Discuss a project</p>
    <div class="stack"><h1 class="d1 rv" style="max-width:14ch">Tell us what you are building.</h1>
      <p class="lede rv" data-d="90" style="max-width:50ch">A short conversation to understand the brand,
        the opportunity and whether Be Stories is the right creative partner.</p>
      <p class="meta rv" data-d="140">30 minutes &middot; Google Meet &middot; No preparation required</p>
    </div></div>
</section>
<section class="band band--tight" data-booking data-mode="book">
  <div class="shell">
    <div class="book" data-bookui>
      <div>
        <div class="cal__head">
          <h2 class="d3" data-month>&nbsp;</h2>
          <span class="cal__nav">
            <button type="button" data-prev aria-label="Previous month">Prev</button>
            <button type="button" data-next aria-label="Next month">Next</button></span>
        </div>
        <div class="cal__grid" role="group" aria-label="Choose a date"></div>
        <div class="slots" data-slots role="group" aria-label="Choose a time"></div>
        <p class="meta tz" data-slots-note role="status">Select a date to see available times.</p>
        <p class="meta tz">Timezone &middot; <span data-tz>&mdash;</span></p>
        <div class="summary" data-summary role="status"><span class="meta">No time selected</span></div>
      </div>
      <div>
        <form data-validate novalidate>
          <input type="hidden" name="start"><input type="hidden" name="timezone">
          <div class="grid-2">
            {field('b-name', 'Name', 'name', required=True, autocomplete='name')}
            {field('b-email', 'Work email', 'email', kind='email', required=True,
                   autocomplete='email', inputmode='email')}
            {field('b-co', 'Company', 'company', required=True, autocomplete='organization')}
            {field('b-role', 'Role', 'role', autocomplete='organization-title')}
          </div>
          {field('b-site', 'Website', 'website', kind='url', autocomplete='url', inputmode='url')}
          {field('b-eng', 'How you would like to work', 'engagement', options=eng)}
          {field('b-brief', 'Short project summary', 'summary', kind='textarea', required=True, rows=4)}
          {field('b-budget', 'Indicative investment \u2014 optional', 'budget', options=ranges)}
          <button class="submit" type="submit">Confirm conversation
            <span class="arw" aria-hidden="true">&rarr;</span></button>
          <p class="formnote">You will receive a calendar invitation with a Google Meet link, and a link
            to reschedule or cancel.</p>
        </form>
      </div>
    </div>
    <div class="notice" hidden role="status" tabindex="-1"></div>
    <p class="formnote" style="margin-top:40px">Prefer to write? <a class="link" href="/enquiries/">Send an
      enquiry</a> or email <a class="link" href="mailto:hello@bestories.co.uk">hello@bestories.co.uk</a>.</p>
  </div>
</section>
"""
    page('/booking/', 'Discuss a project \u2014 Be Stories',
         'Book a 30-minute introductory conversation with Be Stories. Google Meet, timezone aware.',
         body, active=None)

def build_manage():
    body = """
<section class="band" style="padding-top:clamp(120px,18vh,200px);padding-bottom:clamp(24px,4vh,40px)">
  <div class="shell cols cols--rail"><p class="meta">Your conversation</p>
    <div class="stack"><h1 class="d2 rv" style="max-width:15ch">Reschedule or cancel.</h1>
      <p class="lede rv" data-d="90" style="max-width:46ch">Use the same link in your calendar invitation
        at any time.</p></div></div>
</section>
<section class="band band--tight" data-booking data-mode="reschedule">
  <div class="shell">
    <div class="appt" data-appt role="status"><span class="meta">Loading your booking&hellip;</span></div>
    <div class="book" data-bookui hidden>
      <div>
        <div class="cal__head">
          <h2 class="d3" data-month>&nbsp;</h2>
          <span class="cal__nav">
            <button type="button" data-prev aria-label="Previous month">Prev</button>
            <button type="button" data-next aria-label="Next month">Next</button></span>
        </div>
        <div class="cal__grid" role="group" aria-label="Choose a new date"></div>
        <div class="slots" data-slots role="group" aria-label="Choose a new time"></div>
        <p class="meta tz" data-slots-note role="status">Select a date to see available times.</p>
        <p class="meta tz">Timezone &middot; <span data-tz>&mdash;</span></p>
        <div class="summary" data-summary role="status"><span class="meta">No time selected</span></div>
      </div>
      <div>
        <form data-validate novalidate>
          <input type="hidden" name="start"><input type="hidden" name="timezone">
          <p class="body" style="margin:0 0 22px;max-width:38ch">Choose a new time and confirm. Your
            existing invitation and Google Meet link are updated in place.</p>
          <button class="submit" type="submit">Confirm new time
            <span class="arw" aria-hidden="true">&rarr;</span></button>
        </form>
        <p style="margin-top:34px"><button type="button" class="link danger" data-cancel>Cancel this
          conversation<span class="arw" aria-hidden="true">&rarr;</span></button></p>
      </div>
    </div>
    <div class="notice" hidden role="status" tabindex="-1"></div>
    <p class="formnote" style="margin-top:40px">Any difficulty, write to
      <a class="link" href="mailto:hello@bestories.co.uk">hello@bestories.co.uk</a>.</p>
  </div>
</section>
"""
    page('/manage/', 'Manage your conversation \u2014 Be Stories',
         'Reschedule or cancel your introductory conversation with Be Stories.',
         body, active=None, noindex=True)

def build_404():
    body = """
<section class="band" style="padding-top:clamp(140px,22vh,240px);padding-bottom:clamp(60px,12vh,140px)">
  <div class="shell cols cols--rail"><p class="meta">404</p>
    <div class="stack">
      <h1 class="d1 rv" style="max-width:13ch">This page has been moved, or never existed.</h1>
      <p class="lede rv" data-d="90" style="max-width:44ch">Either way, the work is this way.</p>
      <div class="links rv" data-d="150">
        <a class="link" href="/">Home<span class="arw">&rarr;</span></a>
        <a class="link" href="/work/">Selected work<span class="arw">&rarr;</span></a>
        <a class="link" href="/booking/">Discuss a project<span class="arw">&rarr;</span></a>
      </div>
    </div></div>
</section>
"""
    page('/404/', 'Not found \u2014 Be Stories', 'This page could not be found.',
         body, noindex=True, filename='404.html')

# ---------------------------------------------------------------- legal
LEGAL = {
 'privacy': ('Privacy', 'How Be Stories handles personal data.', [
   ('Who we are', ['Be Stories is a creative storytelling studio operating in London and Glasgow. '
                   'For any question about this notice, or to exercise any right described below, '
                   'write to hello@bestories.co.uk.']),
   ('What we collect', ['When you send an enquiry we collect the name, company, role, work email, '
                        'website, timing, indicative investment and the two written answers you '
                        'provide. When you book a conversation we collect the same identifying '
                        'details, your short project summary, the time you selected and the '
                        'timezone your browser reports.',
                        'That is the complete list. We collect nothing else, and there is no '
                        'analytics, advertising or tracking software of any kind on this site.']),
   ('Cookies', ['This website sets no cookies. It does not use analytics, advertising, tagging or '
                'fingerprinting, and it does not profile visitors.',
                'One item is stored in your browser: a single flag, held in session storage, that '
                'records whether the logotype animation has already played so it does not repeat '
                'on every page. It contains no identifier, it is not sent to any server, and it is '
                'erased when you close the tab. Because it is strictly necessary to a feature you '
                'asked for by visiting, no consent banner is required for it.']),
   ('Third parties', ['Typefaces are requested from Google Fonts when a page loads, which means '
                      'Google receives your IP address and browser user agent as part of that '
                      'request. No other third party receives anything.',
                      'Booking data is processed by Google Workspace, our calendar and mail '
                      'provider, in order to create the event and the Google Meet link and to send '
                      'the invitation. Enquiry messages are delivered to our own mailbox by our '
                      'mail provider.',
                      'We do not sell, share, rent or trade any of it.']),
   ('Why we hold it', ['To reply to your enquiry, to arrange and hold the conversation you '
                       'requested, and to keep a record of the studio\u2019s correspondence. Our '
                       'lawful basis is legitimate interest in responding to a business enquiry '
                       'you chose to start.']),
   ('Server logs', ['Our server records that a request happened, and errors when they occur. It '
                    'does not write your name, email address, project brief or any other field you '
                    'submitted into its logs. Your IP address is held briefly in memory for rate '
                    'limiting and is not stored.']),
   ('How long', ['Enquiries and booking records are retained for 24 months, then deleted. Calendar '
                 'events remain in our calendar unless you cancel them or we delete them. Ask us '
                 'to erase your data sooner and we will.']),
   ('Your rights', ['You may request access, correction, erasure, restriction, or a portable copy '
                    'of your data, and object to our processing of it, by writing to '
                    'hello@bestories.co.uk. We respond within one month. You may also complain '
                    'to the Information Commissioner\u2019s Office at ico.org.uk.']),
 ]),
 'terms': ('Terms', 'Terms of use for bestories.co.uk.', [
   ('Use of this site', ['This website is provided for information about the studio and its work. You may '
                         'read, link to and quote from it with attribution.']),
   ('Intellectual property', ['The Be Stories name, the wordmark, the letterform system and all content on '
                              'this site are the property of Be Stories. The identity may not be '
                              'reproduced, modified or re-typeset.']),
   ('Work shown', ['Projects marked Concept Commission were developed by the studio as creative '
                   'propositions and were not produced for the brand named. No client relationship is '
                   'implied by their inclusion.']),
   ('No warranty', ['Content is provided as-is. Nothing on this site forms an offer, a quotation or a '
                    'contract for services.']),
   ('Governing law', ['These terms are governed by the laws of England and Wales.'])])
}

def build_legal():
    for slug, (title, desc, secs) in LEGAL.items():
        blocks = ''.join('<section class="chapter"><div class="cols cols--split">'
                         '<h2 class="d3 rv">%s</h2><div class="body rv" data-d="70">%s</div></div></section>'
                         % (h, ''.join('<p>%s</p>' % p for p in ps)) for h, ps in secs)
        b = f"""
<section class="band" style="padding-top:clamp(120px,18vh,200px);padding-bottom:0">
  <div class="shell"><p class="meta">{title}</p>
    <h1 class="d2 rv" style="margin-top:20px">{title}</h1>
    <p class="meta" style="margin-top:18px">Last updated {datetime.date.today().strftime('%B %Y')}</p>
  </div></section>
<section class="band"><div class="shell">{blocks}</div></section>
"""
        page('/%s/' % slug, '%s — Be Stories' % title, desc, b)

# ---------------------------------------------------------------- static
def build_static():
    for src, dst in [('assets', 'assets')]:
        shutil.copytree(os.path.join(ROOT, src), os.path.join(DIST, dst), dirs_exist_ok=True)
    urls = ['/', '/work/', '/capabilities/', '/studio/', '/journal/', '/enquiries/', '/booking/',
            '/privacy/', '/terms/'] + ['/work/%s/' % p['slug'] for p in C['projects']] + \
           ['/journal/%s/' % j['slug'] for j in C['journal']]
    today = datetime.date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        pri = '1.0' if u == '/' else ('0.8' if u.count('/') <= 2 else '0.6')
        sm.append('<url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>'
                  % (SITE, u, today, pri))
    sm.append('</urlset>')
    open(os.path.join(DIST, 'sitemap.xml'), 'w').write('\n'.join(sm))
    open(os.path.join(DIST, 'robots.txt'), 'w').write(
        'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: %s/sitemap.xml\n' % SITE)
    open(os.path.join(DIST, 'csp-hashes.json'), 'w').write(json.dumps(CSP_HASHES, indent=1))
    open(os.path.join(DIST, 'site.webmanifest'), 'w').write(json.dumps({
        "name": "Be Stories", "short_name": "Be Stories", "start_url": "/",
        "display": "standalone", "background_color": "#15130F", "theme_color": "#15130F",
        "icons": [{"src": "/assets/logo/bs-04-favicon.svg", "sizes": "any", "type": "image/svg+xml"}]
    }, indent=2))

if __name__ == '__main__':
    if os.path.isdir(DIST): shutil.rmtree(DIST)
    os.makedirs(DIST)
    build_home(); build_work(); build_capabilities(); build_studio()
    build_journal(); build_enquiries(); build_booking(); build_manage()
    build_404(); build_legal(); build_static()
    n = sum(len(f) for _, _, f in os.walk(DIST))
    print('built %d files into dist/' % n)
