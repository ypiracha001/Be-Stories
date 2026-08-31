#!/usr/bin/env python3
"""Click-through audit: every href and button in dist/, resolved and checked."""
import os, re, sys, json
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

def routes():
    out = set()
    for base, _, files in os.walk(DIST):
        for f in files:
            if f == 'index.html':
                rel = os.path.relpath(base, DIST).replace(os.sep, '/')
                out.add('/' if rel == '.' else '/' + rel + '/')
            elif f.endswith('.html'):
                rel = os.path.relpath(os.path.join(base, f), DIST).replace(os.sep, '/')
                out.add('/' + rel)
    return out

def assets():
    out = set()
    for base, _, files in os.walk(DIST):
        for f in files:
            rel = os.path.relpath(os.path.join(base, f), DIST).replace(os.sep, '/')
            out.add('/' + rel)
    return out

def main():
    R, A = routes(), assets()
    bad, ext, mailto, anchors, total = [], set(), set(), set(), 0
    ids = {}
    pages = sorted(p for p in R)
    for base, _, files in os.walk(DIST):
        for f in files:
            if not f.endswith('.html'): continue
            path = os.path.join(base, f)
            page = '/' + os.path.relpath(path, DIST).replace(os.sep, '/').replace('index.html', '')
            html = open(path).read()
            ids[page] = set(re.findall(r'\bid="([^"]+)"', html))
            for href in re.findall(r'href="([^"]*)"', html):
                if href.startswith(('https://fonts.', 'data:')): continue
                total += 1
                if href.startswith('mailto:'): mailto.add(href); continue
                if href.startswith('http'): ext.add(href); continue
                if href.startswith('#'):
                    anchors.add((page, href)); continue
                clean = href.split('#')[0].split('?')[0]
                if not clean: continue
                if clean in R or clean in A: continue
                if clean.rstrip('/') + '/' in R: continue
                bad.append((page, href))
            for m in re.finditer(r'<(a|button)\b([^>]*)>', html):
                tag, attrs = m.group(1), m.group(2)
                if tag == 'a' and 'href=' not in attrs:
                    bad.append((page, '<a> with no href'))
                if tag == 'button' and 'type=' not in attrs:
                    bad.append((page, '<button> with no type'))
    # anchors must exist on their page
    for page, href in anchors:
        target = href[1:]
        if target and target not in ids.get(page, set()):
            bad.append((page, href + ' (no such id)'))
    print('routes  : %d' % len(R))
    for r in pages: print('   ', r)
    print('links   : %d checked' % total)
    print('mailto  :', sorted(mailto))
    print('external:', sorted(ext) or '(none)')
    print('BROKEN  : %d' % len(bad))
    for p, h in bad: print('   ', p, '->', h)
    return 1 if bad else 0

sys.exit(main())
