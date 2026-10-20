const test = require('node:test');
const assert = require('node:assert/strict');
const setup = require('./analytics.js');
function fixture(overrides = {}) {
  const scripts = [], events = {};
  const win = {
    location: { protocol: 'https:', origin: 'https://converter.example', pathname: '/tools/smgp2/' },
    CONVERTER_ANALYTICS_CONFIG: { enabled: true, canonicalUrl: 'https://converter.example/tools/smgp2/', customEvents: false },
    document: { createElement: () => ({ setAttribute(k, v) { this[k] = v; } }), head: { appendChild(s) { scripts.push(s); } } },
    localStorage: { getItem: () => null },
    addEventListener(name, fn) { events[name] = fn; }, ...overrides
  };
  return { win, scripts, events };
}
test('offline, unconfigured, foreign hosts and preview paths never initialize metrics', () => {
  for (const change of [
    { CONVERTER_ANALYTICS_CONFIG: undefined },
    { location: { protocol: 'file:' } },
    { location: { protocol: 'http:', origin: 'http://127.0.0.1:8765', pathname: '/tools/smgp2/' } },
    { location: { protocol: 'https:', origin: 'https://preview.example', pathname: '/tools/smgp2/' } },
    { location: { protocol: 'https:', origin: 'https://converter.example', pathname: '/preview/' } }
  ]) {
    const f = fixture(change); assert.equal(setup(f.win), false); assert.equal(f.scripts.length, 0); assert.equal(f.win.va, undefined);
  }
});
test('one canonical pageview; query, hash, input names and event details are excluded', () => {
  const f = fixture(); f.win.location.search = '?nome=foto-pessoal.jpg'; f.win.location.hash = '#rom-privada.bin';
  assert.equal(setup(f.win), true); assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, '/_vercel/insights/script.js'); assert.equal(f.scripts[0]['data-disable-auto-track'], 'true');
  assert.deepEqual(f.win.vaq[1], ['pageview', { path: '/tools/smgp2/', route: '/tools/smgp2/' }]);
  const beforeSend = f.win.vaq[0][1];
  assert.deepEqual(beforeSend({ type: 'pageview', url: 'https://converter.example/?personal=private', fileName: 'segredo.png' }),
    { type: 'pageview', url: 'https://converter.example/tools/smgp2/' });
  assert.equal(beforeSend({ type: 'event', url: 'anything' }), null);
  assert.equal(f.events['smgp2:conversion-completed'], undefined);
});
test('conversion metrics require explicit confirmed custom event configuration', () => {
  const f = fixture(); f.win.CONVERTER_ANALYTICS_CONFIG.customEvents = true;
  assert.equal(setup(f.win), true);
  f.events['smgp2:conversion-completed']({ detail: { name: 'private.png', rom: new Uint8Array([1, 2]) } });
  assert.deepEqual(f.win.vaq[2], ['event', { name: 'smgp2_conversion_completed' }]);
  const filter = f.win.vaq[0][1];
  assert.deepEqual(filter({ type: 'event', url: 'private', payload: { name: 'smgp2_conversion_completed', data: { file: 'private.png' } } }),
    { type: 'event', url: 'https://converter.example/tools/smgp2/', payload: { name: 'smgp2_conversion_completed' } });
  assert.equal(filter({ type: 'event', url: 'private', payload: { name: 'file_private.png' } }), null);
  assert.equal(filter({ type: 'event', url: 'private' }), null);
});
test('provider failure never propagates into the converter', () => {
  const f = fixture({ va() { throw new Error('provider unavailable'); } });
  assert.equal(setup(f.win), false);
});
test('canonical configuration rejects credentials and query parameters', () => {
  for (const url of ['https://person:secret@converter.example/tools/smgp2/', 'https://converter.example/tools/smgp2/?token=secret']) {
    const f = fixture(); f.win.CONVERTER_ANALYTICS_CONFIG.canonicalUrl = url;
    assert.equal(setup(f.win), false); assert.equal(f.scripts.length, 0);
  }
});
test('provider cannot forward foreign referrers or preexisting attribution', () => {
  const foreign = fixture(); foreign.win.document.referrer = 'https://foreign.example/?file=private.png';
  assert.equal(setup(foreign.win), false); assert.equal(foreign.scripts.length, 0);
  const attributed = fixture(); attributed.win.localStorage.getItem = () => '{"userId":"synthetic"}';
  assert.equal(setup(attributed.win), false); assert.equal(attributed.scripts.length, 0);
  const inaccessible = fixture(); inaccessible.win.localStorage.getItem = () => { throw new Error('denied'); };
  assert.equal(setup(inaccessible.win), false);
  const changed = fixture(); changed.win.document.referrer = 'https://flowofdevelopment.com/';
  assert.equal(setup(changed.win), true);
  changed.win.localStorage.getItem = () => '{"userId":"synthetic"}';
  assert.equal(changed.win.vaq[0][1]({ type: 'pageview', url: 'ignored' }), null);
});
