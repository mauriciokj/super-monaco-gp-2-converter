const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('./core.js');

function rgbaPattern() {
  const data = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4;
    data[i] = x < 8 ? 73 : (x * 19 + y * 7) & 255;
    data[i + 1] = x < 8 ? 73 : (x * 11 + y * 13) & 255;
    data[i + 2] = x < 8 ? 136 : (x * 3 + y * 17) & 255;
    data[i + 3] = x < 8 ? 0 : 255;
  }
  return data;
}

function fixture() {
  const rom = new Uint8Array(0x4000).fill(255);
  const recordOffset = 0x300;
  rom.set([0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 6, 0], recordOffset);
  for (let i = 0; i < 26; i++) rom[0x500 + i] = i + 1;
  const conversion = core.convertRgba64(rgbaPattern());
  const compressedLength = core.encodeKosinskiLiterals(conversion.tileBytes).length;
  const spec = {
    verified: true,
    baseline: { size: rom.length, sha256: core.sha256(rom) },
    portraitPointerOffset: recordOffset,
    expectedRecordHex: Buffer.from(rom.subarray(recordOffset, recordOffset + 12)).toString('hex'),
    expectedPalettePointer: 0x500,
    expectedGraphicsPointer: 0x600,
    palette: { offset: 0x1000, capacity: 26, mode: 'reserved-ff' },
    graphics: { offset: 0x1100, capacity: compressedLength, mode: 'reserved-ff' },
    reservedBank: { start: 0x1000, end: 0x2000 },
    allowedRanges: [
      { start: 0x18e, end: 0x190 },
      { start: recordOffset + 4, end: recordOffset + 12 },
      { start: 0x1000, end: 0x101a },
      { start: 0x1100, end: 0x1100 + compressedLength }
    ]
  };
  return { rom, spec, conversion };
}

test('UMD works in a plain browser context without require', () => {
  const context = { Uint8Array, Uint32Array };
  vm.runInNewContext(fs.readFileSync(require.resolve('./core.js'), 'utf8'), context);
  assert.equal(typeof context.RomCustomizer.convertRgba64, 'function');
});

test('SHA-256 matches standard vectors and Node crypto', () => {
  assert.equal(core.sha256(new Uint8Array()), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(core.sha256(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const data = Uint8Array.from({ length: 8193 }, (_, i) => i * 31 & 255);
  assert.equal(core.sha256(data), crypto.createHash('sha256').update(data).digest('hex'));
});

test('conversion is deterministic, 13 CRAM words and row-major 8x8 4bpp tiles', () => {
  const a = core.convertRgba64(rgbaPattern()), b = core.convertRgba64(rgbaPattern());
  assert.deepEqual(a, b);
  assert.equal(a.paletteBytes.length, 26);
  assert.equal(a.tileBytes.length, 2048);
  assert.equal(a.indices.length, 4096);
  assert.equal(a.previewRgba.length, 16384);
  assert.equal(a.paletteWords[0], core.cramWord([73, 73, 136]));
  for (let i = 0; i < 13; i++) {
    assert.equal(a.paletteBytes[i * 2] << 8 | a.paletteBytes[i * 2 + 1], a.paletteWords[i]);
    assert.equal(a.paletteWords[i] & 0xf111, 0);
  }
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) {
      const byte = a.tileBytes[((ty * 8 + tx) * 8 + y) * 4 + x / 2];
      const i = (ty * 8 + y) * 64 + tx * 8 + x;
      assert.equal(byte >>> 4, a.indices[i]);
      assert.equal(byte & 15, a.indices[i + 1]);
    }
  assert.deepEqual(a.usableIndices, [3, 4, 5, 6, 7, 11, 12, 13, 15]);
  assert.ok(a.indices.every(n => a.usableIndices.includes(n)));
  for (const reserved of [8, 9, 10, 14]) assert.equal(a.paletteWords[reserved - 3], 0);
  assert.throws(() => core.convertRgba64(new Uint8Array(5)), /64x64x4/);
  assert.throws(() => core.convertRgba64(rgbaPattern(), { usableIndices: [3, 3] }), /usableIndices/);
});

test('Kosinski literals roundtrip across descriptor boundaries and eager refill', () => {
  for (const length of [0, 1, 14, 15, 16, 17, 30, 31, 32, 33, 2048]) {
    const raw = Uint8Array.from({ length }, (_, i) => i * 7 & 255);
    const encoded = core.encodeKosinskiLiterals(raw);
    const decoded = core.decodeKosinski(encoded, 0, { maxOutput: Math.max(1, length) });
    assert.deepEqual(decoded.data, raw, 'length ' + length);
    assert.equal(decoded.nextOffset, encoded.length);
  }
  // On 16 literal bits, the next descriptor must precede literal #16 payload.
  const seventeen = core.encodeKosinskiLiterals(Uint8Array.from({ length: 17 }, (_, i) => i));
  assert.equal(seventeen[17], 0x05);
  assert.equal(seventeen[18], 0);
  assert.equal(seventeen[19], 15);
});

test('Kosinski rejects truncated streams, bad backrefs and output overflow', () => {
  assert.throws(() => core.decodeKosinski(Uint8Array.of(0), 0), /Truncated/);
  assert.throws(() => core.decodeKosinski(Uint8Array.of(0, 0, 255), 0), /back-reference/);
  const encoded = core.encodeKosinskiLiterals(Uint8Array.of(1, 2, 3));
  assert.throws(() => core.decodeKosinski(encoded.subarray(0, encoded.length - 1), 0), /Truncated/);
  assert.throws(() => core.decodeKosinski(encoded, 0, { maxOutput: 2 }), /exceeds limit/);
});

test('Genesis checksum sums big-endian words from 0x200 modulo 65536', () => {
  const rom = new Uint8Array(0x206);
  rom[0x18e] = 255; rom[0x18f] = 255;
  rom.set([0x12, 0x34, 0xab, 0xcd, 0xff, 0xff], 0x200);
  assert.equal(core.checksumGenesis(rom), (0x1234 + 0xabcd + 0xffff) & 65535);
  assert.throws(() => core.checksumGenesis(new Uint8Array(513)), /even/);
});

test('guarded build changes only explicit ranges and preserves ROM length', () => {
  const { rom, spec, conversion } = fixture();
  const original = rom.slice();
  const result = core.buildPatch(spec, rom, conversion, { targetConfirmed: true });
  assert.equal(result.rom.length, rom.length);
  assert.deepEqual(rom, original);
  assert.equal(result.sha256, core.sha256(result.rom));
  assert.equal(result.rom[0x18e] << 8 | result.rom[0x18f], core.checksumGenesis(result.rom));
  assert.ok(result.changedOffsets.length > 26);
  assert.ok(result.changedOffsets.every(i => spec.allowedRanges.some(r => r.start <= i && i < r.end)));
  for (const reserved of [8, 9, 10, 14]) {
    const i = (reserved - 3) * 2;
    assert.deepEqual(result.paletteBytes.slice(i, i + 2), rom.slice(0x500 + i, 0x500 + i + 2));
  }
  assert.deepEqual(core.decodeKosinski(result.rom, spec.graphics.offset, { maxInput: result.compressedBytes }).data, conversion.tileBytes);
});

test('build rejects unsupported or inconsistent ROM maps', () => {
  const { rom, spec, conversion } = fixture();
  assert.throws(() => core.buildPatch(spec, rom, conversion), /targetConfirmed/);
  assert.throws(() => core.buildPatch({ ...spec, verified: false }, rom, conversion, { targetConfirmed: true }), /verified/);
  assert.throws(() => core.buildPatch({ ...spec, baseline: { ...spec.baseline, sha256: '0'.repeat(64) } }, rom, conversion, { targetConfirmed: true }), /mismatch/);
  assert.throws(() => core.buildPatch(spec, rom.subarray(0, rom.length - 1), conversion, { targetConfirmed: true }), /mismatch/);
  assert.throws(() => core.buildPatch({ ...spec, expectedRecordHex: '00'.repeat(12) }, rom, conversion, { targetConfirmed: true }), /record/);
  assert.throws(() => core.buildPatch({ ...spec, allowedRanges: spec.allowedRanges.slice(0, 3) }, rom, conversion, { targetConfirmed: true }), /outside allowedRanges/);
  assert.throws(() => core.buildPatch({ ...spec, graphics: { ...spec.graphics, capacity: 1 } }, rom, conversion, { targetConfirmed: true }), /capacity/);
  const dirty = rom.slice(); dirty[spec.graphics.offset] = 0;
  const dirtySpec = { ...spec, baseline: { ...spec.baseline, sha256: core.sha256(dirty) } };
  assert.throws(() => core.buildPatch(dirtySpec, dirty, conversion, { targetConfirmed: true }), /non-FF/);
  const bankDirty = rom.slice(); bankDirty[0x1fff] = 0;
  const bankDirtySpec = { ...spec, baseline: { ...spec.baseline, sha256: core.sha256(bankDirty) } };
  assert.throws(() => core.buildPatch(bankDirtySpec, bankDirty, conversion, { targetConfirmed: true }), /reservedBank/);
  const bad = { ...conversion, tileBytes: conversion.tileBytes.slice() }; bad.tileBytes[0] = 0;
  assert.throws(() => core.buildPatch(spec, rom, bad, { targetConfirmed: true }), /unsupported palette/);
  const reservedIndex = { ...conversion, tileBytes: conversion.tileBytes.slice() }; reservedIndex.tileBytes[0] = 0x88;
  assert.throws(() => core.buildPatch(spec, rom, reservedIndex, { targetConfirmed: true }), /unsupported palette/);
  assert.throws(() => core.buildPatch({ ...spec, expectedGraphicsPointer: 1 }, rom, conversion, { targetConfirmed: true }), /portrait pointers/);
});
