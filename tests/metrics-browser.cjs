// Provider contract test with every HTTP request fulfilled locally. No real events are sent.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const SITE = process.env.TEST_PUBLIC_SITE;
const PROVIDER = process.env.TEST_PROVIDER_SCRIPT;
if (!SITE || !PROVIDER) throw new Error('Define TEST_PUBLIC_SITE and TEST_PROVIDER_SCRIPT with local fixture paths.');
const ORIGIN = 'https://converter.example';
const BASE = '/tools/smgp2/';
const mime = name => name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // The provider deliberately ignores automated browsers. Emulate a manual page only
  // inside this fully intercepted contract fixture; no external bot filter is bypassed.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    const ua = navigator.userAgent.replace('Headless', '');
    Object.defineProperty(navigator, 'userAgent', { get: () => ua });
  });
  const requests = [], errors = [], blocked = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== ORIGIN) { blocked.push(req.url()); return route.abort(); }
    if (url.pathname === '/_vercel/insights/script.js')
      return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(PROVIDER, 'utf8') });
    if (url.pathname.startsWith('/_vercel/insights/')) {
      requests.push({ url: url.pathname, method: req.method(), body: req.postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    const relative = url.pathname === BASE ? 'index.html' : url.pathname.slice(BASE.length);
    if (!url.pathname.startsWith(BASE) || !/^[a-zA-Z0-9.-]+$/.test(relative) || !fs.existsSync(path.join(SITE, relative)))
      return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: mime(relative), body: fs.readFileSync(path.join(SITE, relative)) });
  });
  try {
    await page.goto(ORIGIN + BASE + '?file=private-photo.jpg#private-rom.bin');
    await page.waitForFunction(() => window.vai === true);
    await page.waitForTimeout(350);
    assert.equal(requests.length, 1, 'Exactly one canonical pageview');
    assert.equal(requests[0].url, '/_vercel/insights/view');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('smgp2:conversion-completed', { detail: { file: 'private-photo.jpg' } })));
    await page.waitForTimeout(350);
    assert.equal(requests.length, 2, 'One approved conversion event');
    assert.equal(requests[1].url, '/_vercel/insights/event');
    await page.evaluate(() => {
      window.va('event', { name: 'smgp2_conversion_completed', data: { filename: 'private-photo.jpg' } });
      window.va('event', { name: 'private-rom.bin', data: { rom: 'private bytes' } });
    });
    await page.waitForTimeout(350);
    assert.equal(requests.length, 3, 'Unapproved event names dropped');
    for (const request of requests) {
      assert.equal(request.method, 'POST');
      assert.ok(!/private-photo|private-rom|private bytes|filename|file=/.test(request.body));
      const payload = JSON.parse(request.body);
      assert.ok(Object.keys(payload).every(key => ['o', 'sv', 'dp', 'r', 'en'].includes(key)), 'Only reviewed provider fields');
      assert.equal(payload.o, ORIGIN + BASE);
      assert.ok(payload.r === undefined || ['', 'https://flowofdevelopment.com/', 'https://fir-d4471.web.app/'].includes(payload.r));
      if (request.url.endsWith('/event')) {
        assert.equal(payload.en, 'smgp2_conversion_completed');
        assert.equal(payload.ed, undefined);
      }
    }
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    // Saved identity added by a different app must block further provider requests.
    await page.evaluate(() => {
      localStorage.setItem('__va_attribution', JSON.stringify({ userId: 'synthetic-user', traits: { filename: 'private-photo.jpg' } }));
      window.dispatchEvent(new CustomEvent('smgp2:conversion-completed'));
    });
    await page.waitForTimeout(200);
    assert.equal(requests.length, 3, 'Attribution inserted later cannot leak into conversion event');
    await page.reload();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.scripts.length), 6, 'Existing attribution blocks loading provider');
    assert.equal(requests.length, 3);
    await page.evaluate(() => localStorage.removeItem('__va_attribution'));
    await page.goto(ORIGIN + BASE, { referer: 'https://foreign.example/?file=private-rom.bin' });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.scripts.length), 6, 'Foreign referrer blocks loading provider');
    assert.equal(requests.length, 3);
    fs.writeFileSync(path.join(ROOT, 'evidence/metrics-browser.json'), JSON.stringify({ status: 'passed', scope: 'All HTTP intercepted locally; official provider script fixture. No telemetry sent.', requests, errors, blocked }, null, 2));
    console.log('PASS: canonical pageview, conversion allowlist, personal-data stripping, no external requests');
  } catch (error) {
    const state = await page.evaluate(() => ({ url: location.href, config: window.CONVERTER_ANALYTICS_CONFIG,
      vai: window.vai, queueTypes: (window.vaq || []).map(x => x[0]), scripts: Array.from(document.scripts, s => s.src) }));
    console.error(JSON.stringify({ state, requests, errors, blocked }));
    throw error;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
