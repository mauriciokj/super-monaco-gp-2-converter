// Local test only. ROM stays outside the served directory and is never uploaded.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'evidence');
const ROM = process.env.TEST_ROM;
if (!ROM) throw new Error('Defina TEST_ROM com o caminho externo da sua ROM Grid 2026 v3.3. Nenhuma ROM acompanha os testes.');
const core = require('../personalizador-local/core.js');
const spec = require('../personalizador-local/spec.js');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const observations = [];
function record(name, details = {}) { observations.push({ name, pass: true, ...details }); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, acceptDownloads: true });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  async function ready(key, value = true) {
    await page.waitForFunction(([key, value]) => window.renderCustomizerState()[key] === value, [key, value]);
  }
  async function file(locator, name, buffer, mimeType = 'application/octet-stream') {
    await page.locator(locator).setInputFiles({ name, mimeType, buffer });
  }
  async function slider(selector, value) {
    await page.locator(selector).evaluate((node, value) => { node.value = String(value); node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await ready('previewReady');
  }
  try {
    await page.goto('http://127.0.0.1:8765');
    await page.waitForFunction(() => typeof window.renderCustomizerState === 'function');
    assert.equal(await page.locator('#buildButton').isDisabled(), true);
    await page.screenshot({ path: path.join(OUT, 'ui-initial.png'), fullPage: true });
    record('Initial state blocks export');
    await file('#romFile', 'invalida.bin', Buffer.from('not a ROM'));
    await page.waitForFunction(() => document.querySelector('#romStatus').textContent.includes('Tamanho incorreto'));
    record('Wrong ROM length rejected');
    const baseline = fs.readFileSync(ROM);
    assert.equal(hash(baseline), spec.baseline.sha256);
    const corrupted = Buffer.from(baseline); corrupted[0x50000] ^= 1;
    await file('#romFile', 'alterada.bin', corrupted);
    await page.waitForFunction(() => document.querySelector('#romStatus').textContent.includes('SHA-256 diferente'));
    await ready('romReady', false);
    record('Same-size incompatible ROM rejected by SHA-256');
    await file('#romFile', 'nao-intercalada.smd', baseline);
    await page.waitForFunction(() => document.querySelector('#romStatus').textContent.includes('Formato recusado'));
    record('SMD rejected explicitly');
    await page.locator('#romFile').setInputFiles(ROM);
    await ready('romReady'); await ready('baselineVisible');
    record('Verified v3.3 accepted and helmet preview decoded');

    const synthetic = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 112;
      const ctx = c.getContext('2d');
      for (let y = 0; y < 112; y++) for (let x = 0; x < 160; x++) {
        ctx.fillStyle = `rgb(${Math.floor(x * 255 / 159)},${Math.floor(y * 255 / 111)},${(x ^ y) * 3 % 256})`;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = '#fff'; ctx.fillRect(55, 28, 24, 24);
      ctx.fillStyle = '#111'; ctx.fillRect(85, 62, 20, 20);
      return c.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(path.join(OUT, 'synthetic-input.png'), Buffer.from(synthetic, 'base64'));
    await file('#photoFile', 'padrao-sintetico.png', Buffer.from(synthetic, 'base64'), 'image/png');
    await ready('previewReady');
    assert.equal(await page.locator('#buildButton').isDisabled(), true);
    record('Synthetic image import and quantized preview; target confirmation required');
    await slider('#zoom', 1.45); await slider('#positionX', 37); await slider('#positionY', 64);
    await page.locator('#confirmTarget').check(); await ready('canBuild');
    await page.locator('#buildButton').click(); await ready('downloadReady');
    await page.screenshot({ path: path.join(OUT, 'ui-ready-desktop.png'), fullPage: true });
    await page.locator('#previewCanvas').screenshot({ path: path.join(OUT, 'synthetic-preview.png') });
    const pixels = await page.locator('#previewCanvas').evaluate(canvas => Array.from(canvas.getContext('2d').getImageData(0, 0, 64, 64).data));
    fs.writeFileSync(path.join(OUT, 'synthetic-preview-rgba.json'), JSON.stringify(pixels));
    const downloadWait = page.waitForEvent('download');
    await page.locator('#downloadRom').click();
    const download = await downloadWait;
    const outputPath = path.join(OUT, 'synthetic-QA-only.bin');
    await download.saveAs(outputPath);
    const output = fs.readFileSync(outputPath);
    assert.equal(output.length, baseline.length);
    assert.equal(output.readUInt16BE(0x18e), core.checksumGenesis(output));
    const changes = [];
    for (let i = 0; i < output.length; i++) if (output[i] !== baseline[i]) {
      assert.ok(spec.allowedRanges.some(r => r.start <= i && i < r.end), 'Diff outside allowlist ' + i.toString(16));
      changes.push(i);
    }
    assert.equal(output.readUInt32BE(0x7c6a0), baseline.readUInt32BE(0x7c6a0));
    assert.deepEqual(output.subarray(0x7c950, 0x7c96a), baseline.subarray(0x7c950, 0x7c96a));
    assert.deepEqual(output.subarray(0x7fd44, 0x801b3), baseline.subarray(0x7fd44, 0x801b3));
    const restored = Buffer.from(output);
    for (const i of changes) restored[i] = baseline[i];
    assert.deepEqual(restored, baseline);
    record('ROM downloaded with correct size/checksum, restricted full diff, unchanged original resources and exact reversal', {
      size: output.length, sha256: hash(output), checksum: output.readUInt16BE(0x18e).toString(16), changedBytes: changes.length,
      allowedRanges: spec.allowedRanges
    });
    const reportWait = page.waitForEvent('download'); await page.locator('#downloadReport').click();
    const reportDownload = await reportWait; await reportDownload.saveAs(path.join(OUT, 'browser-download-report.json'));
    record('Validation JSON downloaded');
    await page.locator('#buildButton').click(); await ready('downloadReady');
    const againWait = page.waitForEvent('download'); await page.locator('#downloadRom').click();
    const again = await againWait;
    const againPath = path.join(OUT, 'repeat-QA-only.bin'); await again.saveAs(againPath);
    assert.equal(hash(fs.readFileSync(againPath)), hash(output));
    record('Repeated build produces identical ROM SHA-256');
    await slider('#zoom', 2);
    await ready('downloadReady', false);
    await page.locator('#confirmTarget').uncheck(); await ready('canBuild', false);
    record('Crop and target changes invalidate previous download');
    await page.locator('#demoButton').click(); await ready('previewReady');
    record('Browser-generated demo works');
    await file('#photoFile', 'falsa.png', Buffer.from('not an image'), 'image/png');
    await page.waitForFunction(() => document.querySelector('#photoStatus').textContent.includes('não é PNG'));
    await ready('previewReady', false); record('Invalid image rejected and preview cleared');
    assert.equal(await page.locator('#paletteSwatches').locator('.swatch').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(OUT, 'ui-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    record('Mobile 390px layout has no horizontal overflow');
    // Same production files opened directly: no server required for the user.
    await page.goto('file://' + path.join(ROOT, 'personalizador-local/index.html'));
    await page.waitForFunction(() => typeof window.renderCustomizerState === 'function');
    await page.locator('#romFile').setInputFiles(ROM); await ready('romReady');
    await page.locator('#demoButton').click(); await ready('previewReady');
    await page.locator('#confirmTarget').check(); await page.locator('#buildButton').click(); await ready('downloadReady');
    record('file:// entry opens, validates and builds offline');
    const external = requests.filter(r => /^https?:/.test(r.url) && !r.url.startsWith('http://127.0.0.1:8765/'));
    assert.deepEqual(external, []); assert.equal(requests.some(r => r.method !== 'GET'), false);
    assert.deepEqual(errors, []);
    record('No external requests, upload methods, or browser errors', { requestCount: requests.length });
    fs.writeFileSync(path.join(OUT, 'browser-tests.json'), JSON.stringify({ status: 'passed', browser: browser.version(), observations, requests, errors }, null, 2));
    console.log(JSON.stringify({ status: 'passed', checks: observations.length, outputSha256: hash(output) }));
  } catch (error) {
    fs.writeFileSync(path.join(OUT, 'browser-tests-failure.json'), JSON.stringify({ error: String(error), stack: error.stack, observations, requests, errors }, null, 2));
    await page.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
