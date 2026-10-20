// UI control-flow tests use synthetic bytes and explicit validation doubles.
// Real IPS/hash/checksum validation is covered independently by pipeline.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const spec = require('./spec.js');
const source = fs.readFileSync(require.resolve('./app.js'), 'utf8');

function fixture(kind) {
  const sizes = { original: 1048576, baseline: 2097152, patch: 131783, invalidPatch: 131783, invalidRom: 1048576 };
  const bytes = new Uint8Array(sizes[kind]);
  if (kind === 'invalidPatch' || kind === 'invalidRom') bytes[0] = 255;
  return { name: kind + (kind.toLowerCase().includes('patch') ? '.ips' : '.bin'), size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer };
}

function harness({ privatePackage = false, failBuild = false, failBlob = false } = {}) {
  const elements = new Map(), events = [], calls = { compose: 0, baseline: 0, parse: 0, build: 0 };
  const context2d = { clearRect() {}, putImageData() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }) };
  function element() {
    return { hidden: false, checked: false, value: '', disabled: false, textContent: '', children: [], style: {},
      listeners: {}, classList: { add() {}, remove() {} },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      removeAttribute(name) { delete this[name]; },
      replaceChildren() { this.children = []; }, append(...children) { this.children.push(...children); },
      getContext: () => context2d };
  }
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: () => element() };
  const $ = id => document.getElementById(id);
  $('downloadArea').hidden = true; $('zoom').value = '1'; $('positionX').value = $('positionY').value = '50';
  const sha256 = data => data[0] === 255 ? '0'.repeat(64)
    : data.length === 1048576 ? spec.composition.original.sha256
      : data.length === 131783 ? spec.composition.patch.sha256 : spec.baseline.sha256;
  const window = { PORTRAIT_SPEC: spec,
    RomCustomizer: { sha256, cramRgb: () => [0, 0, 0], decodeKosinski: () => ({ data: new Uint8Array(2048) }),
      convertRgba64: () => ({ previewRgba: new Uint8Array(16384), paletteWords: new Array(13).fill(0) }),
      buildPatch: () => { calls.build++; if (failBuild) throw new Error('validation rejected');
        return { rom: new Uint8Array(2097152), sha256: 'test-output', checksum: 1, compressedBytes: 1, changedOffsets: [1000] }; } },
    Grid2026Pipeline: {
      parseIps() { calls.parse++; },
      compose2026() { calls.compose++; return { rom: baseline(), sha256: spec.baseline.sha256, patchSha256: spec.composition.patch.sha256 }; },
      validateBaseline() { calls.baseline++; return { rom: baseline(), sha256: spec.baseline.sha256 }; }
    }, addEventListener() {}, dispatchEvent(event) { events.push(event); } };
  function baseline() {
    const bytes = new Uint8Array(2097152), offset = spec.portraitPointerOffset;
    for (const [at, value] of [[offset + 4, spec.expectedPalettePointer], [offset + 8, spec.expectedGraphicsPointer]]) {
      bytes[at] = value >>> 24; bytes[at + 1] = value >>> 16 & 255; bytes[at + 2] = value >>> 8 & 255; bytes[at + 3] = value & 255;
    }
    return bytes;
  }
  if (privatePackage) window.LOCAL_GRID2026_PATCH = { base64: 'synthetic-unit-fixture',
    size: spec.composition.patch.size, sha256: spec.composition.patch.sha256 };
  let urls = 0;
  vm.runInNewContext(source, { window, document, Uint8Array, Uint8ClampedArray, ImageData: class {},
    CustomEvent: class { constructor(type) { this.type = type; this.detail = null; } },
    Blob: class { constructor() { if (failBlob) throw new Error('blob creation rejected'); } },
    URL: { createObjectURL: () => 'blob:test-' + ++urls, revokeObjectURL() {} },
    atob: () => '\0'.repeat(131783), setTimeout, clearTimeout });
  return { $, calls, events, state: () => window.renderCustomizerState(),
    choose(id, file) { $(id).listeners.change({ target: { files: [file], value: '' } }); },
    click(id) { return $(id).listeners.click(); },
    confirm(value) { $('confirmTarget').checked = value; $('confirmTarget').listeners.change(); },
    adjust() { $('zoom').value = '1.2'; $('zoom').listeners.input(); } };
}

async function until(check) {
  for (let i = 0; i < 200; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('UI state did not settle');
}

test('public UI retains verified original while waiting for exact local IPS, then composes', async () => {
  const app = harness();
  assert.equal(app.$('patchSection').hidden, false);
  app.choose('romFile', fixture('original'));
  await until(() => app.state().awaitingPatch);
  assert.equal(app.state().romReady, false);
  assert.equal(app.state().canBuild, false);
  assert.match(app.$('romStatus').textContent, /Selecione abaixo seu IPS/);
  app.choose('patchFile', fixture('patch'));
  await until(() => app.state().romReady);
  assert.equal(app.calls.compose, 1);
  assert.equal(app.calls.parse, 1);
  assert.equal(app.state().compositionReady, true);
  assert.equal(app.state().sourceKind, 'original');
});

test('IPS can be selected before original and legacy private package still composes automatically', async () => {
  const app = harness();
  app.choose('patchFile', fixture('patch'));
  await until(() => app.state().patchReady);
  app.choose('romFile', fixture('original'));
  await until(() => app.state().romReady);
  assert.equal(app.calls.compose, 1);
  const local = harness({ privatePackage: true });
  assert.equal(local.$('patchSection').hidden, true);
  local.choose('romFile', fixture('original'));
  await until(() => local.state().romReady);
  assert.equal(local.calls.compose, 1);
});

test('bad IPS extension, size and hash never reach composition; replacement invalidates prior output', async () => {
  const app = harness();
  app.choose('romFile', fixture('original'));
  await until(() => app.state().awaitingPatch);
  for (const file of [{ ...fixture('patch'), name: 'wrong.zip' }, { ...fixture('patch'), size: 1 }, fixture('invalidPatch')]) {
    app.choose('patchFile', file);
    await until(() => !app.state().patchLoading);
    assert.equal(app.state().romReady, false);
    assert.equal(app.state().patchReady, false);
    assert.equal(app.calls.compose, 0);
  }
  app.choose('patchFile', fixture('patch'));
  await until(() => app.state().romReady);
  app.choose('patchFile', fixture('invalidPatch'));
  await until(() => !app.state().patchLoading);
  assert.equal(app.state().romReady, false);
  assert.equal(app.state().baselineVisible, false);
  assert.equal(app.state().compositionReady, false);
  assert.equal(app.state().downloadReady, false);
});

test('baseline uses its validation path without IPS and unknown original hash is rejected', async () => {
  const app = harness();
  app.choose('romFile', fixture('invalidRom'));
  await until(() => app.$('romStatus').textContent.includes('original não reconhecida'));
  assert.equal(app.state().awaitingPatch, false);
  app.choose('romFile', fixture('baseline'));
  await until(() => app.state().romReady);
  assert.equal(app.calls.compose, 0);
  assert.equal(app.calls.baseline, 1);
  assert.equal(app.state().sourceKind, 'baseline');
});

test('stale asynchronous IPS read cannot replace a newer rejected selection', async () => {
  const app = harness();
  let resolve;
  app.choose('patchFile', { ...fixture('patch'), arrayBuffer: () => new Promise(done => { resolve = done; }) });
  app.choose('patchFile', fixture('invalidPatch'));
  await until(() => !app.state().patchLoading);
  resolve(new Uint8Array(131783).buffer);
  await new Promise(done => setTimeout(done, 10));
  assert.equal(app.state().patchReady, false);
  assert.equal(app.calls.parse, 0);
});

test('completion hook has no details and fires only once per successful input revision', async () => {
  const app = harness();
  app.choose('romFile', fixture('baseline'));
  await until(() => app.state().romReady);
  app.click('demoButton');
  await until(() => app.state().previewReady);
  app.confirm(true);
  await app.click('buildButton');
  assert.equal(app.state().downloadReady, true);
  assert.equal(app.events.length, 1);
  assert.equal(app.events[0].type, 'smgp2:conversion-completed');
  assert.equal(app.events[0].detail, null);
  await app.click('buildButton');
  app.confirm(false); app.confirm(true);
  await app.click('buildButton');
  assert.equal(app.events.length, 1);
  app.adjust();
  await until(() => app.state().previewReady);
  await app.click('buildButton');
  assert.equal(app.events.length, 2);
});

for (const failure of [{ failBuild: true }, { failBlob: true }]) {
  test('failed validation or Blob creation does not emit completion: ' + JSON.stringify(failure), async () => {
    const app = harness(failure);
    app.choose('romFile', fixture('baseline'));
    await until(() => app.state().romReady);
    app.click('demoButton');
    await until(() => app.state().previewReady);
    app.confirm(true);
    await app.click('buildButton');
    assert.equal(app.state().downloadReady, false);
    assert.equal(app.events.length, 0);
  });
}
