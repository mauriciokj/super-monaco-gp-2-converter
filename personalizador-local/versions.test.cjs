'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto');
const releases = require('./versions.js'), core = require('./core.js');
const delta = require('./ptbr-delta.js');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
test('two fixed releases share only the verified player target and free bank', () => {
  assert.deepEqual(Object.keys(releases.catalog), ['v33', 'ptbr']);
  assert.equal(releases.defaultId, 'ptbr');
  for (const release of Object.values(releases.catalog)) {
    assert.equal(release.spec.target.slot, 11);
    assert.equal(release.spec.portraitPointerOffset, 0x7c6a0);
    assert.deepEqual(release.spec.reservedBank, {start: 0x115000, end: 0x116000, fill: 255});
    assert.equal(Object.isFrozen(release.spec), true);
  }
  assert.throws(() => releases.get('__proto__'), /desconhecida/);
  assert.throws(() => releases.compose(new Uint8Array(1), 'ptbr'), /Tamanho/);
  assert.throws(() => releases.compose(new Uint8Array(1048576), 'ptbr'), /original não reconhecida/);
});
test('incremental recipe is bounded, sorted, non-overlapping and integrity locked', () => {
  assert.equal(sha(JSON.stringify(delta)), releases.deltaSha256);
  let end = 0;
  for (const [kind, at, value, source] of delta.ops) {
    const length = kind === 'w' ? value.length / 2 : value;
    assert.ok(at >= end && at + length <= 2097152);
    assert.ok(at + length <= 0x115000 || at >= 0x116000);
    if (kind === 'c') assert.ok(source >= 0 && source + length <= 2097152);
    if (kind === 'w') assert.match(value, /^(?:[0-9a-f]{2}){1,256}$/);
    end = at + length;
  }
});
const real = process.env.ROM_TEST && process.env.BASELINE_TEST && process.env.PTBR_TEST;
test('both release paths equal private references, personalize slot 11 only and preserve every audio byte', {skip: !real}, () => {
  const source = new Uint8Array(fs.readFileSync(process.env.ROM_TEST)), preserved = source.slice();
  const refs = {v33: fs.readFileSync(process.env.BASELINE_TEST), ptbr: fs.readFileSync(process.env.PTBR_TEST)};
  const rgba = Uint8Array.from({length: 16384}, (_, i) => i % 4 === 3 ? 255 : (i * 37) & 255);
  const image = core.convertRgba64(rgba, {usableIndices: releases.get('ptbr').spec.usableIndices});
  for (const id of ['v33', 'ptbr']) {
    const release = releases.get(id), built = releases.compose(source, id);
    assert.deepEqual(Buffer.from(built.rom), refs[id]);
    assert.deepEqual(Buffer.from(releases.compose(new Uint8Array(refs[id]), id).rom), refs[id]);
    const customized = core.buildPatch(release.spec, built.rom, image, {targetConfirmed: true});
    assert.equal(customized.checksum, core.checksumGenesis(customized.rom));
    assert.deepEqual(Buffer.from(customized.rom.subarray(0xf8000, 0x100000)), refs[id].subarray(0xf8000, 0x100000));
    assert.deepEqual(Buffer.from(customized.rom.subarray(0x7c61c, 0x7c628)), refs[id].subarray(0x7c61c, 0x7c628));
    const allowed = offset => release.spec.allowedRanges.some(r => offset >= r.start && offset < r.end);
    for (let i = 0; i < customized.rom.length; i++) if (customized.rom[i] !== refs[id][i]) assert.ok(allowed(i), 'Unexpected change at ' + i.toString(16));
    assert.deepEqual(Buffer.from(built.rom), refs[id], 'Baseline must remain immutable');
    // The personalized image round-trips through Kosinski to exactly 64 tiles.
    assert.equal(core.decodeKosinski(customized.rom, release.spec.graphics.offset, {maxOutput: 2048, maxInput: 2309}).data.length, 2048);
  }
  assert.deepEqual(source, preserved);
  assert.deepEqual(Buffer.from(releases.compose(new Uint8Array(refs.v33), 'ptbr').rom), refs.ptbr);
  assert.throws(() => releases.compose(new Uint8Array(refs.ptbr), 'v33'), /não reconhecida/);
  for (const change of [r => r.ops[0][1]++, r => r.ops.push(['w', 2097152, '00']), r => r.ops[0][0] = 'x']) {
    const altered = JSON.parse(JSON.stringify(delta)); change(altered);
    assert.throws(() => releases.applyDelta(new Uint8Array(refs.v33), altered), /Integridade/);
  }
  const corrupt = new Uint8Array(refs.v33); corrupt[0x5000] ^= 1;
  assert.throws(() => releases.compose(corrupt, 'ptbr'), /não reconhecida/);
});
