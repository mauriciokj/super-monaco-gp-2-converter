const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('./core.js');
const pipeline = require('./pipeline.js');

function record(offset, data) {
  return [offset >>> 16 & 255, offset >>> 8 & 255, offset & 255,
    data.length >>> 8 & 255, data.length & 255, ...data];
}
function rle(offset, length, value) {
  return [offset >>> 16 & 255, offset >>> 8 & 255, offset & 255,
    0, 0, length >>> 8 & 255, length & 255, value];
}
function ips(records, finalSize) {
  const out = [80, 65, 84, 67, 72, ...records.flat(), 69, 79, 70];
  if (finalSize !== undefined) out.push(finalSize >>> 16 & 255, finalSize >>> 8 & 255, finalSize & 255);
  return Uint8Array.from(out);
}
function sealChecksum(rom) {
  const sum = core.checksumGenesis(rom);
  rom[0x18e] = sum >>> 8;
  rom[0x18f] = sum & 255;
  return sum;
}
function fixture() {
  const original = new Uint8Array(0x202);
  original[0x200] = 0x12;
  original[0x201] = 0x34;
  const originalChecksum = sealChecksum(original);
  const expected = new Uint8Array(0x204);
  expected.set(original);
  expected.set([0xab, 0xcd], 0x202);
  const baselineChecksum = sealChecksum(expected);
  const patch = ips([record(0x18e, [baselineChecksum >>> 8, baselineChecksum & 255]),
    record(0x202, [0xab, 0xcd])], expected.length);
  const contract = {
    verified: true,
    original: { size: original.length, sha256: core.sha256(original), checksum: originalChecksum },
    patch: { size: patch.length, sha256: core.sha256(patch) },
    baseline: { size: expected.length, sha256: core.sha256(expected), checksum: baselineChecksum }
  };
  return { original, patch, expected, contract };
}

test('UMD exports Grid2026Pipeline in a browser without require', () => {
  const context = { Uint8Array, Uint32Array };
  vm.runInNewContext(fs.readFileSync(require.resolve('./core.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(require.resolve('./pipeline.js'), 'utf8'), context);
  assert.equal(typeof context.Grid2026Pipeline.compose2026, 'function');
  assert.equal(typeof context.Grid2026Pipeline.parseIps, 'function');
});

test('IPS applies literal and RLE records in order and copies input', () => {
  const original = Uint8Array.of(1, 2, 3, 4);
  const patch = ips([record(1, [9, 8]), rle(2, 3, 7)]);
  const parsed = pipeline.parseIps(patch);
  assert.equal(parsed.finalSize, null);
  assert.equal(parsed.records.length, 2);
  const output = pipeline.applyIps(original, patch);
  assert.deepEqual(output, Uint8Array.of(1, 9, 7, 7, 7));
  assert.deepEqual(original, Uint8Array.of(1, 2, 3, 4));
  const same = pipeline.applyIps(original, ips([]));
  assert.deepEqual(same, original);
  assert.notStrictEqual(same, original);
});

test('IPS optional final size expands and truncates with zero filling', () => {
  const source = Uint8Array.of(1, 2, 3, 4);
  assert.deepEqual(pipeline.applyIps(source, ips([record(6, [9])], 8)),
    Uint8Array.of(1, 2, 3, 4, 0, 0, 9, 0));
  assert.deepEqual(pipeline.applyIps(source, ips([], 2)), Uint8Array.of(1, 2));
  assert.throws(() => pipeline.applyIps(source, ips([record(6, [9])], 6)), /exceeds final size/);
});

test('IPS allows the required 1 MiB to 2 MiB expansion at the exact bound', () => {
  const original = new Uint8Array(1024 * 1024);
  const patch = ips([record(0x1fffff, [0xa5])], 0x200000);
  const output = pipeline.applyIps(original, patch);
  assert.equal(output.length, 0x200000);
  assert.equal(output[0x1ffffe], 0);
  assert.equal(output[0x1fffff], 0xa5);
  assert.equal(original.length, 0x100000);
  assert.throws(() => pipeline.parseIps(ips([record(0x200000, [1])])), /2 MiB ROM limit/);
});

test('IPS rejects malformed header, missing EOF, truncation, zero RLE and trailing data', () => {
  const invalid = [
    Uint8Array.of(),
    Uint8Array.from([80, 65, 84, 67, 72]),
    Uint8Array.from([80, 65, 84, 67, 72, 0, 0, 1, 0, 2, 9]),
    Uint8Array.from([80, 65, 84, 67, 72, 0, 0, 1, 0, 0, 0, 2]),
    ips([rle(0, 0, 1)]),
    Uint8Array.from([...ips([]), 1]),
    Uint8Array.from([...ips([]), 1, 2, 3, 4])
  ];
  for (const patch of invalid) assert.throws(() => pipeline.parseIps(patch));
  assert.throws(() => pipeline.parseIps(new Uint8Array(0x200001)), /2 MiB limit/);
  assert.throws(() => pipeline.applyIps(new Uint8Array(0x200001), ips([])), /2 MiB limit/);
});

test('compose2026 requires verified source and exact patch and baseline identity', () => {
  const { original, patch, expected, contract } = fixture();
  const inputBefore = original.slice(), patchBefore = patch.slice();
  const result = pipeline.compose2026(original, patch, contract);
  assert.deepEqual(result.rom, expected);
  assert.notStrictEqual(result.rom, original);
  assert.equal(result.sha256, contract.baseline.sha256);
  assert.equal(result.checksum, contract.baseline.checksum);
  assert.equal(result.sourceSha256, contract.original.sha256);
  assert.equal(result.patchSha256, contract.patch.sha256);
  assert.deepEqual(original, inputBefore);
  assert.deepEqual(patch, patchBefore);
  assert.deepEqual(pipeline.validateBaseline(result.rom, contract).rom, expected);

  assert.throws(() => pipeline.compose2026(original, patch, { ...contract, verified: false }), /Verified/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, original: { ...contract.original, sha256: '0'.repeat(64) }
  }), /original SHA-256 mismatch/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, original: { ...contract.original, size: original.length + 2 }
  }), /original size mismatch/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, original: { ...contract.original, checksum: 0 }
  }), /original Genesis checksum mismatch/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, patch: { ...contract.patch, sha256: '0'.repeat(64) }
  }), /patch SHA-256 mismatch/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, patch: { ...contract.patch, size: patch.length + 1 }
  }), /patch size mismatch/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, baseline: { ...contract.baseline, sha256: '0'.repeat(64) }
  }), /baseline SHA-256 mismatch/);
  assert.throws(() => pipeline.compose2026(original, patch, {
    ...contract, baseline: { ...contract.baseline, checksum: 0 }
  }), /baseline Genesis checksum mismatch/);
  assert.throws(() => pipeline.validateBaseline(original, contract), /baseline size mismatch/);
});

test('checksum verifies both Genesis header and calculated sum', () => {
  const { original, patch, contract } = fixture();
  const wrongHeader = original.slice();
  wrongHeader[0x18e] ^= 1;
  const adjusted = { ...contract, original: { ...contract.original, sha256: core.sha256(wrongHeader) } };
  assert.throws(() => pipeline.compose2026(wrongHeader, patch, adjusted), /original Genesis checksum mismatch/);
  const wrongData = original.slice();
  wrongData[0x200] ^= 1;
  const adjusted2 = { ...contract, original: { ...contract.original, sha256: core.sha256(wrongData) } };
  assert.throws(() => pipeline.compose2026(wrongData, patch, adjusted2), /original Genesis checksum mismatch/);
});
