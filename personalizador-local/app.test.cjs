// UI control-flow tests use synthetic bytes and explicit validation doubles.
// Real hash/checksum and recipe validation are covered independently by their own tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const spec = require('./spec.js');
const source = fs.readFileSync(require.resolve('./app.js'), 'utf8');

function fixture(kind) {
  const sizes = { original: 1048576, baseline: 2097152, invalidRom: 1048576 };
  const bytes = new Uint8Array(sizes[kind]);
  if (kind === 'invalidRom') bytes[0] = 255;
  return { name: kind + '.bin', size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer };
}

function harness({ missingRecipe = false, failRecipe = false, failBuild = false, failBlob = false } = {}) {
  const elements = new Map(), events = [], calls = { compose: 0, baseline: 0, build: 0 };
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
      : spec.baseline.sha256;
  const window = { PORTRAIT_SPEC: spec,
    RomCustomizer: { sha256, cramRgb: () => [0, 0, 0], decodeKosinski: () => ({ data: new Uint8Array(2048) }),
      convertRgba64: () => ({ previewRgba: new Uint8Array(16384), paletteWords: new Array(13).fill(0) }),
      buildPatch: () => { calls.build++; if (failBuild) throw new Error('validation rejected');
        return { rom: new Uint8Array(2097152), sha256: 'test-output', checksum: 1, compressedBytes: 1, changedOffsets: [1000] }; } },
    Grid2026Pipeline: {
      validateBaseline() { calls.baseline++; return { rom: baseline(), sha256: spec.baseline.sha256 }; }
    }, addEventListener() {}, dispatchEvent(event) { events.push(event); } };
  function baseline() {
    const bytes = new Uint8Array(2097152), offset = spec.portraitPointerOffset;
    for (const [at, value] of [[offset + 4, spec.expectedPalettePointer], [offset + 8, spec.expectedGraphicsPointer]]) {
      bytes[at] = value >>> 24; bytes[at + 1] = value >>> 16 & 255; bytes[at + 2] = value >>> 8 & 255; bytes[at + 3] = value & 255;
    }
    return bytes;
  }
  if (!missingRecipe) window.Season2026 = { compose() {
    calls.compose++;
    if (failRecipe) throw new Error('Season assets integrity mismatch');
    return { rom: baseline(), sha256: spec.baseline.sha256, recipeSha256: 'synthetic-recipe-hash' };
  } };
  let urls = 0;
  vm.runInNewContext(source, { window, document, Uint8Array, Uint8ClampedArray, ImageData: class {},
    CustomEvent: class { constructor(type) { this.type = type; this.detail = null; } },
    Blob: class { constructor() { if (failBlob) throw new Error('blob creation rejected'); } },
    URL: { createObjectURL: () => 'blob:test-' + ++urls, revokeObjectURL() {} },
    setTimeout, clearTimeout });
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

test('verified original composes automatically with recipe and two file inputs', async () => {
  const app = harness();
  app.choose('romFile', fixture('original'));
  await until(() => app.state().romReady);
  assert.equal(app.calls.compose, 1);
  assert.equal(app.state().compositionReady, true);
  assert.equal(app.state().compositionMethod, 'automatic-reduced-recipe');
  assert.equal(app.state().sourceKind, 'original');
  const html = fs.readFileSync(require.resolve('./index.html'), 'utf8');
  assert.equal((html.match(/type="file"/g) || []).length, 2);
  assert.doesNotMatch(html, /patchFile|local-grid2026-data/);
  assert.ok(html.indexOf('season-assets.js') < html.indexOf('season-recipe.js'));
  assert.ok(html.indexOf('season-recipe.js') < html.indexOf('app.js'));
});

test('missing recipe and altered assets fail closed without offering extra IPS input', async () => {
  for (const options of [{ missingRecipe: true }, { failRecipe: true }]) {
    const app = harness(options);
    app.choose('romFile', fixture('original'));
    await until(() => app.$('romBadge').textContent === 'ROM recusada');
    assert.equal(app.state().romReady, false);
    assert.equal(app.state().canBuild, false);
    assert.equal(app.state().compositionReady, false);
  }
});

test('advanced baseline uses its validation path without requiring recipe', async () => {
  const app = harness({ missingRecipe: true });
  app.choose('romFile', fixture('baseline'));
  await until(() => app.state().romReady);
  assert.equal(app.calls.compose, 0);
  assert.equal(app.calls.baseline, 1);
  assert.equal(app.state().sourceKind, 'baseline');
});

test('unknown original hash, wrong size and unsupported extension are rejected', async () => {
  const app = harness();
  for (const file of [fixture('invalidRom'), { ...fixture('original'), size: 1 }, { ...fixture('original'), name: 'wrong.zip' }]) {
    app.choose('romFile', file);
    await until(() => app.$('romBadge').textContent === 'ROM recusada');
    assert.equal(app.state().romReady, false);
    assert.equal(app.calls.compose, 0);
  }
});

test('stale original file read cannot replace newer verified baseline selection', async () => {
  const app = harness();
  let resolve;
  app.choose('romFile', { ...fixture('original'), arrayBuffer: () => new Promise(done => { resolve = done; }) });
  app.choose('romFile', fixture('baseline'));
  await until(() => app.state().romReady);
  resolve(new Uint8Array(1048576).buffer);
  await new Promise(done => setTimeout(done, 10));
  assert.equal(app.state().sourceKind, 'baseline');
  assert.equal(app.calls.compose, 0);
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
