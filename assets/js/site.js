/* =========================================================================
   be stories. — site behaviour
   Nothing animates without a reason. Everything obeys prefers-reduced-motion.
   Every control is semantic, keyboard reachable, and fails loudly not silently.
   ========================================================================= */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'request_failed'); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  function notice(el, html, bad) {
    if (!el) return;
    el.hidden = false;
    el.classList.toggle('notice--bad', !!bad);
    el.innerHTML = html;
    el.focus();
  }

  /* ------------------------------------------------------------ validation */
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
  var URLISH = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/;

  function setError(control, message) {
    var wrap = control.closest('.field');
    var err = wrap ? qs('.err', wrap) : null;
    if (wrap) wrap.dataset.invalid = message ? 'true' : 'false';
    control.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (err) { err.textContent = message || ''; err.hidden = !message; }
  }

  function checkControl(c) {
    var v = (c.value || '').trim();
    if (c.hasAttribute('required') && !v) return 'Required';
    if (!v) return '';
    if (c.type === 'email' && !EMAIL.test(v)) return 'Enter a valid work email address';
    if (c.type === 'url' && !URLISH.test(v)) return 'Enter a valid web address';
    return '';
  }

  function validate(form) {
    var first = null;
    qsa('input, textarea, select', form).forEach(function (c) {
      if (c.type === 'hidden') return;
      var msg = checkControl(c);
      setError(c, msg);
      if (msg && !first) first = c;
    });
    if (first) first.focus();
    return !first;
  }

  qsa('form[data-validate]').forEach(function (form) {
    form.addEventListener('input', function (e) {
      var c = e.target;
      if (!c.matches || !c.matches('input, textarea, select')) return;
      var wrap = c.closest('.field');
      if (wrap && wrap.dataset.invalid === 'true' && !checkControl(c)) setError(c, '');
    });
    form.addEventListener('blur', function (e) {
      var c = e.target;
      if (c.matches && c.matches('input, textarea, select') && (c.value || '').trim()) {
        setError(c, checkControl(c));
      }
    }, true);
  });

  /* --------------------------------------------- engagement preselection */
  (function () {
    var want = (new URLSearchParams(location.search).get('engagement') || '').toLowerCase();
    var map = { commission: 'The Commission', partnership: 'The Partnership', house: 'The House' };
    var label = map[want];
    if (!label) return;
    qsa('select[name="engagement"]').forEach(function (sel) {
      Array.prototype.forEach.call(sel.options, function (o) {
        if (o.text === label) sel.value = o.value || o.text;
      });
    });
  })();

  /* ---------------------------------------------------------- masthead */
  var mast = qs('.masthead');
  if (mast) {
    var settle = function () { mast.classList.toggle('settled', window.scrollY > 24); };
    settle();
    window.addEventListener('scroll', settle, { passive: true });
  }

  /* ------------------------------------------------------------ drawer */
  var burger = qs('.burger'), drawer = qs('.drawer');
  if (burger && drawer) {
    var lastFocus = null;
    var setDrawer = function (open) {
      drawer.dataset.open = open ? 'true' : 'false';
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) { lastFocus = document.activeElement; var f = qs('a', drawer); if (f) f.focus(); }
      else if (lastFocus) { lastFocus.focus(); lastFocus = null; }
    };
    burger.addEventListener('click', function () { setDrawer(drawer.dataset.open !== 'true'); });
    drawer.addEventListener('click', function (e) { if (e.target.tagName === 'A') setDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (drawer.dataset.open !== 'true') return;
      if (e.key === 'Escape') { setDrawer(false); return; }
      if (e.key !== 'Tab') return;
      var items = qsa('a, button', drawer);
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    /* returning via browser back must not restore an open drawer */
    window.addEventListener('pageshow', function () {
      drawer.dataset.open = 'false';
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  }

  /* ------------------------------------------------------------ reveal */
  var rv = qsa('.rv');
  if (!('IntersectionObserver' in window) || reduced) {
    rv.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = parseInt(en.target.dataset.d || '0', 10);
        setTimeout(function () { en.target.classList.add('in'); }, d);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
    rv.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------------------- logo ident
     Motion only. Manual timings: extend 670, hold 430, absorb 960,
     point 190 after a 50ms rest. Always resolves to the static mark.       */
  function runIdent(scope) {
    var bar = qs('.ident-bar', scope), pt = qs('.ident-pt', scope);
    if (!bar || !pt) return;
    var x0 = +bar.dataset.x0, len = +bar.dataset.len;
    var set = function (x, w) { bar.setAttribute('x', x); bar.setAttribute('width', w); };
    var t0 = performance.now(), EX = 670, HOLD = 430, AB = 960, REST = 50, PT = 190;
    var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    pt.style.opacity = '0'; set(x0, 0);
    (function step(now) {
      var t = now - t0;
      if (t < EX) set(x0, len * ease(t / EX));
      else if (t < EX + HOLD) set(x0, len);
      else if (t < EX + HOLD + AB) {
        var k = ease((t - EX - HOLD) / AB);
        set(x0 + len * k, len * (1 - k));
      } else {
        set(x0 + len, 0);
        var o = Math.min(1, Math.max(0, (t - EX - HOLD - AB - REST) / PT));
        pt.style.opacity = String(o);
        if (o >= 1) return;
      }
      requestAnimationFrame(step);
    })(performance.now());
  }

  var navIdent = qs('.masthead [data-ident]');
  if (navIdent && !reduced && !sessionStorage.getItem('bs-ident')) {
    sessionStorage.setItem('bs-ident', '1');
    runIdent(navIdent);
  }

  /* --------------------------------------------------------- enquiries */
  var enq = qs('[data-enquiry]');
  if (enq) {
    enq.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = qs('.notice', enq), btn = qs('.submit', enq);
      if (!validate(enq)) {
        notice(out, 'Some details are missing. The fields are marked above.', true);
        return;
      }
      var data = Object.fromEntries(new FormData(enq).entries());
      btn.disabled = true; btn.textContent = 'Sending';
      postJSON('/api/enquiry', data).then(function () {
        qsa('.field, .submit, .formnote', enq).forEach(function (n) { n.style.display = 'none'; });
        notice(out, '<strong>Thank you.</strong> Your enquiry has reached the studio. ' +
          'We reply to everything we can help with.');
      }).catch(function () {
        btn.disabled = false;
        btn.innerHTML = 'Send enquiry<span class="arw" aria-hidden="true">&rarr;</span>';
        notice(out, 'The studio inbox could not be reached, so nothing was sent. Please write to ' +
          '<a class="link" href="mailto:enquiries@bestories.co.uk">enquiries@bestories.co.uk</a> ' +
          'and we will pick it up from there.', true);
      });
    });
  }

  /* ----------------------------------------------------------- booking */
  var book = qs('[data-booking]');
  if (book) initBooking(book);

  function initBooking(root) {
    var mode = root.dataset.mode || 'book';
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
    var tzEl = qs('[data-tz]', root); if (tzEl) tzEl.textContent = tz;
    var grid = qs('.cal__grid', root), label = qs('[data-month]', root);
    var slotsEl = qs('[data-slots]', root), slotsNote = qs('[data-slots-note]', root);
    var summary = qs('[data-summary]', root), form = qs('form', root);
    var out = qs('.notice', root), ui = qs('[data-bookui]', root);
    var hiddenStart = qs('input[name="start"]', root), hiddenTz = qs('input[name="timezone"]', root);
    if (hiddenTz) hiddenTz.value = tz;

    var params = new URLSearchParams(location.search);
    var eventId = params.get('e'), token = params.get('t');
    var view = new Date(); view.setDate(1);
    var chosenDay = null, chosenSlot = null, cache = {};

    var iso = function (d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    };
    var pretty = function (s) {
      var d = new Date(s);
      return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) +
        ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    if (mode === 'reschedule') {
      var appt = qs('[data-appt]', root);
      if (!eventId || !token) {
        appt.innerHTML = '<span class="meta">This link is incomplete</span>';
        notice(out, 'Open the link from your calendar invitation, or write to ' +
          '<a class="link" href="mailto:enquiries@bestories.co.uk">enquiries@bestories.co.uk</a>.', true);
        return;
      }
      fetch('/api/manage?e=' + encodeURIComponent(eventId) + '&t=' + encodeURIComponent(token))
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (j) {
          appt.innerHTML = '<dl><div><dt>Conversation</dt><dd>' + j.summary + '</dd></div>' +
            '<div><dt>Currently</dt><dd>' + pretty(j.start) + '</dd></div>' +
            '<div><dt>Duration</dt><dd>30 minutes</dd></div>' +
            (j.meet ? '<div><dt>Meet</dt><dd><a class="link" href="' + j.meet + '">Join link</a></dd></div>' : '') +
            '</dl>';
          ui.hidden = false;
          loadMonth();
        })
        .catch(function () {
          appt.innerHTML = '<span class="meta">Booking not found</span>';
          notice(out, 'That booking could not be found \u2014 it may already have been cancelled. Write to ' +
            '<a class="link" href="mailto:enquiries@bestories.co.uk">enquiries@bestories.co.uk</a> for help.', true);
        });

      var cancelBtn = qs('[data-cancel]', root);
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          if (!window.confirm('Cancel this conversation? This cannot be undone.')) return;
          cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelling';
          postJSON('/api/cancel', { e: eventId, t: token }).then(function () {
            ui.style.display = 'none';
            notice(out, '<strong>Cancelled.</strong> The invitation has been withdrawn from both ' +
              'calendars. You are welcome to <a class="link" href="/booking/">book another time</a>.');
          }).catch(function () {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = 'Cancel this conversation<span class="arw" aria-hidden="true">&rarr;</span>';
            notice(out, 'The cancellation did not go through. Please write to ' +
              '<a class="link" href="mailto:enquiries@bestories.co.uk">enquiries@bestories.co.uk</a>.', true);
          });
        });
      }
    }

    function loadMonth() {
      var key = view.getFullYear() + '-' + (view.getMonth() + 1);
      if (cache[key]) { paint(cache[key]); return; }
      fetch('/api/availability?month=' + key + '&tz=' + encodeURIComponent(tz))
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (j) { cache[key] = j; paint(j); })
        .catch(function () { paint(null); });
    }

    function paint(data) {
      label.textContent = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      grid.innerHTML = '';
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (d) {
        var h = document.createElement('div'); h.className = 'cal__dow';
        h.textContent = d; h.setAttribute('aria-hidden', 'true'); grid.appendChild(h);
      });
      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var lead = (first.getDay() + 6) % 7;
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var i = 0; i < lead; i++) grid.appendChild(document.createElement('div'));
      for (var d = 1; d <= days; d++) {
        var date = new Date(view.getFullYear(), view.getMonth(), d);
        var k = iso(date);
        var open = !!(data && data.days && data.days[k] && data.days[k].length);
        var cell = document.createElement('button');
        cell.type = 'button'; cell.className = 'cal__day'; cell.textContent = d;
        cell.dataset.date = k;
        cell.dataset.state = open ? 'open' : 'off';
        cell.disabled = !open;
        cell.setAttribute('aria-label', date.toLocaleDateString('en-GB',
          { weekday: 'long', day: 'numeric', month: 'long' }) +
          (open ? ', times available' : ', unavailable'));
        cell.setAttribute('aria-selected', chosenDay === k ? 'true' : 'false');
        cell.addEventListener('click', function () { pick(this.dataset.date, data); });
        grid.appendChild(cell);
      }
      if (!data) {
        slotsNote.textContent = 'Live availability is not connected yet, so nothing can be booked from ' +
          'this page. Please write to the studio instead.';
      }
    }

    function pick(k, data) {
      chosenDay = k; chosenSlot = null;
      if (hiddenStart) hiddenStart.value = '';
      qsa('.cal__day', grid).forEach(function (c) {
        c.setAttribute('aria-selected', c.dataset.date === k ? 'true' : 'false');
      });
      var times = (data && data.days && data.days[k]) || [];
      slotsEl.innerHTML = '';
      slotsNote.textContent = times.length ? 'Times shown in your timezone.' : 'No remaining times this day.';
      times.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'slot'; b.setAttribute('aria-pressed', 'false');
        b.textContent = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        b.dataset.start = t;
        b.addEventListener('click', function () {
          chosenSlot = this.dataset.start;
          qsa('.slot', slotsEl).forEach(function (s) {
            s.setAttribute('aria-pressed', s === b ? 'true' : 'false');
          });
          if (hiddenStart) hiddenStart.value = chosenSlot;
          renderSummary();
        });
        slotsEl.appendChild(b);
      });
      renderSummary();
    }

    function renderSummary() {
      if (!summary) return;
      summary.innerHTML = chosenSlot
        ? '<span class="meta meta--amber">Selected</span><span>' + pretty(chosenSlot) +
          ' &middot; 30 minutes</span>'
        : '<span class="meta">No time selected</span>';
    }

    qs('[data-prev]', root).addEventListener('click', function () {
      view.setMonth(view.getMonth() - 1); loadMonth();
    });
    qs('[data-next]', root).addEventListener('click', function () {
      view.setMonth(view.getMonth() + 1); loadMonth();
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = qs('.submit', form);
        if (!chosenSlot) {
          notice(out, 'Please choose a date and time before confirming.', true);
          var firstDay = qs('.cal__day[data-state="open"]', grid); if (firstDay) firstDay.focus();
          return;
        }
        if (form.hasAttribute('data-validate') && !validate(form)) {
          notice(out, 'Some details are missing. The fields are marked above.', true);
          return;
        }
        var payload = Object.fromEntries(new FormData(form).entries());
        var wasLabel = btn.innerHTML;
        btn.disabled = true; btn.textContent = mode === 'book' ? 'Confirming' : 'Rescheduling';

        var req = mode === 'book'
          ? postJSON('/api/book', payload)
          : postJSON('/api/reschedule', { e: eventId, t: token, start: payload.start, timezone: tz });

        req.then(function (j) {
          ui.style.display = 'none';
          if (mode === 'book') {
            notice(out, '<strong>Confirmed.</strong> ' + pretty(payload.start) +
              '. A calendar invitation and Google Meet link are on their way to ' + payload.email + '.' +
              (j.meet ? ' <a class="link" href="' + j.meet + '">Join link</a>' : '') +
              (j.manage ? ' <a class="link" href="' + j.manage + '">Reschedule or cancel</a>' : ''));
          } else {
            notice(out, '<strong>Rescheduled.</strong> Your conversation is now ' +
              pretty(payload.start) + '. Both calendars have been updated.');
          }
        }).catch(function (err) {
          btn.disabled = false; btn.innerHTML = wasLabel;
          if (err.status === 409) {
            notice(out, 'That time was taken while you were filling this in. Nothing has been booked \u2014 ' +
              'please choose another.', true);
            cache = {}; loadMonth();
          } else if (err.status === 503) {
            notice(out, 'The studio calendar is not connected yet, so nothing was booked. Write to ' +
              '<a class="link" href="mailto:enquiries@bestories.co.uk">enquiries@bestories.co.uk</a> ' +
              'and we will confirm by return.', true);
          } else {
            notice(out, 'That did not go through and nothing was booked. Please try again, or write to ' +
              '<a class="link" href="mailto:enquiries@bestories.co.uk">enquiries@bestories.co.uk</a>.', true);
          }
        });
      });
    }

    if (mode === 'book') loadMonth();
  }

  var y = qs('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* ================================================= pacing behaviours */
  var pace = qs('.pace');
  if (pace) {
    var lines = qsa('li', pace);
    if (reduced || !('IntersectionObserver' in window)) {
      lines.forEach(function (l) { l.classList.add('on'); });
    } else {
      new IntersectionObserver(function (en, ob) {
        if (!en[0].isIntersecting) return;
        ob.disconnect();
        lines.forEach(function (l, i) {
          setTimeout(function () { l.classList.add('on'); }, 260 + i * 620);
        });
      }, { threshold: 0.35 }).observe(pace);
    }
  }

  var tk = qs('.takeover');
  if (tk && !reduced) {
    var frame = qs('.frame', tk), identWrap = qs('.takeover__ident', tk), line = qs('.takeover__line', tk);
    var played = false, ticking = false;
    var render = function () {
      ticking = false;
      var box = tk.getBoundingClientRect(), vh = window.innerHeight;
      var span = tk.offsetHeight - vh;
      var p = Math.min(1, Math.max(0, -box.top / span));
      var active = box.top <= 0 && box.bottom >= vh;
      var fill = Math.min(1, p / 0.34);
      frame.style.transform = 'scale(' + (0.86 + 0.14 * fill).toFixed(4) + ')';
      frame.style.opacity = fill.toFixed(3);
      if (p > 0.30) {
        identWrap.style.opacity = '1';
        if (!played) { played = true; runIdent(identWrap); }
      } else { identWrap.style.opacity = '0'; }
      var reveal = Math.min(1, Math.max(0, (p - 0.46) / 0.2));
      line.style.opacity = reveal.toFixed(3);
      line.style.transform = 'translateY(' + (12 - 12 * reveal).toFixed(2) + 'px)';
      document.body.classList.toggle('veiled', active && p > 0.12 && p < 0.94);
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
  }
})();
