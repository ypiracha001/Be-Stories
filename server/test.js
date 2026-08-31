/* =========================================================================
   be stories. — unit tests
   No dependencies: run with `node --test server/` on Node 24.
   Covers the two modules that decide what reaches Google and the studio inbox.
   ========================================================================= */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const sec = require('./security');
const scopes = require('./scopes');

const FUTURE = () => new Date(Date.now() + 864e5).toISOString();

/* ---- sanitisation ------------------------------------------------------ */
test('clean strips control characters', () => {
  assert.equal(sec.clean('a\u0000b\u0007c', 50), 'abc');
});

test('oneLine removes newlines — mail header injection', () => {
  const evil = 'Acme\r\nBcc: attacker@example.com';
  const out = sec.oneLine(evil, 160);
  assert.ok(!/[\r\n]/.test(out), 'no CR or LF may survive');
  assert.equal(out, 'Acme Bcc: attacker@example.com');
});

test('clean enforces the length cap', () => {
  assert.equal(sec.clean('x'.repeat(9000), 4000).length, 4000);
});

test('escapeHtml neutralises markup for calendar descriptions', () => {
  assert.equal(
    sec.escapeHtml('<a href="x" onclick=\'y\'>hi</a> & co'),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;hi&lt;/a&gt; &amp; co'
  );
});

test('shape discards unexpected fields and non-string types', () => {
  const out = sec.shape(
    { name: 'A', evil: 'drop me', company: { toString: () => 'obj' }, role: ['x'] },
    ['name', 'company', 'role']
  );
  assert.deepEqual(Object.keys(out).sort(), ['company', 'name', 'role']);
  assert.equal(out.company, '');
  assert.equal(out.role, '');
  assert.equal(out.evil, undefined);
});

/* ---- booking validation ------------------------------------------------ */
const goodBooking = () => ({
  name: 'Camille Laurent', email: 'c.laurent@example.com', company: 'Maison',
  summary: 'Launch film for spring.', start: FUTURE(), timezone: 'Europe/London',
});

test('a complete booking validates', () => {
  const { errors } = sec.validateBooking(goodBooking());
  assert.deepEqual(errors, []);
});

test('each required field is enforced', () => {
  for (const f of ['name', 'email', 'company', 'summary', 'start']) {
    const b = goodBooking(); delete b[f];
    const { errors } = sec.validateBooking(b);
    assert.ok(errors.includes('missing_' + f), `expected missing_${f}`);
  }
});

test('malformed email is rejected', () => {
  for (const bad of ['nope', 'a@b', 'a b@c.com', '@example.com', 'a@.com']) {
    const { errors } = sec.validateBooking({ ...goodBooking(), email: bad });
    assert.ok(errors.includes('bad_email'), `should reject ${bad}`);
  }
});

test('unparseable and past start times are rejected', () => {
  assert.ok(sec.validateBooking({ ...goodBooking(), start: 'soon' }).errors.includes('bad_start'));
  assert.ok(sec.validateBooking({ ...goodBooking(), start: '2020-01-01T10:00:00Z' })
    .errors.includes('start_in_past'));
});

test('a hostile timezone is dropped, not passed through', () => {
  const { data } = sec.validateBooking({ ...goodBooking(), timezone: '../../etc/passwd' });
  assert.equal(data.timezone, '');
});

test('injected markup in the summary survives only as escaped text', () => {
  const { data } = sec.validateBooking({
    ...goodBooking(), summary: '<img src=x onerror=alert(1)>',
  });
  assert.ok(!/<img/.test(sec.escapeHtml(data.summary)));
});

/* ---- enquiry validation ------------------------------------------------ */
test('enquiry requires name, email and the brief', () => {
  const { errors } = sec.validateEnquiry({ name: '', email: 'x', working_on: '' });
  assert.ok(errors.includes('missing_name'));
  assert.ok(errors.includes('missing_working_on'));
  assert.ok(errors.includes('bad_email'));
});

test('a complete enquiry validates', () => {
  const { errors } = sec.validateEnquiry({
    name: 'A', email: 'a@example.com', working_on: 'A launch.',
  });
  assert.deepEqual(errors, []);
});

/* ---- transport guards -------------------------------------------------- */
function fakeRes() {
  return {
    code: null, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('non-JSON content types are refused', () => {
  const res = fakeRes(); let passed = false;
  sec.enforceJson({ headers: { 'content-type': 'application/x-www-form-urlencoded' } },
    res, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(res.code, 415);
});

test('JSON content type passes', () => {
  let passed = false;
  sec.enforceJson({ headers: { 'content-type': 'application/json; charset=utf-8' } },
    fakeRes(), () => { passed = true; });
  assert.equal(passed, true);
});

test('a foreign Origin is refused, the real one passes, absent passes', () => {
  const guard = sec.sameOrigin(['https://bestories.co.uk']);
  const res = fakeRes(); let passed = false;
  guard({ headers: { origin: 'https://evil.example' } }, res, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(res.code, 403);

  passed = false;
  guard({ headers: { origin: 'https://bestories.co.uk' } }, fakeRes(), () => { passed = true; });
  assert.equal(passed, true);

  passed = false;
  guard({ headers: {} }, fakeRes(), () => { passed = true; });
  assert.equal(passed, true, 'same-origin fetch may omit Origin');
});

/* ---- headers ----------------------------------------------------------- */
test('security headers are set and CSP forbids inline script', () => {
  const res = fakeRes();
  sec.headers({ dist: __dirname })({ path: '/' }, res, () => {});
  const csp = res.headers['Content-Security-Policy'];
  assert.ok(/script-src 'self'/.test(csp));
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'script-src must not allow inline');
  assert.ok(/frame-ancestors 'none'/.test(csp));
  assert.ok(/object-src 'none'/.test(csp));
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.ok(res.headers['Strict-Transport-Security'].includes('max-age=63072000'));
});

/* ---- scopes ------------------------------------------------------------ */
test('the default scope set can do both jobs and is not overbroad', () => {
  const a = scopes.audit(scopes.DEFAULT_SCOPES);
  assert.equal(a.events, true);
  assert.equal(a.freebusy, true);
  assert.deepEqual(a.overbroad, []);
  assert.equal(scopes.DEFAULT_SCOPES.length, 2);
});

test('calendar.events alone does NOT satisfy freebusy', () => {
  const a = scopes.audit(['https://www.googleapis.com/auth/calendar.events']);
  assert.equal(a.events, true);
  assert.equal(a.freebusy, false);
});

test('full calendar scope is flagged as overbroad', () => {
  const a = scopes.audit(['https://www.googleapis.com/auth/calendar']);
  assert.ok(a.overbroad.length > 0);
});

test('calendar.events.freebusy is accepted for shared calendars', () => {
  const a = scopes.audit([
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.events.freebusy',
  ]);
  assert.equal(a.freebusy, true);
  assert.deepEqual(a.overbroad, []);
});
