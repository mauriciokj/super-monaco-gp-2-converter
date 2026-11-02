// Full local-file workflow against loopback or this project's verified deployment URL.
// File inputs are read by the browser. Any unexpected upload request is blocked.
'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto');
const core = require('../personalizador-local/core.js'), versions = require('../personalizador-local/versions.js');
const APP = new URL(process.env.TEST_APP_URL || 'http://127.0.0.1:8765/');
assert.ok((APP.protocol === 'http:' && APP.hostname === '127.0.0.1') ||
  (APP.protocol === 'https:' && /^super-monaco-gp-2-converter(?:-[a-z0-9-]+)?\.vercel\.app$/.test(APP.hostname)));
assert.equal(APP.username + APP.password + APP.search, '', 'No credentials/query in the test URL');
const OUT = path.resolve(process.env.TEST_OUTPUT || 'evidence/versions-local');
const ROM = process.env.TEST_ROM;
assert.ok(ROM && process.env.TEST_BASELINE_ROM && process.env.TEST_PTBR_ROM, 'Three private reference paths required');
const refs = {v33: fs.readFileSync(process.env.TEST_BASELINE_ROM), ptbr: fs.readFileSync(process.env.TEST_PTBR_ROM)};
const original = fs.readFileSync(ROM), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const before = sha(original), checks = [], uploads = [], errors = [], requests = [];
const record = (name, details = {}) => checks.push({name, pass: true, ...details});
(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({viewport: {width: 1365, height: 1000}, acceptDownloads: true});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  // There is no API for conversion. Keep this guard in place on production as well.
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    requests.push({method: req.method(), path: url.origin + url.pathname});
    if (!['GET', 'HEAD'].includes(req.method())) {
      const body = req.postData() || '';
      const metrics = url.origin === APP.origin && url.pathname.startsWith('/_vercel/insights/') && body.length < 4096;
      if (!metrics) { uploads.push({method: req.method(), path: url.origin + url.pathname}); return route.abort(); }
      // Only the existing canonical pageview is permitted; no user payload fields.
      assert.ok(!/filename|romHash|sourceSha256|imageName|data:image|application\/octet-stream/i.test(body));
    }
    return route.continue();
  });
  const state = (key, value = true) => page.waitForFunction(([k, v]) => window.renderCustomizerState()[k] === v, [key, value]);
  async function download(id, name) {
    const wait = page.waitForEvent('download'); await page.locator(id).click();
    const d = await wait; await d.saveAs(path.join(OUT, name));
    return {bytes: fs.readFileSync(path.join(OUT, name)), name: d.suggestedFilename()};
  }
  try {
    const response = await page.goto(APP.href);
    assert.equal(response.status(), 200, 'Deployment must be directly accessible for the full browser test');
    await page.waitForFunction(() => typeof window.renderCustomizerState === 'function');
    assert.equal(await page.locator('#versionSelect').inputValue(), 'ptbr');
    assert.deepEqual(await page.locator('#versionSelect option').evaluateAll(nodes => nodes.map(n => n.value)), ['ptbr', 'v33']);
    record('Two editions, PT-BR selected by default');
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.fillStyle = '#21445b'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#e6ba9a'; x.fillRect(34, 20, 60, 76);
      x.fillStyle = '#201e2b'; x.fillRect(34, 20, 60, 16); x.fillRect(44, 47, 8, 7); x.fillRect(77, 47, 8, 7);
      x.fillStyle = '#64c5b1'; x.fillRect(26, 98, 76, 30);
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#photoFile').setInputFiles({name: 'synthetic-portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64')});
    await state('previewReady');
    await page.locator('#romFile').setInputFiles(ROM);
    for (const id of ['ptbr', 'v33', 'ptbr']) {
      const release = versions.get(id), expected = refs[id];
      if ((await page.locator('#versionSelect').inputValue()) !== id) {
        await page.locator('#versionSelect').selectOption(id);
        assert.equal(await page.locator('#downloadArea').isVisible(), false);
        assert.equal(await page.locator('#downloadRom').getAttribute('href'), null);
        assert.equal(await page.locator('#confirmTarget').isChecked(), false);
      }
      await state('romReady'); await state('baselineSha256', sha(expected));
      assert.equal(await page.locator('#buildButton').isDisabled(), true);
      await page.locator('#confirmTarget').check();
      await page.locator('#buildButton').click(); await state('downloadReady');
      const result = await download('#downloadRom', id + '-portrait-QA-only.bin');
      assert.ok(result.name.includes(release.suffix));
      const out = result.bytes, reverted = Buffer.from(out);
      assert.equal(out.length, expected.length);
      assert.equal(out.readUInt16BE(398), core.checksumGenesis(out));
      let changed = 0;
      for (let i = 0; i < out.length; i++) if (out[i] !== expected[i]) {
        assert.ok(release.spec.allowedRanges.some(r => i >= r.start && i < r.end), 'Outside portrait range: ' + i.toString(16));
        reverted[i] = expected[i]; changed++;
      }
      assert.deepEqual(reverted, expected);
      assert.deepEqual(out.subarray(0xf8000, 0x100000), expected.subarray(0xf8000, 0x100000));
      assert.deepEqual(out.subarray(0x170000), expected.subarray(0x170000));
      const report = JSON.parse((await download('#downloadReport', id + '-report.json')).bytes);
      assert.equal(report.releaseId, id); assert.equal(report.baseline.sha256, sha(expected));
      assert.equal(report.output.sha256, sha(out)); assert.equal(report.target.slot, 11);
      await page.screenshot({path: path.join(OUT, id + '-desktop.png'), fullPage: true});
      record('Original → ' + id + ' → customized download, exact reversal and protected audio/Kimi', {baseline: sha(expected), output: sha(out), changedBytes: changed});
    }
    // Rapid selection while the local file read is pending must resolve to the last choice.
    await page.evaluate(() => { const s = document.getElementById('versionSelect'); for (const id of ['v33', 'ptbr', 'v33']) {s.value = id; s.dispatchEvent(new Event('change'));} });
    await state('romReady'); await state('baselineSha256', sha(refs.v33));
    await state('releaseId', 'v33'); await state('downloadReady', false);
    record('Rapid version changes invalidate pending reads and revoke stale downloads');
    await page.locator('#versionSelect').selectOption('ptbr'); await state('romReady');
    await page.locator('#romFile').setInputFiles({name: 'v33.bin', mimeType: 'application/octet-stream', buffer: refs.v33});
    await state('romReady'); await state('sourceKind', 'v33'); await state('baselineSha256', sha(refs.ptbr));
    record('Advanced verified v3.3 updates to PT-BR');
    await page.locator('#romFile').setInputFiles({name: 'ptbr.bin', mimeType: 'application/octet-stream', buffer: refs.ptbr});
    await state('romReady'); await state('sourceKind', 'baseline');
    await page.locator('#versionSelect').selectOption('v33');
    await page.waitForFunction(() => document.querySelector('#romStatus').classList.contains('error'));
    await state('canBuild', false);
    record('PT-BR baseline cannot silently masquerade as v3.3');
    await page.locator('#versionSelect').selectOption('ptbr'); await state('romReady');
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height: 844});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({path: path.join(OUT, 'ptbr-mobile-' + width + '.png'), fullPage: true});
    }
    record('Mobile 390px and 320px without horizontal overflow');
    assert.deepEqual(uploads, []); assert.deepEqual(errors, []); assert.equal(sha(fs.readFileSync(ROM)), before);
    record('No conversion uploads, no browser errors, original file unchanged');
    const result = {status: 'passed', app: APP.origin, browser: browser.version(), checks, uploads, errors, requests};
    fs.writeFileSync(path.join(OUT, 'verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({status: 'passed', checks: checks.length, app: APP.origin}));
  } catch (e) {
    fs.writeFileSync(path.join(OUT, 'failure.json'), JSON.stringify({error: String(e), checks, uploads, errors, requests}, null, 2));
    await page.screenshot({path: path.join(OUT, 'failure.png'), fullPage: true}); throw e;
  } finally {await browser.close();}
})().catch(e => {console.error(e); process.exitCode = 1;});
